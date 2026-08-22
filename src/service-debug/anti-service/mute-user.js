import { MessageMention, MessageType } from "zlbotdqt";
import { isAdmin } from "../../index.js";
import { sendMessageComplete, sendMessageQuery, sendMessageWarning } from "../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../service.js";
import { readGroupSettings, writeGroupSettings } from "../../utils/io-json.js";
import { formatSeconds, removeMention } from "../../utils/format-util.js";

// Thêm hằng số để định nghĩa giá trị vô thời hạn
const PERMANENT_MUTE = -1;

function parseTime(timeStr) {
  if (!timeStr) return PERMANENT_MUTE;

  const value = parseInt(timeStr.slice(0, -1));
  const unit = timeStr.slice(-1).toLowerCase();

  if (isNaN(value)) return PERMANENT_MUTE;

  switch (unit) {
    case "s": // giây
    case "g":
      return value;
    case "m": // phút
    case "p":
      return value * 60;
    case "h": // giờ
    case "g":
      return value * 3600;
    default:
      return parseInt(timeStr);
  }
}

function isMuted(groupSettings, threadId, senderId) {
  const muteInfo = groupSettings[threadId]?.muteList?.[senderId];
  if (!muteInfo) return false;

  if (muteInfo.timeMute === PERMANENT_MUTE) return true;
  
  const remainingTime = muteInfo.timeMute - Math.floor(Date.now() / 1000);
  if (remainingTime <= 0) {
    delete groupSettings[threadId].muteList[senderId];
    return false;
  }
  return true;
}

function isAllMuted(groupSettings, threadId) {
  const muteInfo = groupSettings[threadId]?.muteList?.[-1];
  if (!muteInfo) return false;

  if (muteInfo.timeMute === PERMANENT_MUTE) return true;

  const remainingTime = muteInfo.timeMute - Math.floor(Date.now() / 1000);
  if (remainingTime <= 0) {
    delete groupSettings[threadId].muteList[-1];
    return false;
  }
  return true;
}

export async function handleMute(api, message, groupSettings, isAdminBox, botIsAdminBox, isSelf) {
  const senderId = message.data.uidFrom;
  const threadId = message.threadId;

  if (!groupSettings[threadId].muteList) {
    groupSettings[threadId].muteList = {};
  }
  
  if ( !isSelf && botIsAdminBox) {
    if (isAllMuted(groupSettings, threadId) || isMuted(groupSettings, threadId, senderId)) {
      if (isAdminBox) {
          const groupId = message.data.idTo;
          const muteId = message.data.uidFrom;
          if ( global.mutes && global.mutes[groupId] && global.mutes[groupId][muteId] ) {
            const cliMsgId = message.data.cliMsgId || Date.now().toString();
            // console.log(message);
            const uidFrom = message.data.uidFrom;
            const msgId = global.mutes[groupId][muteId];
            await api.zDeleteMessage({cliMsgId, msgId, uidFrom}, groupId, message.type).catch(console.error);
          }
        } else await api.deleteMessage(message, false).catch(console.error);
      return true;
    }
  }

  return false;
}

export async function handleMuteList(api, message, groupSettings) {
  const threadId = message.threadId;
  if (Object.keys(groupSettings[threadId].muteList).length === 0) {
    await sendMessageWarning(api, message, "Hiện Không có người dùng nào bị cấm chat.");
    return;
  }

  let muteListMessage = "Danh sách người dùng bị cấm chat:\n";
  const currentTime = Math.floor(Date.now() / 1000);

  if (groupSettings[threadId].muteList[-1]) {
    const muteInfo = groupSettings[threadId].muteList[-1];
    const timeStr = muteInfo.timeMute === PERMANENT_MUTE 
      ? "vô thời hạn"
      : `còn ${formatSeconds(muteInfo.timeMute - currentTime)}`;
    muteListMessage += `- Tất cả thành viên (${timeStr})\n`;
  }

  const mutedUsers = Object.entries(groupSettings[threadId].muteList)
    .filter(([id]) => id !== "-1")
    .map(([id, muteInfo], index) => {
      const timeStr = muteInfo.timeMute === PERMANENT_MUTE
        ? "vô thời hạn"
        : `còn ${formatSeconds(muteInfo.timeMute - currentTime)}`;
      return `${index + 1}. ${muteInfo.name} (${timeStr})`;
    });

  muteListMessage += mutedUsers.join("\n");

  await api.sendMessage(
    { msg: muteListMessage, quote: message, ttl: 300000 }, 
    threadId, 
    MessageType.GroupMessage
  );
}

