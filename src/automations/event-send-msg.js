import schedule from "node-schedule";
import { MessageMention, MessageType } from "zlbotdqt";
import { antiPhoneNumber } from "../service-debug/anti-service/anti-phone-number.js";
import { antiBotCheck } from "../service-debug/anti-service/anti-bot.js";
import { getConnectedClientsCount, getIO } from "../web-service/web-server.js";
import { getBotId, isAdmin, admins, checkDisableProphylacticConfig } from "../index.js";
import { antiTag } from "../service-debug/anti-service/anti-tag.js";
import { antiLink } from "../service-debug/anti-service/anti-link.js";
import { antiSpam } from "../service-debug/anti-service/anti-spam.js";
import { antiBadWord } from "../service-debug/anti-service/anti-badword.js";
import { antiNotText } from "../service-debug/anti-service/anti-not-text.js";
import { handleMute } from "../service-debug/anti-service/mute-user.js";
import { antiEffectSticker } from "../service-debug/anti-service/anti-stickerlag.js";
import { superCheckBox } from "../service-debug/anti-service/setup-anti.js";
import { Reactions } from "../api-zalo/index.js";
import { getGlobalPrefix, handleOnChatUser, handleOnReplyFromUser } from "../service-debug/service.js";
import { enforceAntiFile } from "../service-debug/anti-service/anti-file.js";
import { enforceAntiPhotoVideo } from "../service-debug/anti-service/anti-photo.js";
import { enforceAntiText } from "../service-debug/anti-service/anti-text.js";
import { enforceAntiVoice } from "../service-debug/anti-service/anti-voice.js";
import { antiJoinLeave } from "../service-debug/anti-service/anti-join-leave.js";
import { antiAllEffectSticker } from "../service-debug/anti-service/anti-sticker.js";
import { antiForward } from "../service-debug/anti-service/anti-forward.js";

//import { chatWithSimsimi } from "../service-debug/chat-bot/simsimi/simsimi-api.js";
import { handleChatBot } from "../service-debug/chat-bot/bot-learning/dqt-bot.js";
import { getGroupAdmins, getGroupInfoData } from "../service-debug/info-service/group-info.js";
import { getUserInfoData } from "../service-debug/info-service/user-info.js";
import { handleDownloadZalo } from "../service-debug/api-crawl/download/auto-download.js";
import { handleAdminHighLevelCommands } from "../commands/bot-manager/admin-manager.js";
import { handleAutoReplyGemini } from "../service-debug/api-crawl/assistant-ai/auto-reply.js";
import { updateUserRank } from "../service-debug/info-service/rank-chat.js";
import { pushMessageToWebLog } from "../utils/io-json.js";
import { handleCommand, initGroupSettings, handleCommandPrivate } from "../commands/command.js";
import { logMessageToFile, readGroupSettings } from "../utils/io-json.js";
import { canvasTest, testFutureGroup, testFutureUser } from "./ndq-test.js";
import { handleAutoJoin } from "../service-debug/anti-service/auto-join.js";
import { antiNude } from "../service-debug/anti-service/anti-nude/anti-nude.js";
import { isUserBlocked } from "../commands/bot-manager/group-manage.js";
import { handleIntegratedTestCommand } from "../commands/test-suite/index.js";

const userLastMessageTime = new Map();
const COOLDOWN_TIME = 1000;

const lastBusinessCardTime = new Map();
const BUSINESS_CARD_COOLDOWN = 60 * 60 * 1000;

async function canReplyToUser(senderId) {
  const currentTime = Date.now();
  const lastMessageTime = userLastMessageTime.get(senderId);

  if (!lastMessageTime || currentTime - lastMessageTime >= COOLDOWN_TIME) {
    userLastMessageTime.set(senderId, currentTime);
    return true;
  }
  return false;
}

