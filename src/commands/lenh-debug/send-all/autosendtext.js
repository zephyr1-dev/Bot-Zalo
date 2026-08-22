import { MessageType } from "../../../api-zalo/index.js";
import { getGlobalPrefix } from "../../../service-debug/service.js";
import { removeMention } from "../../../utils/format-util.js";
import { readGroupSettings, writeGroupSettings } from "../../../utils/io-json.js";
import { sendMessageWarningRequest, sendMessageStateQuote } from "../../../service-debug/chat-zalo/chat-style/chat-style.js";

const autoTextMap = {}; // Lưu interval theo nhóm
const lastSentMap = {}; // Lưu thời gian gửi cuối cùng theo nhóm và mốc giờ

export async function handleAutoSendTextCommand(api, message, groupSettings = readGroupSettings()) {
  const prefix = getGlobalPrefix();

  if (!message || (!message.threadId && !message?.data?.idTo)) {
    return;
  }

  const content = removeMention(message).trim();
  const threadId = message?.threadId || message?.data?.idTo;

  if (!groupSettings[threadId]) {
    groupSettings[threadId] = {};
  }

  if (!lastSentMap[threadId]) {
    lastSentMap[threadId] = {};
  }

  if (!Array.isArray(groupSettings[threadId].autoSendTime)) {
    if (groupSettings[threadId].autoSendTime && typeof groupSettings[threadId].autoSendTime === "object") {
      groupSettings[threadId].autoSendTime = [groupSettings[threadId].autoSendTime];
    } else {
      groupSettings[threadId].autoSendTime = [];
    }
    try {
      writeGroupSettings(groupSettings);
    } catch (error) {}
  }

  const args = content ? content.split(" ") : [];
  const command = args[0]?.replace(prefix, "").toLowerCase();
  const status = args[1]?.toLowerCase();

  if (status === "on" || status === "off" || args.length === 0) {
    let newStatus;
    if (status === "on") {
      if (!groupSettings[threadId].autoSendText && groupSettings[threadId].autoSendTime.length === 0) {
        const objectData = {
          caption: `Vui lòng thiết lập nội dung và thời gian trước: ${prefix}sendtext <số><s/p/h> <nội dung> hoặc ${prefix}sendtext time <HH:MM:SS> <nội dung>`
        };
        try {
          await sendMessageWarningRequest(api, message, objectData, 30000);
        } catch (error) {}
        return;
      }
      groupSettings[threadId].sendtext = true;
      newStatus = "bật";
    } else if (status === "off") {
      groupSettings[threadId].sendtext = false;
      newStatus = "tắt";
    } else {
      groupSettings[threadId].sendtext = !groupSettings[threadId].sendtext;
      newStatus = groupSettings[threadId].sendtext ? "bật" : "tắt";
    }
    try {
      writeGroupSettings(groupSettings);
    } catch (error) {}
    if (groupSettings[threadId].sendtext) {
      if (groupSettings[threadId].autoSendText) {
        const { interval, content } = groupSettings[threadId].autoSendText;
        startAutoText(api, threadId, content, interval);
      }
      if (groupSettings[threadId].autoSendTime.length > 0) {
        startAutoTime(api, threadId, groupSettings[threadId].autoSendTime);
      }
    } else {
      if (autoTextMap[threadId]) {
        clearInterval(autoTextMap[threadId]);
        delete autoTextMap[threadId];
      }
      delete lastSentMap[threadId];
    }

    const objectData = {
      caption: `Đã ${newStatus} chức năng gửi tin nhắn tự động vào nhóm này!`
    };
    try {
      await sendMessageStateQuote(api, message, objectData.caption, groupSettings[threadId].sendtext, 30000);
    } catch (error) {}
    return;
  }

  if (status === "time") {
    const subCommand = args[2]?.toLowerCase();

    if (subCommand === "list") {
      const times = groupSettings[threadId].autoSendTime || [];
      if (times.length === 0) {
        const objectData = { caption: "Chưa có mốc giờ nào được thiết lập." };
        try {
          await sendMessageWarningRequest(api, message, objectData, 30000);
        } catch (error) {}
        return;
      }
      const caption = `Danh sách mốc giờ:\n${times.map((t, i) => `${i + 1}. ${t.time} - ${t.content}`).join("\n")}`;
      const objectData = { caption };
      try {
        await sendMessageWarningRequest(api, message, objectData, 30000);
      } catch (error) {}
      return;
    }

    if (subCommand === "remove") {
      const timeRaw = args[3];
      const timeMatch = timeRaw?.match(/^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/);
      if (!timeMatch) {
        const objectData = {
          caption: `📌 Dùng: ${prefix}sendtext time remove <HH:MM:SS>\nVí dụ: ${prefix}sendtext time remove 14:30:00`
        };
        try {
          await sendMessageWarningRequest(api, message, objectData, 30000);
        } catch (error) {}
        return;
      }
      const initialLength = groupSettings[threadId].autoSendTime.length;
      groupSettings[threadId].autoSendTime = groupSettings[threadId].autoSendTime.filter(t => t.time !== timeRaw);
      if (groupSettings[threadId].autoSendTime.length === initialLength) {
        const objectData = { caption: `Không tìm thấy mốc giờ ${timeRaw} để xóa.` };
        try {
          await sendMessageWarningRequest(api, message, objectData, 30000);
        } catch (error) {}
        return;
      }
      try {
        writeGroupSettings(groupSettings);
      } catch (error) {}
      const objectData = { caption: `✅ Đã xóa mốc giờ ${timeRaw}.` };
      try {
        await sendMessageWarningRequest(api, message, objectData, 30000);
      } catch (error) {}
      if (groupSettings[threadId].sendtext && groupSettings[threadId].autoSendTime.length > 0) {
        startAutoTime(api, threadId, groupSettings[threadId].autoSendTime);
      }
      return;
    }

    // Xử lý danh sách mốc giờ với nội dung chung
    const timeListRaw = args[2];
    const timeList = timeListRaw?.split(",").map(t => t.trim()) || [];
    const msgRaw = args.slice(3).join(" ").replace(/\\n/g, "\n");

    // Kiểm tra định dạng mốc giờ
    const validTimes = timeList.filter(time => time.match(/^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/));
    if (validTimes.length === 0 || !timeListRaw) {
      const objectData = {
        caption: `📌 Dùng: ${prefix}sendtext time <HH:MM:SS,HH:MM:SS,...> <nội dung>\nVí dụ: ${prefix}sendtext time 08:00:00,09:00:00 "Chào buổi sáng"`
      };
      try {
        await sendMessageWarningRequest(api, message, objectData, 30000);
      } catch (error) {}
      return;
    }

    // Kiểm tra nội dung
    if (!msgRaw) {
      const objectData = {
        caption: `❗ Thiếu nội dung tin nhắn.\nDùng: ${prefix}sendtext time <HH:MM:SS,HH:MM:SS,...> <nội dung>`
      };
      try {
        await sendMessageWarningRequest(api, message, objectData, 30000);
      } catch (error) {}
      return;
    }

    // Cập nhật danh sách mốc giờ với nội dung chung
    validTimes.forEach(time => {
      const existingTimeIndex = groupSettings[threadId].autoSendTime.findIndex(t => t.time === time);
      if (existingTimeIndex !== -1) {
        groupSettings[threadId].autoSendTime[existingTimeIndex].content = msgRaw;
      } else {
        groupSettings[threadId].autoSendTime.push({ time, content: msgRaw });
      }
    });

    groupSettings[threadId].sendtext = true;
    try {
      writeGroupSettings(groupSettings);
    } catch (error) {}

    // Gửi tin nhắn ngay nếu mốc giờ trùng với thời gian hiện tại
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const today = now.toISOString().split('T')[0];

    validTimes.forEach(time => {
      if (time === currentTime && !lastSentMap[threadId][time]) {
        sendAutoTextNow(api, threadId, msgRaw);
        lastSentMap[threadId][time] = today;
      }
    });

    const objectData = {
      caption: `✅ Đã thiết lập gửi tin nhắn "${msgRaw}" vào các mốc giờ: ${validTimes.join(", ")}.`
    };
    try {
      await sendMessageWarningRequest(api, message, objectData, 30000);
    } catch (error) {}

    startAutoTime(api, threadId, groupSettings[threadId].autoSendTime);
    return;
  }

  const timeRaw = args[1];
  const timeMatch = timeRaw?.match(/^([0-9]+)([sph])$/i);

  if (!timeMatch) {
    const objectData = {
      caption: `📌 Dùng: ${prefix}sendtext <số><s/p/h> <nội dung> hoặc ${prefix}sendtext time <HH:MM:SS> <nội dung>\nVí dụ: ${prefix}sendtext 5s Hello! hoặc ${prefix}sendtext time 14:30:00 Hello!`
    };
    try {
      await sendMessageWarningRequest(api, message, objectData, 30000);
    } catch (error) {}
    return;
  }

  const value = parseInt(timeMatch[1]);
  const unit = timeMatch[2].toLowerCase();
  let intervalMs;

  if (unit === "s") {
    intervalMs = value * 1000;
  } else if (unit === "p") {
    intervalMs = value * 60 * 1000;
  } else if (unit === "h") {
    intervalMs = value * 60 * 60 * 1000;
  }
  if (intervalMs < 1000 || intervalMs > 24 * 60 * 60 * 1000) {
    const objectData = {
      caption: "⏰ Khoảng thời gian không hợp lệ. Hợp lệ: 1s đến 24h."
    };
    try {
      await sendMessageWarningRequest(api, message, objectData, 30000);
    } catch (error) {}
    return;
  }

  const msgRaw = args.slice(2).join(" ");
  const msgContent = msgRaw.replace(/\\n/g, "\n");

  if (!msgContent) {
    const objectData = {
      caption: `❗ Thiếu nội dung tin nhắn.\nDùng: ${prefix}sendtext <số><s/p/h> <nội dung>`
    };
    try {
      await sendMessageWarningRequest(api, message, objectData, 30000);
    } catch (error) {}
    return;
  }
  groupSettings[threadId].autoSendText = {
    interval: intervalMs / (60 * 1000),
    content: msgContent
  };
  groupSettings[threadId].sendtext = true;
  try {
    writeGroupSettings(groupSettings);
  } catch (error) {}
  const objectData = {
    caption: `✅ Đã thiết lập gửi tin nhắn mỗi ${value}${unit}.`
  };
  try {
    await sendMessageWarningRequest(api, message, objectData, 30000);
  } catch (error) {}

  await sendAutoTextNow(api, threadId, msgContent);
  startAutoText(api, threadId, msgContent, intervalMs / (60 * 1000));
}

