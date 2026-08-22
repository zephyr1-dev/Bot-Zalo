import schedule from "node-schedule";
import { MessageType } from "zlbotdqt";
import { GroupEventType } from "../../api-zalo/models/GroupEvent.js";
import { isInWhiteList } from "./white-list.js";
import { sendMessageStateQuote } from "../chat-zalo/chat-style/chat-style.js";
import { removeMention } from "../../utils/format-util.js";
import { writeGroupSettings } from "../../utils/io-json.js"; 

const JOIN_THRESHOLD = 1; 
const JOIN_TIME_WINDOW = 1000; 
const LONG_TIME_WINDOW = 30000; 
const LONG_THRESHOLD = 1; 
const JOIN_LEAVE_THRESHOLD = 1; 
const CLEANUP_INTERVAL = "*/5 * * * * *"; 
const KICKED_USER_TIMEOUT = 1000;

const userJoinTimestamps = new Map(); // Lưu dấu thời gian tham gia
const userLeaveTimestamps = new Map(); // Lưu dấu thời gian rời
const kickedUsers = new Set(); // Lưu danh sách người dùng bị chặn
let isLocked = false; // Trạng thái khóa

/**
 * Thực thi hàm với cơ chế khóa mutex
 * @param {Function} fn - Hàm cần thực thi
 * @returns {Promise<*>} Kết quả của hàm
 */
async function withLock(fn) {
  while (isLocked) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  isLocked = true;
  try {
    return await fn();
  } finally {
    isLocked = false;
  }
}

/**
 * Xử lý logic chống spam tham gia-rời nhóm
 * @param {Object} api - Đối tượng API của Zalo
 * @param {Object} event - Sự kiện nhóm
 * @param {boolean} isAdminBox - Người dùng có phải admin không
 * @param {Object} groupSettings - Cài đặt nhóm
 * @param {boolean} botIsAdminBox - Bot có phải admin không
 * @param {boolean} isSelf - Sự kiện có do bot kích hoạt không
 * @param {string} [userId] - ID người dùng (tùy chọn)
 * @returns {Promise<boolean>} True nếu người dùng bị chặn, False nếu không
 */
export async function antiJoinLeave(
  api,
  event,
  isAdminBox,
  groupSettings,
  botIsAdminBox,
  isSelf,
  userId
) {
  try {
    // Kiểm tra đầu vào
    if (!event || !api || !groupSettings) return false;

    const senderId = userId || event.data?.sourceId || event.data?.actorId || event.data?.uid;
    const senderName = event.data?.actorName || event.data?.dName || "Không xác định";
    const { threadId, type } = event;
    const timestamp = Number(event.data?.ts || event.data?.timestamp || Date.now());

    if (!senderId || !threadId || isNaN(timestamp)) return false;

    // Thoát sớm nếu thỏa mãn các điều kiện
    if (
      isAdminBox ||
      kickedUsers.has(senderId) ||
      isSelf ||
      !botIsAdminBox ||
      isInWhiteList(groupSettings, threadId, senderId) ||
      !groupSettings[threadId]?.antiJoinLeave
    ) {
      return false;
    }

    // Chỉ xử lý sự kiện JOIN hoặc LEAVE
    if (type !== GroupEventType.JOIN && type !== GroupEventType.LEAVE) {
      return false;
    }

    return await withLock(async () => {
      const joinTimestamps = userJoinTimestamps.get(senderId) || [];
      const leaveTimestamps = userLeaveTimestamps.get(senderId) || [];

      // Ghi lại dấu thời gian
      if (type === GroupEventType.JOIN) {
        joinTimestamps.push({ time: timestamp });
      } else if (type === GroupEventType.LEAVE) {
        leaveTimestamps.push({ time: timestamp });
      }

      // Lọc các lần tham gia/rời gần đây
      const currentTime = Date.now();
      const recentJoins = joinTimestamps.filter(
        join => currentTime - join.time <= JOIN_TIME_WINDOW
      );
      const recentLeaves = leaveTimestamps.filter(
        leave => currentTime - leave.time <= JOIN_TIME_WINDOW
      );
      const longTermJoins = joinTimestamps.filter(
        join => currentTime - join.time <= LONG_TIME_WINDOW
      );

      // Cập nhật bộ nhớ
      userJoinTimestamps.set(senderId, longTermJoins);
      userLeaveTimestamps.set(senderId, recentLeaves);

      // Kiểm tra ngưỡng spam
      const totalJoinLeave = recentJoins.length + recentLeaves.length;
      if (
        recentJoins.length > JOIN_THRESHOLD ||
        totalJoinLeave > JOIN_LEAVE_THRESHOLD ||
        longTermJoins.length > LONG_THRESHOLD
      ) {
        await api.blockUsers(threadId, [senderId]);
        kickedUsers.add(senderId);
        console.log(
          `Chặn ${senderId} (${senderName}) trong nhóm ${threadId}. ` +
          `Lý do: ${recentJoins.length} lần tham gia, ${recentLeaves.length} lần rời ` +
          `trong ${JOIN_TIME_WINDOW}ms, ${longTermJoins.length} lần tham gia trong ${LONG_TIME_WINDOW}ms`
        );
        await handleJoinLeaveDetected(api, threadId, senderId, senderName, recentJoins, recentLeaves);
        return true;
      }
      return false;
    });
  } catch (error) {
    console.error("Lỗi trong antiJoinLeave:", error);
    return false;
  }
}