export async function checkAndSendBusinessCard(api, senderId, senderName) {
  if (isAdmin(senderId)) return false;
  const currentTime = Date.now();
  const lastSentTime = lastBusinessCardTime.get(senderId);

  if (!lastSentTime || currentTime - lastSentTime >= BUSINESS_CARD_COOLDOWN) {
    lastBusinessCardTime.set(senderId, currentTime);
    const idBot = getBotId();
    if (admins.length == 0 || (admins.length == 1 && admins.includes(idBot.toString()))) return false;
    await api.sendMessage(
      {
        msg:
          `𝐗𝐢𝐧 𝐂𝐡𝐚̀𝐨 𝐁𝐚̣𝐧 ! 𝐓𝐨̂𝐢 𝐥𝐚̀ 👉 𝐁𝐮̀𝐢 𝐐𝐮𝐚𝐧𝐠 𝐃𝐮̃𝐧𝐠  🐰 \n` +
          `Hỗ trợ quản trị và tự động hóa Zalo.\n`+
          `📩 Liên hệ Bùi Quang Dũng để được hỗ trợ.\n`,
      },
      senderId,
      MessageType.DirectMessage
    );
    for (const userId of admins) {
      if (userId != idBot) {
        await api.sendBusinessCard(null, userId, null, MessageType.DirectMessage, senderId);
      }
    }
    return true;
  }
  return false;
}

schedule.scheduleJob("*/1 * * * *", () => {
  const currentTime = Date.now();
  for (const [userId, lastTime] of userLastMessageTime.entries()) {
    if (currentTime - lastTime > 60000) {
      userLastMessageTime.delete(userId);
    }
  }
  for (const [userId, lastTime] of lastBusinessCardTime.entries()) {
    if (currentTime - lastTime > BUSINESS_CARD_COOLDOWN) {
      lastBusinessCardTime.delete(userId);
    }
  }
  checkDisableProphylacticConfig();
});

