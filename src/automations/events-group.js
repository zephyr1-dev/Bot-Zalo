import { GroupEventType, MessageType } from "../api-zalo/models/index.js";
import { getUserInfoData } from "../service-debug/info-service/user-info.js";
import { readGroupSettings } from "../utils/io-json.js";
import { getBotId, isAdmin } from "../index.js";
import { getGroupAdmins, getGroupInfoData } from "../service-debug/info-service/group-info.js";
import * as cv from "../utils/canvas/index.js";
import { antiJoinLeave } from "../service-debug/anti-service/anti-join-leave.js";
import { antiKickBlock } from "../service-debug/anti-service/anti-kick-all.js";
import { handleMemberJoin } from "../commands/bot-manager/group-manage.js";

const blockedMembers = new Map();
const BLOCK_CHECK_TIMEOUT = 300;

async function sendGroupMessage(api, threadId, imagePath, messageText) {
  const message = messageText ? messageText : "";
  try {
    await api.sendMessage(
      {
        msg: message,
        attachments: imagePath ? [imagePath] : [],
        ttl: 3600000,
      },
      threadId,
      MessageType.GroupMessage
    );
  } catch (error) {}
}

export async function groupEvents(api, event) {
  try {
    const type = event.type;
    const { updateMembers } = event.data;
    const groupName = event.data.groupName;
    const threadId = event.threadId;
    const groupType = event.data.groupType;
    const idAction = event.data.sourceId;
    let groupInfo, groupAdmins, botIsAdminBox = false;
    const groupSettings = readGroupSettings();
    const threadSettings = groupSettings[threadId] || {};

    const idBot = getBotId();
    if (!idBot) {
      return;
    }

    if (updateMembers) {
      groupInfo = await getGroupInfoData(api, threadId);
      groupAdmins = await getGroupAdmins(groupInfo);
      botIsAdminBox = groupAdmins.includes(idBot.toString());
      const userActionInfo = await getUserInfoData(api, idAction);
      const userActionName = userActionInfo?.name || "Không xác định";

      if (type === GroupEventType.REMOVE_MEMBER && updateMembers.length > 1) {
        for (const user of updateMembers) {
          const userId = user.id;
          const isAdminBox = isAdmin(userId, threadId);
          const isSelf = userId === idBot;

          if (idBot !== idAction && idAction) {
            const isMassKick = await antiKickBlock(
              api,
              event,
              isAdminBox,
              groupSettings,
              botIsAdminBox,
              idBot === idAction,
              idAction,
              GroupEventType.REMOVE_MEMBER
            );
            if (isMassKick) {
              return;
            }
            if (!blockedMembers.has(userId)) {
              await new Promise((resolve) => setTimeout(resolve, BLOCK_CHECK_TIMEOUT));
              if (!blockedMembers.has(userId)) {
                const userInfo = await getUserInfoData(api, userId);
                const imagePath = await cv.createKickImage(
                  userInfo,
                  groupName,
                  groupType,
                  userInfo.genderId,
                  userActionName,
                  botIsAdminBox
                );
                if (imagePath) {
                  await sendGroupMessage(api, threadId, imagePath, "");
                  await cv.clearImagePath(imagePath).catch(() => {});
                }
              }
            }
          }
        }
      } else if (type === GroupEventType.JOIN && updateMembers.length > 1) {
        await handleMemberJoin(api, event);

        for (const user of updateMembers) {
          const userId = String(user.id);
          const isAdminBox = isAdmin(userId, threadId);
          const isSelf = userId === idBot;

          const isBlocked = await antiJoinLeave(
            api,
            event,
            isAdminBox,
            groupSettings,
            botIsAdminBox,
            isSelf,
            userId
          );

          if (!isBlocked && threadSettings.welcomeGroup) {
            const userInfo = await getUserInfoData(api, userId);
            const imagePath = await cv.createWelcomeImage(
              userInfo,
              groupName,
              groupType,
              userActionName
            );
            await sendGroupMessage(api, threadId, imagePath, "");
            await cv.clearImagePath(imagePath).catch(() => {});
          }
        }
      } else {
        const user = updateMembers[0];
        const userId = String(user.id);
        const userInfo = await getUserInfoData(api, userId);
        const isAdminBox = isAdmin(userId, threadId);
        let imagePath;
        let messageText = "";

        switch (type) {
          case GroupEventType.JOIN_REQUEST:
            if (threadSettings.memberApprove) {
              await api.handleGroupPendingMembers(threadId, true);
            }
            break;

          case GroupEventType.JOIN:
            await handleMemberJoin(api, event);

            groupInfo = await getGroupInfoData(api, threadId);
            groupAdmins = await getGroupAdmins(groupInfo);
            botIsAdminBox = groupAdmins.includes(idBot.toString());
            const isSelf = userId === idBot;

            const isBlocked = await antiJoinLeave(
              api,
              event,
              isAdminBox,
              groupSettings,
              botIsAdminBox,
              isSelf,
              userId
            );

            if (!isBlocked && threadSettings.welcomeGroup) {
              imagePath = await cv.createWelcomeImage(
                userInfo,
                groupName,
                groupType,
                userActionName,
                botIsAdminBox
              );
              if (imagePath) {
                await sendGroupMessage(api, threadId, imagePath, "");
                await cv.clearImagePath(imagePath).catch(() => {});
              }
            }
            break;

          case GroupEventType.LEAVE:
            groupInfo = await getGroupInfoData(api, threadId);
            groupAdmins = await getGroupAdmins(groupInfo);
            botIsAdminBox = groupAdmins.includes(idBot.toString());
            if (idBot !== idAction && threadSettings.byeGroup) {
              imagePath = await cv.createGoodbyeImage(userInfo, groupName, groupType, botIsAdminBox);
              if (imagePath) {
                await sendGroupMessage(api, threadId, imagePath, "");
                await cv.clearImagePath(imagePath).catch(() => {});
              }
            }
            break;

          case GroupEventType.REMOVE_MEMBER:
            groupInfo = await getGroupInfoData(api, threadId);
            groupAdmins = await getGroupAdmins(groupInfo);
            botIsAdminBox = groupAdmins.includes(idBot.toString());
            if (idBot !== idAction && idAction) {
              const isMassKick = await antiKickBlock(
                api,
                event,
                isAdminBox,
                groupSettings,
                botIsAdminBox,
                idBot === idAction,
                idAction,
                GroupEventType.REMOVE_MEMBER
              );
              if (isMassKick) {
                return;
              }
              if (!blockedMembers.has(userId)) {
                await new Promise((resolve) => setTimeout(resolve, BLOCK_CHECK_TIMEOUT));
                if (!blockedMembers.has(userId)) {
                  imagePath = await cv.createKickImage(
                    userInfo,
                    groupName,
                    groupType,
                    userInfo.genderId,
                    userActionName,
                    botIsAdminBox
                  );
                  if (imagePath) {
                    await sendGroupMessage(api, threadId, imagePath, "");
                    await cv.clearImagePath(imagePath).catch(() => {});
                  }
                }
              }
            }
            break;

          case GroupEventType.BLOCK_MEMBER:
            groupInfo = await getGroupInfoData(api, threadId);
            groupAdmins = await getGroupAdmins(groupInfo);
            botIsAdminBox = groupAdmins.includes(idBot.toString());
            if (idBot !== idAction && idAction) {
              const isMassBlock = await antiKickBlock(
                api,
                event,
                isAdminBox,
                groupSettings,
                botIsAdminBox,
                idBot === idAction,
                idAction,
                GroupEventType.BLOCK_MEMBER
              );
              if (isMassBlock) {
                return;
              }
              blockedMembers.set(userId, Date.now());
              imagePath = await cv.createBlockImage(
                userInfo,
                groupName,
                groupType,
                userInfo.genderId,
                userActionName,
                botIsAdminBox
              );
              setTimeout(() => {
                blockedMembers.delete(userId);
              }, 1000);
              if (imagePath) {
                await sendGroupMessage(api, threadId, imagePath, "");
                await cv.clearImagePath(imagePath).catch(() => {});
              }
            }
            break;

          default:
            return;
        }
      }
    } else {
      switch (type) {
        case GroupEventType.JOIN_REQUEST:
          if (threadSettings.memberApprove) {
            await api.handleGroupPendingMembers(threadId, true);
          }
          break;
      }
    }
  } catch (error) {}
}