/**
 * Xử lý thông báo và dọn dẹp khi phát hiện hành vi tham gia-rời
 * @param {Object} api - Đối tượng API của Zalo
 * @param {string} threadId - ID nhóm
 * @param {string} senderId - ID người dùng
 * @param {string} senderName - Tên người dùng
 * @param {Array} recentJoins - Danh sách lần tham gia gần đây
 * @param {Array} recentLeaves - Danh sách lần rời gần đây
 */
async function handleJoinLeaveDetected(api, threadId, senderId, senderName, recentJoins, recentLeaves) {
  try {
    await api.sendMessage(
      {
        msg: `Thằng ngu đã bị chặn do tham gia nhóm quá nhiều lần trong thời gian ngắn!🚫\n`,
        attachments: [],
        ttl: 60000
      },
      threadId,
      MessageType.GroupMessage
    );
  } catch (error) {
    console.error("Lỗi khi gửi thông báo tham gia-rời:", error);
  }

  setTimeout(() => {
    kickedUsers.delete(senderId);
    userJoinTimestamps.delete(senderId);
    userLeaveTimestamps.delete(senderId);
  }, KICKED_USER_TIMEOUT);
}

/**
 * Dọn dẹp định kỳ các dấu thời gian tham gia và rời cũ
 */
schedule.scheduleJob(CLEANUP_INTERVAL, () => {
  const currentTime = Date.now();
  for (const [senderId, joins] of userJoinTimestamps) {
    const recentJoins = joins.filter(
      join => currentTime - join.time <= LONG_TIME_WINDOW
    );
    if (recentJoins.length === 0) {
      userJoinTimestamps.delete(senderId);
    } else {
      userJoinTimestamps.set(senderId, recentJoins);
    }
  }
  for (const [senderId, leaves] of userLeaveTimestamps) {
    const recentLeaves = leaves.filter(
      leave => currentTime - leave.time <= JOIN_TIME_WINDOW
    );
    if (recentLeaves.length === 0) {
      userLeaveTimestamps.delete(senderId);
    } else {
      userLeaveTimestamps.set(senderId, recentLeaves);
    }
  }
});

/**
 * Xử lý lệnh bật/tắt chức năng chống spam tham gia-rời
 * @param {Object} api - Đối tượng API của Zalo
 * @param {Object} message - Đối tượng tin nhắn
 * @param {Object} groupSettings - Cài đặt nhóm
 * @returns {Promise<boolean>} Trạng thái thành công
 */
export async function handleAntiJoinLeaveCommand(api, message, groupSettings) {
  try {
    if (!api || !message || !groupSettings) return false;

    const { threadId } = message;
    const content = removeMention(message);
    const status = content.split(" ")[1]?.toLowerCase();

    if (!groupSettings[threadId]) {
      groupSettings[threadId] = { antiJoinLeave: false };
    }

    const prevStatus = groupSettings[threadId].antiJoinLeave;
    groupSettings[threadId].antiJoinLeave = 
      status === "on" ? true :
      status === "off" ? false :
      !prevStatus;

    const newStatusText = groupSettings[threadId].antiJoinLeave ? "bật" : "tắt";
    await sendMessageStateQuote(
      api,
      message,
      `Chức năng chống spam tham gia-rời nhóm đã được ${newStatusText}!`,
      groupSettings[threadId].antiJoinLeave,
      300000
    );

    await writeGroupSettings(groupSettings);
    return true;
  } catch (error) {
    console.error("Lỗi trong handleAntiJoinLeaveCommand:", error);
    return false;
  }
}