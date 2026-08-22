import { MessageMention, MessageType } from "zlbotdqt";
import { getBotId } from "../../index.js";
import { sendMessageStateQuote } from "../chat-zalo/chat-style/chat-style.js";
import { createBlockSpamLinkImage } from "../../utils/canvas/event-image.js";
import { clearImagePath } from "../../utils/canvas/index.js";
import { getGroupInfoData } from "../info-service/group-info.js";
import { getUserInfoData } from "../info-service/user-info.js";
import { isInWhiteList } from "./white-list.js";
import { removeMention } from "../../utils/format-util.js";

let stickerWarnings = {};
let stickerCooldown = {};

export async function antiAllEffectSticker(
  api,
  message,
  isAdminBox,
  groupSettings,
  botIsAdminBox,
  isSelf
) {
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const threadId = message.threadId;
  const content = message.data.content;

  if (
    isSelf ||
    isAdminBox ||
    !botIsAdminBox ||
    !groupSettings[threadId]?.allowSticker
  ) {
    return false;
  }

  const currentTime = Date.now();
  if (stickerCooldown[senderId] && currentTime - stickerCooldown[senderId] < 1000) {
    return false;
  }
  stickerCooldown[senderId] = currentTime;

  if (!content || typeof content !== "object") {
    return false;
  }

  const stickerId = content.id;
  const cateId = content.catId;
  if (!stickerId || !cateId) {
    return false;
  }

  const threshold = groupSettings[threadId]?.rules?.rule_stklag?.threshold || 3;
  let isDeleteSticker = false;

  try {
    const result = await api.deleteMessage(message, false);
    
    if (!result || result.status !== 0) {
      await api.sendMessage(
        {
          msg: `Nhờn với bố mày à ;!`,
          quote: message,
          ttl: 300000,
        },
        threadId,
        MessageType.GroupMessage
      );
      await blockAllUser(api, message, threadId, senderId, senderName);
      return true;
    }

    isDeleteSticker = true;
    await updateAllStickerWarnings(
      api,
      message,
      threadId,
      senderId,
      senderName,
      threshold
    );
  } catch (error) {
    await api.sendMessage(
      {
        msg: `Lỗi khi xóa sticker: ${error.message}`,
        ttl: 300000,
      },
      threadId,
      MessageType.GroupMessage
    );
    return false;
  }

  return isDeleteSticker;
}

export async function handleAntiAllEffectStickerCommand(api, message, groupSettings) {
  const threadId = message.threadId;
  const senderName = message.data.dName;
  const senderId = message.data.uidFrom;
  let isChangeSetting = false;
  const content = removeMention(message);
  const status = content.split(" ")[1]?.toLowerCase();
  if (!groupSettings[threadId]) {
    groupSettings[threadId] = {};
  }

  const newStatus =
    status === "on"
      ? true
      : status === "off"
        ? false
        : !groupSettings[threadId].allowSticker;
  groupSettings[threadId].allowSticker = newStatus;
  isChangeSetting = true;
  const statusText = newStatus ? "bật" : "tắt";
  const caption = `Chức năng xóa sticker đã được ${statusText}!`;
  await sendMessageStateQuote(api, message, caption, newStatus, 300000);
  return isChangeSetting;
}

async function blockAllUser(api, message, threadId, senderId, senderName) {
  try {
    await api.blockUsers(threadId, [senderId]);
    const groupInfo = await getGroupInfoData(api, threadId);
    const userInfo = await getUserInfoData(api, senderId);
    const imagePath = await createBlockSpamLinkImage(
      userInfo,
      groupInfo.name,
      groupInfo.groupType,
      userInfo.gender
    );

    await api.sendMessage(
      {
        msg: `Đã chặn ${senderName} vì gửi sticker!`,
        attachments: imagePath ? [imagePath] : [],
        quote: message,
        ttl: 300000,
      },
      threadId,
      MessageType.GroupMessage
    );

    await clearImagePath(imagePath);
  } catch (error) {
    // Handle error silently
  }
}

async function updateAllStickerWarnings(
  api,
  message,
  threadId,
  senderId,
  senderName,
  threshold
) {
  const currentTime = Date.now();
  if (!stickerWarnings[senderId]) {
    stickerWarnings[senderId] = [];
  }

  stickerWarnings[senderId] = stickerWarnings[senderId].filter(
    (time) => currentTime - time < 20 * 60 * 1000
  );
  stickerWarnings[senderId].push(currentTime);

  const warnCount = stickerWarnings[senderId].length;

  if (warnCount >= threshold) {
    try {
      await blockAllUser(api, message, threadId, senderId, senderName);
      stickerWarnings[senderId] = [];
    } catch (error) {
      // Handle error silently
    }
  } else {
    let caption = `⚠️ Cảnh cáo ${senderName}!\nỞ đây Đại Ca tao cấm gửi sticker`;
    if (warnCount === threshold - 1) {
      caption = `⚠️ Cảnh cáo ${senderName}!\nNgừng gửi sticker, trước khi bị kick!`;
    }

    await api.sendMessage(
      {
        msg: caption,
        mentions: [
          MessageMention(senderId, senderName.length, "⚠️ Cảnh cáo ".length),
        ],
        quote: message,
        ttl: 300000,
      },
      threadId,
      MessageType.GroupMessage
    );
  }
}