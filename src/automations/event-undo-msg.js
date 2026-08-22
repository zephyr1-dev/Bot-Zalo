import { initGroupSettings } from "../commands/command.js";
import { getBotId, isAdmin } from "../index.js";
import { antiUndoGroup } from "../service-debug/anti-service/anti-undo.js";
import { getGroupAdmins, getGroupInfoData } from "../service-debug/info-service/group-info.js";
import { readGroupSettings } from "../utils/io-json.js";

export async function undoMessageEvents(api, undo) {
  const threadId = undo.data.idTo;
  const senderId = undo.data.uidFrom;
  const isAdminLevelHighest = isAdmin(senderId);
  const isAdminBot = isAdmin(senderId, threadId);
  const idBot = getBotId();
  let isSelf = idBot === senderId;
  const isGroup = undo.isGroup;

  if (isGroup) {
    const groupInfo = await getGroupInfoData(api, threadId);
    const groupAdmins = await getGroupAdmins(groupInfo);
    const botIsAdminBox = groupAdmins.includes(idBot.toString());
    const groupSettings = readGroupSettings();
    initGroupSettings(groupSettings, threadId, groupInfo.name);

    await antiUndoGroup(api, undo, isAdminLevelHighest, groupSettings, botIsAdminBox, isSelf);
  }
}
