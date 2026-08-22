import { sendMessageStateQuote, sendMessageWarning } from "../../service-debug/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../service-debug/service.js";
import { removeMention } from "../../utils/format-util.js";

export async function handleWelcomeBye(api, message, groupSettings) {
  const content = removeMention(message);
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();
  const [command, option] = content.split(" ");
  let newStatus;
  if (option === "on") {
    newStatus = true;
  } else if (option === "off") {
    newStatus = false;
  } else if (!option) {
    const settingMap = {
      [`${prefix}welcome`]: 'welcomeGroup',
      [`${prefix}bye`]: 'byeGroup',
      [`${prefix}updategroup`]: 'updateGroup'
    };
    const settingKey = settingMap[command];
    if (!settingKey) {
      await sendMessageWarning(
        api,
        message,
        "Cú pháp không hợp lệ. Vui lòng sử dụng '!welcome', '!bye' hoặc '!updategroup' cùng với [on/off]"
      );
      return false;
    }
    newStatus = !groupSettings[threadId][settingKey];
  } else {
    await sendMessageWarning(
      api,
      message,
      "Cú pháp không hợp lệ..!"
    );
    return false;
  }

  const settingMap = {
    [`${prefix}welcome`]: 'welcomeGroup',
    [`${prefix}bye`]: 'byeGroup', 
    [`${prefix}updategroup`]: 'updateGroup'
  };
  
  const settingKey = settingMap[command];
  if (!settingKey) {
    await sendMessageWarning(api, message, "Lệnh không hợp lệ!");
    return false;
  }
  
  groupSettings[threadId][settingKey] = newStatus;
  const status = newStatus ? "bật" : "tắt";
  let featureName;
  
  switch(command) {
    case `${prefix}welcome`:
      featureName = "chào mừng thành viên mới";
      break;
    case `${prefix}bye`:
      featureName = "tạm biệt thành viên rời nhóm"; 
      break;
    case `${prefix}updategroup`:
      featureName = "thông báo cập nhật nhóm";
      break;
    default:
      featureName = "tính năng";
  }

  await sendMessageStateQuote(
    api, 
    message,
    `Đã ${status} chức năng ${featureName}!`,
    newStatus,
    300000
  );

  return true;
}

export async function handleApprove(api, message, groupSettings) {
  const content = removeMention(message);
  const threadId = message.threadId;
  const [command, option] = content.split(" ");
  let newStatus;
  if (option === "on") {
    newStatus = true;
  } else if (option === "off") {
    newStatus = false;
  } else if (!option) {
    newStatus = !groupSettings[threadId].memberApprove;
  } else {
    await sendMessageWarning(
      api,
      message,
      "Cú pháp Không hợp lệ. Vui lòng sử dụng '!approve [on/off]'."
    );
    return false;
  }

  groupSettings[threadId].memberApprove = newStatus;

  const status = newStatus ? "bật" : "tắt";
  await sendMessageStateQuote(api, message, `Đã ${status} chức năng tự động phê duyệt thành viên mới!`, newStatus, 300000);
  if (newStatus) {
    await api.handleGroupPendingMembers(threadId, true);
  }
  return true;
}