export async function addOrUpdateMute(api, message, userId, userName, duration, groupSettings) {
  const threadId = message.threadId;
  const currentTime = Math.floor(Date.now() / 1000);
  let isChangeSetting = false;

  if (!groupSettings[threadId].muteList[userId]) {
    groupSettings[threadId].muteList[userId] = {
      name: userName,
      timeMute: duration === PERMANENT_MUTE ? PERMANENT_MUTE : currentTime + duration,
    };
    const timeMsg = duration === PERMANENT_MUTE ? "vô thời hạn" : `trong ${formatSeconds(duration)}`;
    await sendMessageComplete(api, message, `Đã cấm chat người dùng ${userName} ${timeMsg}.`);
    isChangeSetting = true;
  } else {
    const existingMute = groupSettings[threadId].muteList[userId];
    const oldDuration =
      existingMute.timeMute === PERMANENT_MUTE
        ? "vô thời hạn"
        : formatSeconds(existingMute.timeMute - currentTime);

    existingMute.timeMute = duration === PERMANENT_MUTE ? PERMANENT_MUTE : currentTime + duration;
    const newDuration = duration === PERMANENT_MUTE ? "vô thời hạn" : `trong ${formatSeconds(duration)}`;

    await sendMessageComplete(
      api,
      message,
      `Đã cập nhật thời gian cấm chat cho ${userName}:\n- Cũ: ${oldDuration}\n- Mới: ${newDuration}`
    );
    isChangeSetting = true;
  }

  return isChangeSetting;
}

export async function handleMuteUser(api, message, groupSettings, groupAdmins) {
  const threadId = message.threadId;
  const content = removeMention(message);
  const prefix = getGlobalPrefix();
  const parts = content.split(" ");

  let isChangeSetting = false;

  if (content.includes(`${prefix}mute all`)) {
    let timeStr = parts[2];
    const duration = parseTime(timeStr);
    isChangeSetting = await addOrUpdateMute(api, message, -1, "All Users", duration, groupSettings);
    return isChangeSetting;
  }
  const mentions = message.data.mentions;
  if (mentions && mentions.length > 0) {
    let timeStr = parts[1];
    const duration = parseTime(timeStr);

    for (const mention of mentions) {
      const userId = mention.uid;
      const userName = message.data.content.substr(mention.pos, mention.len).replace("@", "");

      if (isAdmin(userId, threadId, groupAdmins)) {
        // await sendMessageWarning(api, message, `Không thể cấm chat ${userName} vì họ là quản trị viên`);
        // continue;
        const msgBotId = message.data.msgId;
        if (!global.mutes) global.mutes = {};
        if (!global.mutes[threadId]) global.mutes[threadId] = {};
        if (!global.mutes[threadId][userId]) {
          global.mutes[threadId][userId] = msgBotId;
          await sendMessageWarning(api, message, `Đã cấm chat key ${userName} -)))`);
        }
      }

      isChangeSetting = await addOrUpdateMute(api, message, userId, userName, duration, groupSettings);
    }
  } else {
    await sendMessageQuery(api, message, "Vui lòng đề cập (@mention) người dùng cần cấm chat.");
  }
  return isChangeSetting;
}

