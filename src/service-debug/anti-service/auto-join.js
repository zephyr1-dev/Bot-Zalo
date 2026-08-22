import schedule from "node-schedule";
import { MessageMention, MessageType } from "zlbotdqt";
import { getBotId } from "../../index.js";
import { sendMessageStateQuote, sendMessageCompleteRequest } from "../chat-zalo/chat-style/chat-style.js";
import { getGroupInfoData } from "../info-service/group-info.js";
import { getUserInfoData } from "../info-service/user-info.js";
import { isInWhiteList } from "./white-list.js";
import { removeMention } from "../../utils/format-util.js";
import { scanQRCode } from "../utilities/qr-scan.js";
import { performance } from 'perf_hooks';
const requestAutoJoinMap = new Map();
const waitingActionJoinGroup = 30000;
schedule.scheduleJob("*/5 * * * * *", () => {
  const currentTime = Date.now();
  for (const [msgId, data] of requestAutoJoinMap.entries()) {
    if (currentTime - data.timestamp > waitingActionJoinGroup) {
      requestAutoJoinMap.delete(msgId);
    }
  }
});
function normalizeLink(link) {
  if (!link) return null;
  const normalized = link.replace(/[\s\u200B-\u200D\uFEFF]/g, '')
                        .replace(/[^\w\-.:\/]/g, '')
                        .toLowerCase();
  if (normalized.includes('zaloapp.com/qr/g/')) {
    const groupId = normalized.match(/zaloapp\.com\/qr\/g\/([a-z0-9]+)/)?.[1];
    return groupId ? `https://zalo.me/g/${groupId}` : null;
  }
  return normalized;
}
async function processJoinLink(api, message, link, threadId, senderId, senderName) {
   const normalizedLink = normalizeLink(link);
   if (!normalizedLink || !normalizedLink.includes('zalo.me/g/')) {
     return false;
   }
   try {
     await api.joinGroup(normalizedLink);
     await sendMessageStateQuote(api, message, "Đã tham gia nhóm thành công!", true, 180000);
     return true;
   } catch (error) {
     if (error.message.includes("Waiting for approve")) {
       const caption = "Đã gửi yêu cầu tham gia nhóm, đang chờ phê duyệt!";
       await sendMessageCompleteRequest(
         api,
         message,
         { caption },
         180000
       );
     }
     return false;
   }
 }
export async function handleAutoJoin(api, message, groupSettings, botIsAdminBox, isSelf) {
  const startTime = performance.now();
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const threadId = message.threadId;
  if (isSelf ) {
    return false;
  }
  const isUserWhiteList = isInWhiteList(groupSettings, threadId, senderId);
  if (isUserWhiteList) {
    return false;
  }

  if (!groupSettings[threadId]?.autoJoin) {
    return false;
  }

  let link = null;
  if (message.data.msgType === "chat.recommended") {
    link = message.data.content?.href;
  } else if (message.data.msgType === "chat.photo") {
    const linkImage = message.data?.content?.href;
    if (linkImage) {
      const result = await scanQRCode(linkImage);
      if (result.success) {
        link = result.data.content;
      }
    }
  } else if (typeof message.data.content === 'string') {
    const content = message.data.content.trim();
    const links = content.match(/(?:https?:\/\/|www\.)[^\s/$.?#].[^\s]*|\b[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/gi) || [];
    link = links.find(l => l.includes('zalo.me/g/') || l.includes('zaloapp.com/qr/g/'));
  }

  if (link) {
    await processJoinLink(api, message, link, threadId, senderId, senderName);
    return true;
  }

  return false;
}

export const handleAutoJoinCommand = async (api, message, groupSettings) => {
   const { threadId } = message;
   if (!groupSettings[threadId]) groupSettings[threadId] = {};
   const newStatus = !groupSettings[threadId].autoJoin;
   groupSettings[threadId].autoJoin = newStatus;
   const statusText = newStatus ? "bật" : "tắt";
   const caption = newStatus ? "Xác nhận bật bằng cách thả reaction ❤️!" : "Chức năng tự động tham gia đã được tắt!";
   if (newStatus) {
     const msgResponse = await sendMessageCompleteRequest(api, message, { caption }, waitingActionJoinGroup);
     requestAutoJoinMap.set(msgResponse.message.msgId.toString(), { message, timestamp: Date.now(), action: "enable" });
   } else {
     await sendMessageStateQuote(api, message, caption, false, 30000);
   }
   return true;
 };
 export async function handleReactionConfirmAutoJoin(api, reaction) {
    const msgId = reaction.data.content.rMsg[0].gMsgID.toString();
    const data = requestAutoJoinMap.get(msgId);
    if (!data) return false;
    const senderId = reaction.data.uidFrom;
    if (senderId !== data.message.data.uidFrom) return false;
    const rType = reaction.data.content.rType;
    if (rType !== 5) return false;
    const message = data.message;
    const threadId = message.threadId;
    requestAutoJoinMap.delete(msgId);
    if (data.action === "enable") {
      if (!data.message.groupSettings) {
        data.message.groupSettings = {};
      }
      if (!data.message.groupSettings[threadId]) {
        data.message.groupSettings[threadId] = {};
      }
      data.message.groupSettings[threadId].autoJoin = true;
      await sendMessageStateQuote(api, message, "Chức năng tự động tham gia đã được bật!", true, 30000);
      return true;
    }
    return false;
  }