export async function messagesUser(api, message) {
  const senderId = message?.data?.uidFrom || '';
  const threadId = message?.threadId || '';
  let content = message?.data?.content || '';
  const isPlainText = typeof message.data.content === "string";
  const senderName = message?.data?.dName || '';
  let isAdminLevelHighest = false;
  let isAdminBot = false;
  isAdminLevelHighest = isAdmin(senderId);
  isAdminBot = isAdmin(senderId, threadId);
  const idBot = getBotId();
  const io = getIO();
  let isSelf = idBot === senderId;
  const contentText = isPlainText
    ? content
    : content.href
      ? "Caption: " + content.title + "\nLink: " + content.href
      : content.catId
        ? "Sticker ID: " + content.id + " | " + content.catId + " | " + content.type
        : null;

  if (!message || !message.data || !threadId || !senderId) {
    return;
  }

  const testResult = handleIntegratedTestCommand(contentText, {
    prefix: getGlobalPrefix(),
    memberCount: 0,
    isAdmin: isAdminLevelHighest || isAdminBot,
    threadId,
  });
  if (testResult) {
    await api.sendMessage(
      { msg: JSON.stringify(testResult, null, 2), quote: message },
      threadId,
      message.type
    );
    return;
  }

  switch (message.type) {
    case MessageType.DirectMessage: {
      if (contentText && contentText.toLowerCase().startsWith("uid")) 
        api.sendMessage({msg: senderId, ttl: 60000, quote: message}, threadId, message.type);
      
      if (getConnectedClientsCount() > 0) {
        const userInfo = await api.getGroupMembers([senderId + "_0"]);
        pushMessageToWebLog(io, "Tin Nhắn Riêng Tư", senderName, content, userInfo?.profiles?.[senderId]?.avatar || '');
      }
      if (contentText) {
        const logMessage = `Có Mesage Riêng tư mới:
              - Sender Name: [ ${senderName} ] | ID: ${threadId}
              - Content: ${contentText}\n`;
        logMessageToFile(logMessage);
      }
      if (isPlainText) {
        let continueProcessingChat = true;
        continueProcessingChat = !isUserBlocked(senderId);
        continueProcessingChat = continueProcessingChat && (await canReplyToUser(senderId));
        continueProcessingChat = continueProcessingChat && !(await handleOnReplyFromUser(api, message));
        if (continueProcessingChat) {
          const commandResult = await handleCommandPrivate(api, message);
          continueProcessingChat = continueProcessingChat && commandResult === 1 && !isSelf;
          continueProcessingChat =
            continueProcessingChat && !(!isSelf && (await checkAndSendBusinessCard(api, senderId, senderName)));
        }
      }
      break;
    }
    case MessageType.GroupMessage: {
      let groupAdmins = [];
      let nameGroup = "";
      let isAdminBox = false;
      let botIsAdminBox = false;
      let groupInfo = {};
      if (threadId) {
        groupInfo = await getGroupInfoData(api, threadId);
        groupAdmins = await getGroupAdmins(groupInfo);
        botIsAdminBox = groupAdmins.includes(idBot.toString());
        nameGroup = groupInfo?.name || '';
        isAdminBox = isAdmin(senderId, threadId, groupAdmins);
      }

      if (contentText) {
        const logMessage = `Có Mesage nhóm mới:
              - Tên Nhóm: ${nameGroup} | Group ID: ${threadId}
              - Người Gửi: ${senderName} | Sender ID: ${senderId}
              - Nội Dung: ${contentText}\n`;
        logMessageToFile(logMessage);
      }

      const groupSettings = readGroupSettings();
      initGroupSettings(groupSettings, threadId, nameGroup);
      if (getConnectedClientsCount() > 0) {
        pushMessageToWebLog(io, nameGroup, senderName, content, groupInfo?.avt || '');
      }

      if (!isSelf) {
        if (threadId == "6456980305260228374") {
          await testFutureGroup(api, message, groupInfo);
        }
        updateUserRank(threadId, senderId, message.data.dName, nameGroup);
      }

      let handleChat = true;
      handleChat = !(await handleMute(api, message, groupSettings, isAdminBox, botIsAdminBox, isSelf));
      handleChat = handleChat && !(await antiBadWord(api, message, groupSettings, isAdminBox, botIsAdminBox, isSelf));
      handleChat = handleChat && !(await superCheckBox(api, message, isSelf, botIsAdminBox, isAdminBox, groupSettings));
      handleChat = handleChat && !isUserBlocked(senderId);
      const numberHandleCommand = await handleCommand(
        api,
        message,
        groupInfo,
        groupAdmins,
        groupSettings,
        isAdminLevelHighest,
        isAdminBot,
        isAdminBox,
        handleChat
      );
      if (isPlainText) {
        handleChat = handleChat && groupSettings[threadId]?.activeBot === true;
        handleChat = handleChat && !isSelf;
        if (handleChat || (!isSelf && isAdminBot)) {
          await handleOnChatUser(api, message, numberHandleCommand === 5, groupSettings, groupInfo);
        }
        if (handleChat || isAdminBot) {
          handleChat = await handleOnReplyFromUser(
            api,
            message,
            groupInfo,
            groupAdmins,
            groupSettings,
            isAdminLevelHighest,
            isAdminBot,
            isAdminBox,
            handleChat || isAdminBot
          );
        }
        if (!isSelf) {
          await handleChatBot(api, message, threadId, groupSettings, nameGroup, numberHandleCommand === 2);
        }
      }

      if (!message || !message.data || !threadId || !senderId) {
        return;
      }

      await Promise.all([
        antiNotText(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf),
        antiLink(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf),
        antiNude(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf),
        antiTag(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf),
        antiPhoneNumber(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf),
        antiForward(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf),
        superCheckBox(api, message, isSelf, botIsAdminBox, isAdminBox, groupSettings),
        antiEffectSticker(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf),
        antiAllEffectSticker(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf),
        handleAutoReplyGemini(api, message, groupSettings, isSelf),
        handleDownloadZalo(api, message, groupSettings, isSelf),
        antiBotCheck(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf),
        enforceAntiPhotoVideo(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf),
        enforceAntiVoice(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf),
        enforceAntiText(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf),
        enforceAntiFile(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf),
        antiJoinLeave(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf),
        handleAutoJoin(api, message, groupSettings, botIsAdminBox, isSelf),
      ]);
      break;
    }
  }
}