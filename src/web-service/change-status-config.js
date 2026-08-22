import { initGroupSettings } from "../commands/command.js";
import { sendMessageState } from "../service-debug/chat-zalo/chat-style/chat-style.js";
import { getSettingName } from "../service-debug/info-service/bot-info.js";
import { readGroupSettings, writeGroupSettings } from "../utils/io-json.js";

export const changeStatusConfig = async ({ api, groupId, groupName, command, isActive }) => {
  const groupSettings = readGroupSettings();
  initGroupSettings(groupSettings, groupId, groupName);

  switch (command) {
    case "activeBot":
      groupSettings[groupId].activeBot = isActive;
      break;
    case "antiSpam":
      groupSettings[groupId].antiSpam = isActive;
      break;
    case "filterBadWords":
      groupSettings[groupId].filterBadWords = isActive;
      break;
    case "removeLinks":
      groupSettings[groupId].removeLinks = isActive;
      break;
    case "learnEnabled":
      groupSettings[groupId].learnEnabled = isActive;
      break;
    case "replyEnabled":
      groupSettings[groupId].replyEnabled = isActive;
      break;
    case "onlyText":
      groupSettings[groupId].onlyText = isActive;
      break;
    case "memberApprove":
      groupSettings[groupId].memberApprove = isActive;
      break;
    case "welcomeGroup":
      groupSettings[groupId].welcomeGroup = isActive;
      break;
    case "byeGroup":
      groupSettings[groupId].byeGroup = isActive;
      break;
    case "activeGame":
      groupSettings[groupId].activeGame = isActive;
      break;
    case "antiNude":
      groupSettings[groupId].antiNude = isActive;
      break;
    case "antiUndo":
      groupSettings[groupId].antiUndo = isActive;
      break;
    case "sendTask":
      groupSettings[groupId].sendTask = isActive;
      break;
    case "sendtext":
      groupSettings[groupId].sendtext = isActive;
      break;
    case "sendstk":
      groupSettings[groupId].sendstk = isActive;
      break;
    case "atd":
      groupSettings[groupId].autodownload = isActive;
      break;      
    default:
      return;
  }
  writeGroupSettings(groupSettings);
  await sendStatusBot(api, groupId, command, isActive);
};

export async function sendStatusBot(api, threadId, command, newStatus) {
  const statusMessage = newStatus ? "được bật" : "bị tắt";
  const caption = `${getSettingName(command)} đã ${statusMessage} trong nhóm này.`;
  if (newStatus) {
    await sendMessageState(api, threadId, caption, true, 10000);
  } else {
    await sendMessageState(api, threadId, caption, false, 10000);
  }
}