function startAutoText(api, threadId, text, intervalMin) {
  if (autoTextMap[threadId]) {
    clearInterval(autoTextMap[threadId]);
  }

  const intervalMs = intervalMin * 60 * 1000;
  autoTextMap[threadId] = setInterval(() => {
    const currentSettings = readGroupSettings();
    if (!currentSettings[threadId]?.sendtext) {
      clearInterval(autoTextMap[threadId]);
      delete autoTextMap[threadId];
      delete lastSentMap[threadId];
      return;
    }
    sendAutoTextNow(api, threadId, text);
  }, intervalMs);
}

function startAutoTime(api, threadId, times) {
  if (autoTextMap[threadId]) {
    clearInterval(autoTextMap[threadId]);
  }

  if (!lastSentMap[threadId]) {
    lastSentMap[threadId] = {};
  }

  if (!Array.isArray(times)) {
    return;
  }

  autoTextMap[threadId] = setInterval(() => {
    const currentSettings = readGroupSettings();
    if (!currentSettings[threadId]?.sendtext) {
      clearInterval(autoTextMap[threadId]);
      delete autoTextMap[threadId];
      delete lastSentMap[threadId];
      return;
    }

    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const today = now.toISOString().split('T')[0];

    times.forEach(({ time, content }) => {
      if (currentTime === time && lastSentMap[threadId][time] !== today) {
        sendAutoTextNow(api, threadId, content);
        lastSentMap[threadId][time] = today;
      }
    });
  }, 1000);
}

