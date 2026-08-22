import { MessageMention, Zalo, ZaloApiError } from "../api-zalo/index.js";
import { appContext } from "../api-zalo/context.js";
import { encodeAES, handleZaloResponse, request, makeURL, decodeAES } from "../api-zalo/utils.js";
import { getBotId } from "../index.js";
import { getUserInfoData } from "../service-debug/info-service/user-info.js";
import * as cv from "../utils/canvas/index.js";
import { deleteFile } from "../utils/util.js";
import { getRecentMessage } from "../commands/bot-manager/recent-message.js";


// export async function superCheckBox(api, message, isSelf, botIsAdminBox, isAdminBox) {
//   if (isSelf || isAdminBox || !botIsAdminBox) return false;
//   const threadId = message.threadId;
//   const senderName = message.data.dName;
//   const senderId = message.data.uidFrom;
//   const mentionsCount = message.data?.mentions?.length || 0;
//   const content = message.data.content || "";
//   const isHiddenTag = mentionsCount > 0 && content.trim().length === 0;

//   if (mentionsCount > 15 || isHiddenTag) {
//     const warningMessage = isHiddenTag 
//       ? `${senderName} Tag cái đầu buồi, cútttttttt!`
//       : `${senderName} Tag cái đầu buồi, cútttttttt!`;

//     try {
//       await api.sendMessage(
//         {
//           msg: warningMessage,
//           quote: message,
//           mentions: [MessageMention(senderId, senderName.length, 0)]
//         },
//         threadId,
//         message.type
//       );

//       await new Promise(resolve => setTimeout(resolve, 3000));
//       await api.blockUsers(threadId, [senderId]);
//       return true;
//     } catch (error) {
//       console.error("Không thể chặn người dùng:", error);
//       await api.sendMessage(
//         {
//           msg: `Lỗi: Không thể chặn ${senderName}. Vui lòng thử lại sau.`,
//           quote: message
//         },
//         threadId,
//         message.type
//       );
//       return false;
//     }
//   }

//   return false;
// }

export async function testFutureGroup(api, message, groupInfo) {
  const threadId = message.threadId;
  const content = message.data.content;
  const idBot = getBotId();
  try {
    await handleEncryptedMessage(api, message, threadId);
    const sentCount = await sendFriendRequestToGroupMembers(api, groupInfo, idBot, message);
  } catch (error) {
    await api.sendMessage(
      {
        msg: error.message,
        quote: message,
      },
      threadId,
      message.type
    );
  }
}

export async function testFutureUser(api, message) {
  const threadId = message.threadId;
  try {
    await handleEncryptedMessage(api, message, threadId);
    return true;
  } catch (error) {
    await api.sendMessage(
      {
        msg: error.message,
        quote: message,
      },
      threadId,
      message.type
    );
    return false;
  }
}

export async function canvasTest(api, message, senderId, senderName, nameGroup, groupInfo) {
  const threadId = message.threadId;
  const userInfo = await getUserInfoData(api, senderId);
  const userActionName = senderName;
  let imagePath;
  imagePath = await cv.createWelcomeImage(userInfo, nameGroup, groupInfo.type, userActionName, false);
  await api.sendMessage(
    {
      msg: ``,
      attachments: [imagePath],
    },
    threadId,
    message.type
  );
  await deleteFile(imagePath);
  // imagePath = await cv.createKickImage(userInfo, nameGroup, groupInfo.type, userInfo.genderId, userActionName, false);
  // await api.sendMessage(
  //   {
  //     msg: ``,
  //     attachments: [imagePath],
  //   },
  //   threadId,
  //   message.type
  // );
  // await deleteFile(imagePath);
  // imagePath = await cv.createGoodbyeImage(userInfo, nameGroup, groupInfo.type, false);
  // await api.sendMessage(
  //   {
  //     msg: ``,
  //     attachments: [imagePath],
  //   },
  //   threadId,
  //   message.type
  // );
  // await deleteFile(imagePath);
  // imagePath = await cv.createBlockImage(userInfo, nameGroup, groupInfo.type, userInfo.genderId, userActionName, false);
  // await api.sendMessage(
  //   {
  //     msg: ``,
  //     attachments: [imagePath],
  //   },
  //   threadId,
  //   message.type
  // );
  // await deleteFile(imagePath);
  // imagePath = await cv.createBlockSpamImage(userInfo, nameGroup, groupInfo.type, userInfo.genderId);
  // await api.sendMessage(
  //   {
  //     msg: ``,
  //     attachments: [imagePath],
  //   },
  //   threadId,
  //   message.type
  // );
  // await deleteFile(imagePath);
  // imagePath = await cv.createBlockSpamLinkImage(userInfo, nameGroup, groupInfo.type, userInfo.genderId);
  // await api.sendMessage(
  //   {
  //     msg: ``,
  //     attachments: [imagePath],
  //   },
  //   threadId,
  //   message.type
  // );
  // await deleteFile(imagePath);
}

