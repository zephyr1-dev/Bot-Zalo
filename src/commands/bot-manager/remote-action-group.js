import schedule from "node-schedule";
import {
  sendMessageCompleteRequest,
  sendMessageFromSQL,
  sendMessageResultRequest,
  sendMessageWarningRequest,
} from "../../service-debug/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../service-debug/service.js";
import { getDataAllGroup } from "../../service-debug/info-service/group-info.js";
import { getUserInfoData } from "../../service-debug/info-service/user-info.js";
import { removeMention } from "../../utils/format-util.js";
import { handleCommand } from "../command.js";
import { getBotId } from "../../index.js";
import { MessageType } from "../../api-zalo/index.js";

const requestJoinGroupMap = new Map();
const waitingActionGroupMap = new Map();
const waitingActionJoinGroup = 30000;
const timeOutWaitingActionGroup = 60000;

schedule.scheduleJob("*/5 * * * * *", () => {
  const currentTime = Date.now();
  for (const [msgId, data] of requestJoinGroupMap.entries()) {
    if (currentTime - data.timestamp > waitingActionJoinGroup) {
      requestJoinGroupMap.delete(msgId);
    }
  }
  for (const [msgId, data] of waitingActionGroupMap.entries()) {
    if (currentTime - data.timestamp > timeOutWaitingActionGroup) {
      waitingActionGroupMap.delete(msgId);
    }
  }
});

export async function handleJoinGroup(api, message) {
  const prefix = getGlobalPrefix();
  const content = removeMention(message);

  const commandParts = content.split(" ");
  const linkJoin = commandParts[1];

  if (!linkJoin) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Cú pháp tham gia nhóm thông qua link:\n${prefix}join [link]`,
      },
      false,
      30000
    );
    return;
  }

  let groupInfo = null;
  try {
    groupInfo = await api.getGroupInfoByLink(linkJoin);
  } catch (error) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Link này đếch tồn tại nhóm/cộng đồng nào!`,
      },
      true,
      30000
    );
    return;
  }

  if (!groupInfo) return;

  const typeGroup = groupInfo.type === 2 ? "Cộng đồng" : "Nhóm";

  const msgResponse = await sendMessageCompleteRequest(
    api,
    message,
    {
      caption:
        `Tên ${typeGroup}: ${groupInfo.name}\nMô tả: ${groupInfo.desc || "Không có mô tả"
        }\nTổng số thành viên: ${groupInfo.totalMember}` +
        `\n\nXác nhận tham gia ${typeGroup} bằng cách thả reaction like hoặc heart!`,
    },
    waitingActionJoinGroup
  );

  const msgId = msgResponse.message.msgId.toString();

  requestJoinGroupMap.set(msgId, {
    message,
    timestamp: Date.now(),
    groupInfo,
    linkJoin,
  });
}

export async function handleReactionConfirmJoinGroup(api, reaction) {
  const msgId = reaction.data.content.rMsg[0].gMsgID.toString();
  const data = requestJoinGroupMap.get(msgId);
  if (!data) return false;
  const senderId = reaction.data.uidFrom;
  if (senderId !== data.message.data.uidFrom) return false;

  const rType = reaction.data.content.rType;
  if (rType !== 3 && rType !== 5) return false;

  const message = data.message;
  requestJoinGroupMap.delete(msgId);
  // const msgUndo = {
  //   data: {
  //     quote: {
  //       cliMsgId: reaction.data.content.rMsg[0].cMsgID,
  //       globalMsgId: reaction.data.content.rMsg[0].gMsgID,
  //     },
  //   },
  //   type: message.type,
  //   threadId: reaction.data.idTo,
  // };
  // await api.undoMessage(msgUndo);

  try {
    await api.joinGroup(data.linkJoin);
    await sendMessageFromSQL(
      api,
      message,
      {
        success: true,
        message: `Bố đã tham gia vào nhóm thành công!`,
      },
      true,
      180000
    );
  } catch (error) {
    if (error.message.includes("Waiting for approve")) {
      await sendMessageWarningRequest(
        api,
        message,
        {
          caption: `Bố đã gửi yêu cầu tham gia nhóm này và đang chờ chủ nhóm phê duyệt!`,
        },
        180000
      );
    }
    if (error.message.includes("đã là thành viên")) {
      await sendMessageWarningRequest(
        api,
        message,
        {
          caption: `Bố đã là thành viên của nhóm này!`,
        },
        180000
      );
    }
    if (error.message.includes("chặn tham gia nhóm")) {
      await sendMessageWarningRequest(
        api,
        message,
        {
          caption: `Bố đã bị chặn tham gia nhóm này!`,
        },
        180000
      );
    }
  }
  return true;
}

