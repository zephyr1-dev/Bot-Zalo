import { MessageMention, MessageType } from "zlbotdqt";
import schedule from "node-schedule";
import { getGroupInfoData } from "../../service-debug/info-service/group-info.js";
import { getUserInfoData } from "../../service-debug/info-service/user-info.js";
import * as cv from "../../utils/canvas/index.js";
import { sendMessageStateQuote, sendMessageWarning } from "../chat-zalo/chat-style/chat-style.js";
import { isInWhiteList } from "./white-list.js";
import { removeMention } from "../../utils/format-util.js";

const userWarnings = new Map();
const kickedUsers = new Set();
const WARNING_RESET_TIME = 1800000; // 30 minutes

export async function handleAntiPhotoVideo(api, message, groupSettings) {
  const threadId = message.threadId;
  const content = removeMention(message);
  const parts = content.split(" ");

  if (parts.length === 1) {
    groupSettings[threadId].antiPhotoVideo = !groupSettings[threadId].antiPhotoVideo;
  } else if (parts[1] === "on") {
    groupSettings[threadId].antiPhotoVideo = true;
  } else if (parts[1] === "off") {
    groupSettings[threadId].antiPhotoVideo = false;
  } else {
    const caption = `Cú pháp không hợp lệ. Sử dụng ${prefix}antiphoto hoặc ${prefix}antiphoto on/off`;
    await sendMessageWarning(api, message, caption);
    return false;
  }

  const status = groupSettings[threadId].antiPhotoVideo ? "bật" : "tắt";
  const caption = `Chế độ chống photo đã được ${status}!`;
  await sendMessageStateQuote(api, message, caption, groupSettings[threadId].antiPhotoVideo, 300000);

  return true;
}

export async function enforceAntiPhotoVideo(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf) {
  const threadId = message.threadId;
  const msgType = message.data.msgType;
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;

  if (!botIsAdminBox || isAdminBox || isSelf || kickedUsers.has(senderId) || isInWhiteList(groupSettings, threadId, senderId)) return false;

  if (groupSettings[threadId]?.antiPhotoVideo && (msgType === "chat.photo" || msgType === "chat.video.msg")) {
    try {
      await api.deleteMessage(message, false);

      const warningResult = await handleWarning(
        api,
        message,
        threadId,
        senderId,
        senderName
      );

      if (warningResult.shouldBlock) {
        await handleViolationDetected(
          api,
          message,
          threadId,
          senderId,
          senderName
        );
      }
      return true;
    } catch (error) {
      console.error("Lỗi khi xóa tin nhắn ảnh/video:", error);
      return false;
    }
  }

  return false;
}

async function handleWarning(
  api,
  message,
  threadId,
  senderId,
  senderName
) {
  if (!userWarnings.has(senderId)) {
    userWarnings.set(senderId, {
      count: 0,
      lastWarningTime: Date.now(),
    });
  }

  const warning = userWarnings.get(senderId);
  const currentTime = Date.now();

  const warningReductions = Math.floor(
    (currentTime - warning.lastWarningTime) / WARNING_RESET_TIME
  );
  if (warningReductions > 0) {
    warning.count = Math.max(0, warning.count - warningReductions);
  }

  warning.count++;
  warning.lastWarningTime = currentTime;

  if (warning.count < 5) {
    let caption = `⚠️ Cảnh cáo ${senderName}!\nAi cho mày gửi ảnh/viceo ở đây!!!`;
    if (warning.count === 3) {
      caption = `⚠️ Cảnh cáo ${senderName}!\nTao xút Mày ra khỏi box bây giờ!`;
    }
    await api.sendMessage(
      {
        msg: caption,
        mentions: [
          MessageMention(senderId, senderName.length, "⚠️ Cảnh cáo ".length),
        ],
        ttl: 8000,
      },
      threadId,
      MessageType.GroupMessage
    );
    return { shouldBlock: false };
  } else {
    userWarnings.delete(senderId);
    return { shouldBlock: true };
  }
}

async function handleViolationDetected(
  api,
  message,
  threadId,
  senderId,
  senderName
) {
  kickedUsers.add(senderId);
  const groupInfo = await getGroupInfoData(api, threadId);
  const userInfo = await getUserInfoData(api, senderId);
  const imagePath = await cv.createKickImage(
    userInfo,
    groupInfo.name,
    groupInfo.groupType,
    userInfo.gender
  );

  try {
    await api.blockUsers(threadId, [senderId]);
    await api.sendMessage(
      // {
      //   msg: `Thành viên [ ${senderName} ] đã bị chặn do vi phạm chống ảnh/video quá nhiều! 🚫`,
      //   attachments: imagePath ? [imagePath] : [],
      // },
      threadId,
      MessageType.GroupMessage
    );

    try {
      await api.sendMessage(
        // {
        //   msg: `Bạn đã bị chặn do vi phạm chống ảnh/video quá nhiều! 🚫\nVui lòng không lặp lại hành vi này.`,
        //   attachments: imagePath ? [imagePath] : [],
        // },
        senderId,
        MessageType.DirectMessage
      );
    } catch (error) {
      console.error(`Không thể gửi tin nhắn tới ${senderId}:`, error.message);
    }
  } catch (error) {
    console.error("Lỗi khi xử lý kick vi phạm:", error);
  } finally {
    await cv.clearImagePath(imagePath);
  }

  setTimeout(() => {
    kickedUsers.delete(senderId);
    console.log(`Đã xóa ${senderId} khỏi danh sách kickedUsers.`);
  }, 5000);
}

schedule.scheduleJob("*/1 * * * *", () => {
  const currentTime = Date.now();
  for (const [senderId, warning] of userWarnings.entries()) {
    const warningReductions = Math.floor(
      (currentTime - warning.lastWarningTime) / WARNING_RESET_TIME
    );
    if (warningReductions > 0) {
      warning.count = Math.max(0, warning.count - warningReductions);
      warning.lastWarningTime = currentTime;

      if (warning.count === 0) {
        userWarnings.delete(senderId);
      }
    }
  }
});