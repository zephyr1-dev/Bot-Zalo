import { MessageType } from "zlbotdqt";
import { isAdmin } from "../../index.js";
import {
  sendMessageComplete,
  sendMessageQuery,
  sendMessageWarning,
} from "../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../service.js";
import { removeMention } from "../../utils/format-util.js";

export async function handleWhiteList(api, message, groupSettings, groupAdmins) {
  const threadId = message.threadId;
  const content = removeMention(message);
  const prefix = getGlobalPrefix();
  const parts = content.split(" ");
  const command = parts[1];
  let isChangeSetting = false;

  if (!command || (command !== "add" && command !== "remove")) {
    if (Object.keys(groupSettings[threadId].whiteList || {}).length === 0) {
      await sendMessageWarning(
        api,
        message,
        "Hiện Không có người dùng nào trong danh sách white-list."
      );
      return isChangeSetting;
    }

    let whiteListMessage = "Danh sách người dùng trong white-list:\n";
    const idWhiteList = Object.keys(groupSettings[threadId].whiteList).map(id => `${id}_0`);
    const whiteListInfo = await api.getGroupMembers(idWhiteList);
    const whiteListUsers = idWhiteList
      .map((id, index) => {
        const userId = id.split('_')[0];
        const profile = whiteListInfo.profiles[userId];
        return `${index + 1}. ${profile.zaloName}`;
      })
      .join("\n");

    whiteListMessage += whiteListUsers;

    await api.sendMessage(
      { msg: whiteListMessage, quote: message, ttl: 300000 },
      threadId,
      message.type
    );
    return isChangeSetting;
  }

  const mentions = message.data.mentions;
  
  if (command === "remove") {
    const indexToRemove = parseInt(parts[2]);
    if (!isNaN(indexToRemove)) {
      const whiteList = groupSettings[threadId].whiteList || {};
      const whiteListArray = Object.entries(whiteList);
      
      if (indexToRemove > 0 && indexToRemove <= whiteListArray.length) {
        const [userId, userInfo] = whiteListArray[indexToRemove - 1];
        delete groupSettings[threadId].whiteList[userId];
        await sendMessageComplete(
          api,
          message,
          `Đã xóa ${userInfo.name} khỏi danh sách white-list.`
        );
        return true;
      } else {
        await sendMessageWarning(
          api,
          message,
          `Số thứ tự Không hợp lệ. Vui lòng chọn số từ 1 đến ${whiteListArray.length}.`
        );
        return false;
      }
    }
  }

  if (!mentions || mentions.length === 0) {
    await sendMessageQuery(
      api,
      message,
      "Vui lòng đề cập (@mention) người dùng hoặc nhập số thứ tự để thêm/xóa khỏi white-list."
    );
    return isChangeSetting;
  }

  if (!groupSettings[threadId].whiteList) {
    groupSettings[threadId].whiteList = {};
  }

  for (const mention of mentions) {
    const userId = mention.uid;
    const userName = message.data.content
      .substr(mention.pos, mention.len)
      .replace("@", "");

    if (command === "add") {
      if (isAdmin(userId, threadId)) {
        await sendMessageWarning(
          api,
          message,
          `${userName} đã là quản trị viên nên Không cần thêm vào white-list`
        );
        continue;
      }

      if (!groupSettings[threadId].whiteList[userId]) {
        groupSettings[threadId].whiteList[userId] = {
          name: userName,
        };
        await sendMessageComplete(
          api,
          message,
          `Đã thêm ${userName} vào danh sách white-list.`
        );
        isChangeSetting = true;
      } else {
        await sendMessageWarning(
          api,
          message,
          `${userName} đã có trong danh sách white-list.`
        );
      }
    } else if (command === "remove") {
      if (groupSettings[threadId].whiteList[userId]) {
        const userName = groupSettings[threadId].whiteList[userId].name;
        delete groupSettings[threadId].whiteList[userId];
        await sendMessageComplete(
          api,
          message,
          `Đã xóa ${userName} khỏi danh sách white-list.`
        );
        isChangeSetting = true;
      } else {
        await sendMessageWarning(
          api,
          message,
          `${userName} Không có trong danh sách white-list.`
        );
      }
    }
  }

  return isChangeSetting;
}

export function isInWhiteList(groupSettings, threadId, senderId) {
  const whiteList = groupSettings[threadId]?.whiteList || {};
  return whiteList[senderId];
}