export async function handleLeaveGroup(api, message) {
  const threadId = message.threadId;
  try {
    await sendMessageResultRequest(api, MessageType.GroupMessage, threadId, "Bai mấy cu, bố đi đây!!!", true, 30000);
    await api.leaveGroup(threadId);
  } catch (error) {
    console.error("Lỗi khi rời nhóm:", error);
    await sendMessageResultRequest(api, MessageType.GroupMessage, threadId, "Có lỗi xảy ra, không rời nhóm được!", true, 30000);
  }
}
export async function handleShowGroupsList(api, message, aliasCommand) {
  const prefix = getGlobalPrefix();
  const content = removeMention(message);

  const command = content.replace(`${prefix}${aliasCommand}`, "").trim();
  try {
    const groups = await getDataAllGroup(api);
    let filteredGroups;
    if (!command) {
      filteredGroups = groups;
    } else {
      filteredGroups = groups.filter((group) =>
        group.name.toUpperCase().includes(command.toUpperCase())
      );
    }
    if (!filteredGroups.length) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Đếch tìm thấy nhóm nào có tên chứa "${command}"!`,
        },
        false,
        30000
      );
      return;
    }

    const CHUNK_SIZE = 30;
    const chunks = [];
    
    for (let i = 0; i < filteredGroups.length; i += CHUNK_SIZE) {
      const chunk = filteredGroups.slice(i, i + CHUNK_SIZE);
      chunks.push(chunk);
    }

    for (const [chunkIndex, groupChunk] of chunks.entries()) {
      let contentMessage = chunkIndex === 0 ? 
        `Danh sách nhóm:\n\n` :
        `(Tiếp theo)\n\n`;

      for (const [index, group] of groupChunk.entries()) {
        const owner = await getUserInfoData(api, group.creatorId);
        const actualIndex = chunkIndex * CHUNK_SIZE + index + 1;
        contentMessage +=
          `${actualIndex}. ${group.name} (${group.totalMember} thành viên)\n` +
          ` - Trưởng nhóm: ${owner.name}\n\n`;
      }

      if (chunkIndex === chunks.length - 1) {
        contentMessage += `Reply tin nhắn này với số index và "->" + cú pháp liên quan đến hành động mà Đại Ca muốn tôi thực hiện cho danh sách bên trên!`;
      }

      const msgResponse = await sendMessageCompleteRequest(
        api,
        message,
        {
          caption: contentMessage,
        },
        timeOutWaitingActionGroup
      );

      if (chunkIndex === chunks.length - 1) {
        const msgId = msgResponse.message.msgId.toString();
        waitingActionGroupMap.set(msgId, {
          message,
          timestamp: Date.now(),
          groups: filteredGroups,
        });
      }
    }
  } catch (error) {
    console.error(error);
  }
}

export async function handleActionGroupReply(
  api,
  message,
  groupInfo,
  groupAdmins,
  groupSettings,
  isAdminLevelHighest,
  isAdminBot,
  isAdminBox,
  handleChat
) {
  const senderName = message.data.dName;
  const prefix = getGlobalPrefix();
  const senderId = message.data.uidFrom;
  let content = removeMention(message);
  try {
    if (!message.data.quote || !message.data.quote.globalMsgId || !content)
      return false;

    const quotedMsgId = message.data.quote.globalMsgId.toString();
    if (!waitingActionGroupMap.has(quotedMsgId)) return false;
    const dataReply = waitingActionGroupMap.get(quotedMsgId);
    if (dataReply.message.data.uidFrom !== senderId) return false;

    const commandParts = content.split("->");
    if (commandParts.length !== 2) return false;
    const index = parseInt(commandParts[0]);
    if (isNaN(index)) {
      const object = {
        caption: `Lựa chọn Không hợp lệ. Vui lòng chọn một số từ danh sách.`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return true;
    }
    const action = commandParts[1];
    if (action && !action.startsWith(prefix)) {
      return false;
    }

    if (index < 1 || index > dataReply.groups.length) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Số index Không hợp lệ!`,
        },
        false,
        30000
      );
      return false;
    }
    if (!action) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Vui lòng nhập hành động cần thực hiện!`,
        },
        false,
        30000
      );
      return false;
    }
    const group = dataReply.groups[index - 1];
    switch (action) {
      default:
        const idHere = message.threadId;
        message.threadId = group.groupId;
        message.data.content = action;
        message.data.mentions = [];
        const numHandleCommand = await handleCommand(
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
        message.threadId = idHere;
        if (numHandleCommand === 1 || numHandleCommand === 2 || numHandleCommand === 3 || numHandleCommand === 5) {
          const result = {
            success: true,
            message: `Đã thực hiện hành động "${action}" trong nhóm "${group.name}"!`,
          };
          await sendMessageFromSQL(api, message, result, true, 60000);
        }
        break
    }
    return true;
  } catch (error) {
    console.error(error);
  }
}