export async function handleUnmuteUser(api, message, groupSettings) {
  let isChangeSetting = false;
  const content = removeMention(message);
  const threadId = message.threadId;

  if (content.includes(`${getGlobalPrefix()}unmute all`)) {
    if (groupSettings[threadId].muteList[-1]) {
      delete groupSettings[threadId].muteList[-1];
      isChangeSetting = true;
      await sendMessageComplete(api, message, "Đã mở chat tất cả thành viên trong nhóm.");
    } else {
      await sendMessageWarning(api, message, "Tất cả thành viên chưa bị cấm chat.");
    }
    return isChangeSetting;
  }

  const unmuteReferences = message.data.mentions;
  if (unmuteReferences && unmuteReferences.length > 0) {
    for (const mention of unmuteReferences) {
      const userId = mention.uid;
      if (groupSettings[threadId].muteList[userId]) {
        const userName = groupSettings[threadId].muteList[userId];
        delete groupSettings[threadId].muteList[userId];
        isChangeSetting = true;
        await sendMessageComplete(api, message, `Đã mở chat người dùng ${userName.name || userId || userName}.`);
      } else {
        const userName = message.data.content.substr(mention.pos, mention.pos + mention.len).replace("@", "");
        await sendMessageWarning(
          api,
          message,
          `Người dùng ${userName.name || userName || userId} Không tồn tại trong danh sách cấm chat.`
        );
      }
    }
  } else {
    await sendMessageQuery(api, message, "Vui lòng đề cập (@mention) người dùng cần mở chat.");
  }
  return isChangeSetting;
}

let muteCheckInterval;
export async function startMuteCheck(api) {
  if (muteCheckInterval) {
    clearInterval(muteCheckInterval);
  }

  muteCheckInterval = setInterval(async () => {
    const groupSettings = readGroupSettings();
    let changeSetting = false;
    const currentTime = Math.floor(Date.now() / 1000);

    for (const [threadId, threadSettings] of Object.entries(groupSettings)) {
      if (!threadSettings.muteList) continue;

      for (const [userId, muteInfo] of Object.entries(threadSettings.muteList)) {
        if (muteInfo.timeMute === PERMANENT_MUTE) continue;
        
        if (currentTime >= muteInfo.timeMute) {
          delete threadSettings.muteList[userId];
          changeSetting = true;
          const name = userId === "-1" ? "Tất cả thành viên" : muteInfo.name;
          const capText = " đã được mở chat, hãy phát biểu tích cực hơn nhé!";
          await api.sendMessage(
            { msg: name + capText, mentions: [MessageMention(userId, name.length, 0)] },
            threadId,
            MessageType.GroupMessage
          );
        }
      }
    }

    if (changeSetting) {
      writeGroupSettings(groupSettings);
    }
  }, 5000);
}

export async function extendMuteDuration(threadId, userId, userName, groupSettings, extensionDuration = 900) {
  const currentTime = Math.floor(Date.now() / 1000);
  let isChangeSetting = false;

  if (!groupSettings[threadId].muteList) {
    groupSettings[threadId].muteList = {};
  }

  if (!groupSettings[threadId].muteList[userId]) {
    groupSettings[threadId].muteList[userId] = {
      name: userName,
      timeMute: currentTime + extensionDuration,
    };
    isChangeSetting = true;
  } else {
    const existingMute = groupSettings[threadId].muteList[userId];
    
    // Nếu đang mute vĩnh viễn thì giữ nguyên
    if (existingMute.timeMute === PERMANENT_MUTE) {
      return isChangeSetting;
    }
    
    const remainingTime = Math.max(0, existingMute.timeMute - currentTime);
    existingMute.timeMute = currentTime + remainingTime + extensionDuration;
    isChangeSetting = true;
  }

  if (isChangeSetting) {
    writeGroupSettings(groupSettings);
  }
  return isChangeSetting;
}