async function sendAutoTextNow(api, threadId, text) {
  try {
    await api.sendMessage(
      { msg: text, ttl: 30 * 24 * 60 * 60 * 1000 }, // TTL = 30 ngày
      threadId,
      MessageType.GroupMessage
    );
  } catch (err) {
    console.error(`Error sending message to thread ${threadId}:`, err);
  }
}

export function restoreAutoSendText(api) {
  const groupSettings = readGroupSettings();
  for (const threadId in groupSettings) {
    if (groupSettings[threadId]?.sendtext) {
      if (groupSettings[threadId].autoSendText) {
        const { interval, content } = groupSettings[threadId].autoSendText;
        startAutoText(api, threadId, content, interval);
      }
      if (groupSettings[threadId].autoSendTime) {
        if (!Array.isArray(groupSettings[threadId].autoSendTime)) {
          if (typeof groupSettings[threadId].autoSendTime === "object") {
            groupSettings[threadId].autoSendTime = [groupSettings[threadId].autoSendTime];
            try {
              writeGroupSettings(groupSettings);
            } catch (error) {}
          } else {
            groupSettings[threadId].autoSendTime = [];
          }
        }
        if (groupSettings[threadId].autoSendTime.length > 0) {
          startAutoTime(api, threadId, groupSettings[threadId].autoSendTime);
        }
      }
    }
  }
}