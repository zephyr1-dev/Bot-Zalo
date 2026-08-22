import {
  sendMessageFromSQL,
  sendMessageWarningRequest,
} from "../../../service-debug/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../../service-debug/service.js";
import { removeMention } from "../../../utils/format-util.js";

export async function handleJoinLeaveGroup(api, message) {
  const prefix = getGlobalPrefix();
  const content = removeMention(message);

  const commandParts = content.split(" ");
  const linkJoin = commandParts[1];
  const iterations = parseInt(commandParts[2]);

  if (!linkJoin || isNaN(iterations) || iterations < 1) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Cú pháp: ${prefix}spamjoin [link] [số lần]\n`,
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
        message: `Link này không tồn tại nhóm/cộng đồng nào!`,
      },
      true,
      30000
    );
    return;
  }

  if (!groupInfo) return;

  let successfulIterations = 0; 
  let approvalErrors = 0; 
  let otherErrors = 0; 

  try {
    for (let i = 0; i < iterations; i++) {
      let joinedSuccessfully = false; 
      try {
        await api.joinGroup(linkJoin);
        joinedSuccessfully = true;
        //console.log(`Lần ${i + 1}: Tham gia nhóm "${groupInfo.name}" thành công`);
      } catch (error) {
        //console.log(`Lần ${i + 1}: Lỗi khi tham gia nhóm: ${error.message}`);
        if (error.message.includes("Waiting for approve")) {
          approvalErrors++;
          continue; 
        } else if (error.message.includes("đã là thành viên")) {
          joinedSuccessfully = true;
        } else {
          otherErrors++;
          continue; 
        }
      }
      await new Promise(resolve => setTimeout(resolve, 0.00001));
      if (joinedSuccessfully) {
        try {
          await api.leaveGroup(groupInfo.groupId);
          successfulIterations++;
          //console.log(`Lần ${i + 1}: Rời nhóm "${groupInfo.name}" thành công`);
        } catch (error) {
          //console.log(`Lần ${i + 1}: Lỗi khi rời nhóm: ${error.message}`);
          otherErrors++;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 0.00001));
    }
    let messageContent = `Hoàn thành ${successfulIterations} lần join và leave nhóm "${groupInfo.name}"!`;
    // if (successfulIterations < iterations) {
    //   messageContent += `\nLưu ý: ${iterations - successfulIterations} lần thất bại`;
    //   if (approvalErrors > 0) {
    //     messageContent += ` (${approvalErrors} lần do nhóm yêu cầu duyệt thành viên)`;
    //   }
    //   if (otherErrors > 0) {
    //     messageContent += ` (${otherErrors} lần do lỗi khác, kiểm tra log để biết thêm)`;
    //   }
    // }
    await sendMessageFromSQL(
      api,
      message,
      {
        success: true,
        message: messageContent,
      },
      true,
      60000
    );
  } catch (error) {
    console.log(`Lỗi không xác định: ${error.message}`);
    await sendMessageWarningRequest(
      api,
      message,
      {
        caption: `Lỗi không xác định: ${error.message}`,
      },
      60000
    );
  }
}