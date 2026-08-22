import schedule from "node-schedule";
import { MessageType, GroupEventType } from "zlbotdqt";
import { isInWhiteList } from "./white-list.js";
import { sendMessageStateQuote } from "../chat-zalo/chat-style/chat-style.js";
import { removeMention } from "../../utils/format-util.js";
import { writeGroupSettings } from "../../utils/io-json.js";
import { getUserInfoData } from "../../service-debug/info-service/user-info.js";
import { getGroupInfoData } from "../../service-debug/info-service/group-info.js";
import * as cv from "../../utils/canvas/index.js";

const lock = { isLocked: false };
const massActionTracker = new Map();
const kickedUsers = new Set();
const MASS_ACTION_THRESHOLD = 5;
const MASS_ACTION_TIMEFRAME = 100000;

async function withLock(fn) {
  while (lock.isLocked) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  lock.isLocked = true;
  try {
    return await fn();
  } finally {
    lock.isLocked = false;
  }
}

export async function antiKickBlock(
  api,
  event,
  isAdminBox,
  groupSettings,
  botIsAdminBox,
  isSelf,
  userId,
  actionType
) {
  try {
    if (event.data.msgType === "webchat") {
      return false;
    }

    const senderId = (event.data.sourceId === event.data.idBot && event.data.creatorId)
      ? event.data.creatorId
      : (userId || event.data.sourceId || event.data.actorId);
    const senderName = event.data.actorName || event.data.dName || "Không xác định";
    const threadId = event.threadId;
    const timestamp = Number(event.data.ts || event.data.timestamp || Date.now());

    if (!senderId || !threadId || !actionType) {
      return false;
    }

    if (
      isAdminBox ||
      kickedUsers.has(senderId) ||
      isSelf ||
      !botIsAdminBox ||
      isInWhiteList(groupSettings, threadId, senderId)
    ) {
      return false;
    }

    if (!groupSettings[threadId]?.antiKickBlock) {
      return false;
    }

    return await withLock(async () => {
      const actionKey = `${senderId}_${threadId}_${actionType}`;
      const currentTime = Date.now();

      if (!massActionTracker.has(actionKey)) {
        massActionTracker.set(actionKey, { count: 1, timestamp: currentTime });
      } else {
        const actionData = massActionTracker.get(actionKey);
        if (currentTime - actionData.timestamp < MASS_ACTION_TIMEFRAME) {
          actionData.count += 1;
          if (actionData.count > MASS_ACTION_THRESHOLD) {
            await api.blockUsers(threadId, [senderId]).catch(() => {});
            kickedUsers.add(senderId);
            await handleMassActionDetected(api, event, threadId, senderId, senderName, actionType);
            return true;
          }
        } else {
          massActionTracker.set(actionKey, { count: 1, timestamp: currentTime });
        }
      }

      return false;
    });
  } catch (error) {
    return false;
  }
}

async function handleMassActionDetected(api, event, threadId, senderId, senderName, actionType) {
  try {
    const groupInfo = await getGroupInfoData(api, threadId);
    const userInfo = await getUserInfoData(api, senderId);
    let imagePath = null;
    const actionText = actionType === GroupEventType.REMOVE_MEMBER ? "kick" : "chặn";

    try {
      imagePath = await cv.createBlockImage(
        userInfo,
        groupInfo.name,
        groupInfo.groupType,
        userInfo.genderId,
        senderName,
        true
      ).catch(() => null);

      await api.sendMessage(
        {
          msg: `Mày làm trò gì khó coi vậy, cút...!!!`,
          attachments: imagePath ? [imagePath] : [],
          ttl: 3600000,
        },
        threadId,
        MessageType.GroupMessage
      ).catch(() => {});

      await api.sendMessage(
        {
          msg: ``,
          attachments: imagePath ? [imagePath] : [],
          ttl: 3600000,
        },
        senderId,
        MessageType.DirectMessage
      ).catch(() => {});
    } catch (error) {
    } finally {
      if (imagePath) {
        await cv.clearImagePath(imagePath).catch(() => {});
      }
    }

    setTimeout(() => {
      kickedUsers.delete(senderId);
      massActionTracker.delete(`${senderId}_${threadId}_${actionType}`);
    }, 5000);
  } catch (error) {}
}

schedule.scheduleJob("*/10 * * * * *", () => {
  const currentTime = Date.now();
  for (const [actionKey, actionData] of massActionTracker.entries()) {
    if (currentTime - actionData.timestamp > MASS_ACTION_TIMEFRAME) {
      massActionTracker.delete(actionKey);
    }
  }
});

export async function handleAntiKickBlockCommand(api, message, groupSettings) {
  try {
    const threadId = message.threadId;
    const content = removeMention(message);
    const status = content.split(" ")[1];

    if (!groupSettings[threadId]) {
      groupSettings[threadId] = { antiKickBlock: false };
    }

    let newStatus;
    if (status === "on") {
      groupSettings[threadId].antiKickBlock = true;
      newStatus = "bật";
    } else if (status === "off") {
      groupSettings[threadId].antiKickBlock = false;
      newStatus = "tắt";
    } else {
      groupSettings[threadId].antiKickBlock = !groupSettings[threadId].antiKickBlock;
      newStatus = groupSettings[threadId].antiKickBlock ? "bật" : "tắt";
    }

    await sendMessageStateQuote(
      api,
      message,
      `Chức năng chống kick/block hàng loạt đã được ${newStatus}!`,
      groupSettings[threadId].antiKickBlock,
      300000
    ).catch(() => {});

    writeGroupSettings(groupSettings);
    return true;
  } catch (error) {
    return false;
  }
}