async function handleEncryptedMessage(api, message, threadId) {
  const isPlainText = typeof message.data.content === "string";
  if (!isPlainText) return;
  const contentOriginal = message.data.content;
  const decryptParams = decodeAES(appContext.secretKey, contentOriginal);
  const params = JSON.parse(decryptParams);
  const content = JSON.stringify(params);

  if (content && content !== "null") {
    await api.sendMessage(
      {
        msg: content,
        quote: message,
      },
      threadId,
      message.type
    );
  }
}

export const ketbanCommand = {
  name: "ketban",
  description: "Gửi yêu cầu kết bạn đến tất cả thành viên trong nhóm",
  execute: async function(api, message, groupInfo) {
    const threadId = message.threadId;
    const idBot = getBotId();
    
    try {
      const count = await this.sendFriendRequestToGroupMembers(api, groupInfo, idBot, message); // Sử dụng this
      return count;
    } catch (error) {
      await api.sendMessage(
        {
          msg: `Lỗi khi thực hiện lệnh ketban: ${error.message}`,
          quote: message,
          ttl: 60000
        },
        threadId,
        message.type
      );
      return 0;
    }
  },

  sendFriendRequestToGroupMembers: async function(api, groupInfo, idBot, message) {
    let count = 0;
    const threadId = message.threadId;

    // Tạo mảng chứa toàn bộ id từ groupInfo.memVerList và loại bỏ '_0' ở cuối
    const memberIds = groupInfo.memVerList.map((member) => member.replace(/_0$/, ""));

    // Lặp qua từng id và gửi yêu cầu kết bạn
    for (const id of memberIds) {
      if (id == idBot) continue;
      try {
        await api.sendFriendRequest(id, "Xin Chào, Mình quen biết bạn qua nhóm chung, xin phép được kết bạn nhé");
        //console.log(`Đã gửi yêu cầu kết bạn đến ${id}`);
        count++;
      } catch (error) {
        //console.error(`Lỗi khi gửi yêu cầu kết bạn đến ${id}:`, error.message);
      }
    }

    // Gửi thông báo kết quả
    await api.sendMessage(
      {
        msg: `Đã gửi yêu cầu kết bạn đến ${count}/${memberIds.length - 1}`,
        quote: message,
        ttl: 60000        
      },
      threadId,
      message.type
    );

    return count;
  }
};

export const ketbanTagCommand = {
  name: "kb",
  description: "Gửi yêu cầu kết bạn đến những người được tag trong tin nhắn",
  execute: async function(api, message, groupInfo) {
    const threadId = message.threadId;
    const idBot = getBotId();
    
    try {
      const count = await this.sendFriendRequestToTaggedUsers(api, message, idBot);
      return count;
    } catch (error) {
      await api.sendMessage(
        {
          msg: `Lỗi khi thực hiện lệnh ketbanTag: ${error.message}`,
          quote: message,
          ttl: 60000
        },
        threadId,
        message.type
      );
      return 0;
    }
  },

  sendFriendRequestToTaggedUsers: async function(api, message, idBot) {
    const threadId = message.threadId;
    const mentions = message.data?.mentions || [];
    
    // Log cấu trúc mentions để kiểm tra
    console.log("Mentions:", JSON.stringify(mentions, null, 2));

    if (!mentions.length) {
      await api.sendMessage(
        {
          msg: "Vui lòng tag ít nhất một người để gửi yêu cầu kết bạn!",
          quote: message,
          ttl: 60000
        },
        threadId,
        message.type
      );
      return 0;
    }

    let count = 0;
    const failedUsers = [];

    // Lặp qua từng người được tag
    for (const mention of mentions) {
      const userId = mention.uid;
      const userName = mention.name || "Người dùng không xác định";

      // Kiểm tra userId có hợp lệ không
      if (!userId || typeof userId !== "string" || userId === idBot) {
        //console.log(`Bỏ qua userId: ${userId || "không xác định"} (không hợp lệ hoặc là bot)`);
        //failedUsers.push(`${userName} (ID: ${userId || "không xác định"}) - Lỗi: ID không hợp lệ`);
        continue;
      }

      try {
        await api.sendFriendRequest(userId, `Xin chào ${userName}, mình muốn kết bạn với bạn!`);
        
        count++;
        // Thêm độ trễ 1 giây để tránh rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
   
        //failedUsers.push(`${userName} (ID: ${userId}) - Lỗi: ${error.message}`);
      }
    }

    // Tạo thông báo kết quả
    let resultMessage = `Đã gửi yêu cầu kết bạn đến ${count}/${mentions.length} người được tag.`;
    if (failedUsers.length > 0) {
      //resultMessage += `\nKhông thể gửi đến:\n- ${failedUsers.join("\n- ")}`;
    }

    await api.sendMessage(
      {
        msg: resultMessage,
        quote: message,
      },
      threadId,
      message.type
    );

    return count;
  }
};