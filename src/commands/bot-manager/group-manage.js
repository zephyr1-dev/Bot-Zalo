import { MessageType } from "zlbotdqt";
import * as cv from "../../utils/canvas/index.js";
import { getUserInfoData } from "../../service-debug/info-service/user-info.js";
import { sendMessageWarning, sendMessageFromSQL, sendMessageInsufficientAuthority, sendMessageStateQuote } from "../../service-debug/chat-zalo/chat-style/chat-style.js";
import { tempDir, writeCommandConfig, writeGroupSettings } from "../../utils/io-json.js";
import { getGlobalPrefix } from "../../service-debug/service.js";
import { getCommandConfig, isAdmin } from "../../index.js";
import { removeMention } from "../../utils/format-util.js";
import { managerData } from "./active-bot.js";
import fs from "fs/promises";
import fsOnly from "fs";
import path from "path";
import { createBlockedListImage } from "../../utils/canvas/listblocked-canvas.js";
import { createBlockedBotListImage } from "../../utils/canvas/listblockbot-cavas.js";
import { fileURLToPath } from "url";
import { createCanvas, loadImage } from "canvas";
import { deleteFile } from "../../utils/util.js";
import { sendMessageCompleteRequest } from "../../service-debug/chat-zalo/chat-style/chat-style.js";

export async function handleKick(api, message, groupInfo) {
  const threadId = message.threadId;
  const groupName = groupInfo.name;
  const senderName = message.data.dName;

  if (!message.data.mentions || message.data.mentions.length === 0) {
    await sendMessageWarning(
      api,
      message,
      ":D Đại Ca muốn kick ai? 🚀",
      false
    );
    return;
  }

  const uids = [];
  const UserDataMentions = [];
  for (const mention of message.data.mentions) {
    if (isAdmin(mention.uid, threadId)) {
      await sendMessageWarning(
        api,
        message,
        "Đại Ca Không thể bảo em kick quản trị bot được 🚀",
        false
      );
      continue;
    }
    uids.push(mention.uid);
    try {
      const userInfo = await getUserInfoData(api, mention.uid);
      if (userInfo) {
        UserDataMentions.push(userInfo);
      }
    } catch (error) {
      console.error(
        ` Không lấy được thông tin cho người dùng ${mention.uid}:`,
        error
      );
    }
  }

  if (uids.length === 0) {
    return;
  }

  try {
    const result = await api.removeUserFromGroup(threadId, uids);
    if (result.errorMembers.length > 0) {
      await sendMessageWarning(
        api,
        message,
        "Đưa Em Key Vàng 🔑, Em Kick Cho Đại Ca Xem :D 🚀",
        false
      );
      return;
    }

    for (const userInfo of UserDataMentions) {
      let imagePath = null;
      try {
        imagePath = await cv.createKickImage(
          userInfo,
          groupName,
          groupInfo.type,
          userInfo.genderId,
          senderName
        );

        const kickMessage = {
          msg: "",
          attachments: imagePath ? [imagePath] : [],
        };

        await api.sendMessage(kickMessage, threadId, MessageType.GroupMessage);
      } catch (error) {
        console.error("Lỗi khi tạo và gửi ảnh kết quả:", error);
      } finally {
        await cv.clearImagePath(imagePath);
      }
    }
  } catch (error) {
    console.error("Chắc Chắn Là Đã Có Lỗi Gì Đó :D", error);
    await sendMessageWarning(
      api,
      message,
      "Đưa Em Key Vàng 🔑, Em Kick Cho Đại Ca Xem :D 🚀",
      false
    );
  }
}

export async function handleKickAll(api, message, groupInfo) {
  const threadId = message.threadId;
  const groupName = groupInfo.name;
  const senderName = message.data.dName;
  try {
    // Lấy thông tin nhóm để kiểm tra creator
    const group = await api.getGroupInfo(threadId);
    if (!group || !group.gridInfoMap || !group.gridInfoMap[threadId]) {
      console.error("Không thể lấy thông tin nhóm:", threadId);
      await sendMessageWarning(api, message, "Lỗi: Không thể lấy thông tin nhóm! 🚀", false);
      return;
    }
    const groupData = group.gridInfoMap[threadId];
    const creatorId = groupData.creatorId || '';
    // Lấy danh sách thành viên nhóm
    const memberList = groupData.memVerList ? groupData.memVerList.map(member => member.split('_')[0]) : [];
    if (!Array.isArray(memberList) || memberList.length === 0) {
      console.error("Danh sách thành viên nhóm không hợp lệ:", memberList);
      await sendMessageWarning(api, message, "Lỗi: Không thể lấy danh sách thành viên nhóm! 🚀", false);
      return;
    }
    // Loại trừ creator và admin bot
    const membersToKick = memberList.filter(uid => uid !== creatorId && !isAdmin(uid, threadId));
    if (membersToKick.length === 0) {
      await sendMessageWarning(api, message, "Không có thành viên nào để kick! 🚀", false);
      return;
    }
    const validMembers = [];
    const UserDataMentions = [];
    // Kiểm tra từng thành viên có tồn tại trong nhóm không
    for (const uid of membersToKick) {
      try {
        const userInfo = await getUserInfoData(api, uid);
        if (userInfo) {
          validMembers.push(uid);
          UserDataMentions.push(userInfo);
        }
      } catch (error) {
        console.warn(`UID ${uid} không hợp lệ hoặc không tồn tại trong nhóm:`, error);
      }
    }
    if (validMembers.length === 0) {
      await sendMessageWarning(api, message, "Không tìm thấy thành viên hợp lệ để kick! 🚀", false);
      return;
    }
    // Thực hiện kick từng thành viên
    let kickedCount = 0;
    try {
      const result = await api.removeUserFromGroup(threadId, validMembers);
      if (result.errorMembers && result.errorMembers.length > 0) {
        console.warn(`Không thể kick một số thành viên: ${result.errorMembers.join(', ')}`);
      }
      kickedCount = validMembers.length - result.errorMembers.length;
    } catch (error) {
      console.error("Lỗi khi kick tất cả thành viên:", error);
      return;
    }

    if (kickedCount === 0) {
      await sendMessageWarning(api, message, "Không thể kick bất kỳ thành viên nào! 🚀", false);
      return;
    }

    await sendMessageStateQuote(api, message, `Đã kick ${kickedCount} thành viên!`, true, 300000);
  } catch (error) {
    console.error("Lỗi khi kick tất cả thành viên:", error);
    await sendMessageWarning(api, message, "Đưa Em Key Vàng 🔑, Em Kick Tất Cả Cho Đại Ca Xem :D 🚀", false);
  }
}


export async function handleGroupManage(api, message, args) {
  const { threadId, senderId } = message;

  if (!isAdmin(senderId, threadId)) {
    await api.sendMessage("Bạn không có quyền sử dụng lệnh này!", threadId);
    return;
  }

  const config = getCommandConfig();
  console.log("Cấu hình lệnh:", config);

  await api.sendMessage("Đang xử lý lệnh quản lý nhóm...", threadId);
}

export async function handleBlock(api, message, groupInfo) {
  const threadId = message.threadId;
  const groupName = groupInfo.name;
  const senderName = message.data.dName;

  if (!message.data.mentions || message.data.mentions.length === 0) {
    await sendMessageWarning(
      api,
      message,
      ":D Đại Ca muốn chặn ai? 🚀",
      false
    );
    return;
  }

  const uids = [];
  const UserDataMentions = [];
  for (const mention of message.data.mentions) {
    if (isAdmin(mention.uid, threadId)) {
      await sendMessageWarning(
        api,
        message,
        "Đại Ca Không thể bảo em block quản trị bot được 🚀",
        false
      );
      continue;
    }
    uids.push(mention.uid);
    try {
      const userInfo = await getUserInfoData(api, mention.uid);
      if (userInfo) {
        UserDataMentions.push(userInfo);
      }
    } catch (error) {
      console.error(
        `Không lấy thông tin cho người dùng ${mention.uid}:`,
        error
      );
    }
  }

  if (uids.length === 0) {
    return;
  }

  try {
    const result = await api.blockUsers(threadId, uids);
    if (result.errorMembers && result.errorMembers.length > 0) {
      await sendMessageWarning(
        api,
        message,
        "Đưa Em Key Vàng 🔑, Em Block Cho Đại Ca Xem :D 🚀",
        false
      );
      return;
    }

    for (const userInfo of UserDataMentions) {
      let imagePath = null;
      try {
        imagePath = await cv.createBlockImage(
          userInfo,
          groupName,
          groupInfo.type,
          userInfo.genderId,
          senderName
        );

        const blockMessage = {
          msg: "",
          attachments: imagePath ? [imagePath] : [],
        };

        await api.sendMessage(blockMessage, threadId, message.type);
      } catch (error) {
        console.error("Lỗi khi tạo và gửi ảnh kết quả:", error);
      } finally {
        await cv.clearImagePath(imagePath);
      }
    }
  } catch (error) {
    console.error("Chắc Chắn Là Đã Có Lỗi Gì Đó :D", error);
    await sendMessageWarning(
      api,
      message,
      "Đưa Em Key Vàng 🔑, Em Block Cho Đại Ca Xem :D 🚀",
      false
    );
  }
}

export async function handleBlockAll(api, message, groupInfo) {
  const threadId = message.threadId;
  const groupName = groupInfo.name;
  const senderId = message.data.uidFrom;

  function hasSilverKey(uid, threadId, groupData) {
    const adminIds = groupData.adminIds ? [...groupData.adminIds] : [];
    return adminIds.includes(uid);
  }

  try {
    if (!senderId) {
      await sendMessageWarning(api, message, "Lỗi: Không thể xác định người gửi! 🚀", false);
      return;
    }

    const group = await api.getGroupInfo(threadId);
    if (!group || !group.gridInfoMap || !group.gridInfoMap[threadId]) {
      await sendMessageWarning(api, message, "Lỗi: Không thể lấy thông tin nhóm! 🚀", false);
      return;
    }
    const groupData = group.gridInfoMap[threadId];
    const creatorId = groupData.creatorId || '';

    if (senderId !== creatorId && !hasSilverKey(senderId, threadId, groupData)) {
      await sendMessageWarning(api, message, "Bạn cần là creator hoặc có key bạc để thực hiện lệnh này! 🔑", false);
      return;
    }

    const memberList = groupData.memVerList ? groupData.memVerList.map(member => member.split('_')[0]) : [];
    if (!Array.isArray(memberList) || memberList.length === 0) {
      await sendMessageWarning(api, message, "Lỗi: Không thể lấy danh sách thành viên nhóm! 🚀", false);
      return;
    }

    const membersToBlock = memberList.filter(uid => uid !== creatorId && !isAdmin(uid, threadId) && !hasSilverKey(uid, threadId, groupData));
    if (membersToBlock.length === 0) {
      await sendMessageWarning(api, message, "Không có thành viên nào để chặn! 🚀", false);
      return;
    }

    const validMembers = [];
    const UserDataMentions = [];
    for (const uid of membersToBlock) {
      try {
        const userInfo = await getUserInfoData(api, uid);
        if (userInfo) {
          validMembers.push(uid);
          UserDataMentions.push(userInfo);
        }
      } catch (error) {
        // Bỏ qua lỗi cho thành viên không hợp lệ
      }
    }

    if (validMembers.length === 0) {
      await sendMessageWarning(api, message, "Không tìm thấy thành viên hợp lệ để chặn! 🚀", false);
      return;
    }

    let blockedCount = 0;
    try {
      const result = await api.blockUsers(threadId, validMembers);
      if (result.errorMembers && result.errorMembers.length > 0) {
        blockedCount = validMembers.length - result.errorMembers.length;
      } else {
        blockedCount = validMembers.length;
      }
    } catch (error) {
      await sendMessageWarning(api, message, "Đưa Em Key Vàng hoặc Key Bạc 🔑, Em Block Tất Cả Cho Đại Ca Xem :D 🚀", false);
      return;
    }

    if (blockedCount === 0) {
      await sendMessageWarning(api, message, "Không thể chặn bất kỳ thành viên nào! 🚀", false);
      return;
    }

    await sendMessageStateQuote(api, message, `Đã chặn ${blockedCount} thành viên!`, true, 300000);
  } catch (error) {
    await sendMessageWarning(api, message, "Đưa Em Key Vàng hoặc Key Bạc 🔑, Em Block Tất Cả Cho Đại Ca Xem :D 🚀", false);
  }
}

export async function handleKeyCommands(api, message, groupSettings, isAdminLevelHighest) {
  const content = removeMention(message);
  const senderId = message.data.uidFrom;
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();

  if (!content.startsWith(`${prefix}keygold`) && !content.startsWith(`${prefix}keysilver`) && !content.startsWith(`${prefix}unkey`)) {
    return false;
  }

  const action = content.startsWith(`${prefix}keygold`) ? "gold" : content.startsWith(`${prefix}keysilver`) ? "silver" : "unkey";

  if (!isAdminLevelHighest) {
    const caption = "Không phải quản trị bot cấp mà sử dụng lệnh này!";
    await sendMessageInsufficientAuthority(api, message, caption);
    return false;
  }

  const mentions = message.data.mentions;

  if (!mentions || mentions.length === 0) {
    await handleKeyAction(api, message, groupSettings, threadId, senderId, action, "Bạn");
  } else {
    for (const mention of mentions) {
      const targetId = mention.uid;
      const targetName = message.data.content.substring(mention.pos, mention.pos + mention.len).replace("@", "");
      await handleKeyAction(api, message, groupSettings, threadId, targetId, action, targetName);
    }
  }

  writeGroupSettings(groupSettings);
  return true;
}

async function handleKeyAction(api, message, groupSettings, threadId, targetId, action, targetName) {
  switch (action) {
    case "gold":
      try {
        await api.changeGroupOwner(threadId, targetId);
        await sendMessageStateQuote(api, message, `Đã nhường key vàng cho ${targetName}.`, true, 300000);
      } catch (error) {
        await sendMessageStateQuote(api, message, `Không quyền hạn để nhường key cho ${targetName}.`, false, 300000);
      }
      break;
    case "silver":
      try {
        await api.addGroupAdmins(threadId, targetId);
        await sendMessageStateQuote(api, message, `Đã phong key bạc cho ${targetName}.`, true, 300000);
      } catch (error) {
        await sendMessageStateQuote(api, message, `Không hạn để phong key bạc cho ${targetName}.`, false, 300000);
      }
      break;
    case "unkey":
      try {
        await api.removeGroupAdmins(threadId, targetId);
        await sendMessageStateQuote(api, message, `Đã xóa key của ${targetName}.`, true, 300000);
      } catch (error) {
        await sendMessageStateQuote(api, message, `${targetName} Không có key để xóa.`, false, 300000);
      }
      break;
  }
}

export async function handleBlockBot(api, message, groupSettings) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  let listIdBlock = [];
  let messageContent = "";

  // Kiểm tra quyền admin
  if (!isAdmin(senderId, threadId)) {
    try {
      await sendMessageInsufficientAuthority(api, message, "Bạn không có quyền sử dụng lệnh này!");
    } catch (error) {
      console.error("Lỗi khi gửi thông báo thiếu quyền:", error);
    }
    return;
  }

  // Khởi tạo managerData.data và blockBot nếu chưa tồn tại
  if (!managerData.data) {
    managerData.data = { blockBot: [] };
  } else if (!managerData.data.blockBot) {
    managerData.data.blockBot = [];
  }

  try {
    if (groupSettings) {
      const mentions = message.data.mentions;
      if (mentions && mentions.length > 0) {
        for (const mention of mentions) {
          const targetId = mention.uid;
          const targetName = message.data.content.substring(mention.pos, mention.pos + mention.len).replace("@", "");
          if (!isAdmin(targetId, threadId)) {
            listIdBlock.push({ targetId, targetName });
          } else {
            messageContent += `🚨 Không block được Quản Trị Cấp Cao: ${targetName}\n`;
          }
        }
      } else {
        messageContent = "🚨 Vui lòng đề cập người dùng qua @mention để chặn!";
      }
    } else {
      try {
        const userInfo = await getUserInfoData(api, senderId);
        if (!isAdmin(senderId, threadId)) {
          listIdBlock.push({ targetId: senderId, targetName: userInfo.name });
        } else {
          messageContent = `🚨 Không block được Quản Trị Cấp Cao: ${userInfo.name}\n`;
        }
      } catch (error) {
        console.error(`Lỗi khi lấy thông tin người dùng ${senderId}:`, error);
        messageContent = "🚨 Lỗi khi lấy thông tin người dùng, vui lòng thử lại!";
      }
    }

    if (listIdBlock.length > 0) {
      const blockData = managerData.data;
      let blockedUsers = [];
      let alreadyBlockedUsers = [];

      for (const item of listIdBlock) {
        const isBlocked = blockData.blockBot.some((blocked) => blocked.idUserZalo === item.targetId);
        if (isBlocked) {
          alreadyBlockedUsers.push(item.targetName);
        } else {
          blockData.blockBot.push({
            idUserZalo: item.targetId,
            senderName: item.targetName,
          });
          blockedUsers.push(item.targetName);
        }
      }

      if (blockedUsers.length > 0) {
        messageContent += `✅ Đã chặn tương tác bot đối với: ${blockedUsers.join(", ")}\n`;
      }
      if (alreadyBlockedUsers.length > 0) {
        messageContent += `❌ Những người đã bị chặn từ trước: ${alreadyBlockedUsers.join(", ")}\n`;
      }
    }

    // Đảm bảo luôn có phản hồi
    if (messageContent.trim() === "") {
      messageContent = "🚨 Không có mục tiêu hợp lệ để chặn!";
    }

    await api.sendMessage(
      {
        msg: messageContent.trim(),
        quote: message,
        ttl: 300000,
      },
      threadId,
      message.type
    );

    if (listIdBlock.length > 0) {
      managerData.hasChanges = true;
    }
  } catch (error) {
    console.error("Lỗi trong handleBlockBot:", error);
    try {
      await api.sendMessage(
        {
          msg: "🚨 Đã có lỗi xảy ra khi xử lý lệnh blockbot, vui lòng thử lại!",
          quote: message,
          ttl: 300000,
        },
        threadId,
        message.type
      );
    } catch (sendError) {
      console.error("Lỗi khi gửi thông báo lỗi:", sendError);
    }
  }
}
export async function handleUnblockBot(api, message, groupSettings) {
  const threadId = message.threadId;
  const senderName = message.data.dName;
  let listIdUnblock = [];

  if (groupSettings) {
    const mentions = message.data.mentions;
    if (mentions && mentions.length > 0) {
      for (const mention of mentions) {
        const targetId = mention.uid;
        const targetName = message.data.content.substring(mention.pos, mention.pos + mention.len).replace("@", "");
        listIdUnblock.push({ targetId, targetName });
      }
    }
  } else {
    const userInfo = await getUserInfoData(api, threadId);
    listIdUnblock.push({ targetId: threadId, targetName: userInfo.name });
  }

  if (listIdUnblock.length > 0) {
    const blockData = managerData.data;
    let unblockUsers = [];
    let notBlockedUsers = [];

    for (const item of listIdUnblock) {
      const blockedUserIndex = blockData.blockBot.findIndex((blocked) => blocked.idUserZalo === item.targetId);

      if (blockedUserIndex !== -1) {
        blockData.blockBot.splice(blockedUserIndex, 1);
        unblockUsers.push(item.targetName);
      } else {
        notBlockedUsers.push(item.targetName);
      }
    }

    let messageContent = "";
    if (unblockUsers.length > 0) {
      messageContent += `✅ Đã bỏ chặn tương tác bot đối với: ${unblockUsers.join(", ")}\n`;
    }
    if (notBlockedUsers.length > 0) {
      messageContent += `❌ Các thành viên sau Không bị chặn: ${notBlockedUsers.join(", ")}`;
    }

    if (messageContent.trim() === "") {
      messageContent = "🚨 Éo có mục tiêu để bỏ chặn, vui lòng đề cập thông qua @mention";
    }

    await api.sendMessage(
      { msg: messageContent.trim(), quote: message, ttl: 300000 },
      message.threadId,
      message.type
    );

    managerData.hasChanges = true;
  }
}

export async function handleListBlockBot(api, message) {
  const blockData = managerData.data;
  const listBlockedUsers = blockData.blockBot.map((blocked) => blocked);

  if (listBlockedUsers.length === 0) {
    await api.sendMessage(
      { msg: `🚨 Không có ai bị chặn tương tác với bot`, ttl: 300000 },
      message.threadId,
      message.type
    );
  } else {
    const filePath = await createBlockedBotListImage(listBlockedUsers);
    await api.sendMessage(
      {
        msg: `🛑 Đây là danh sách người dùng bị chặn tương tác với bot.`,
        attachments: [filePath], 
        ttl: 300000,
      },
      message.threadId,
      message.type
    );
    setTimeout(async () => {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.error("Lỗi khi xóa file:", error);
      }
    }, 30 * 1000);
  }
}

export function isUserBlocked(senderId) {
  try {
    const blockData = managerData.data;
    if (!blockData || !blockData.blockBot) {
      return false;
    }

    return blockData.blockBot.some((blocked) => blocked.idUserZalo === senderId);
  } catch (error) {
    console.error("Lỗi khi kiểm tra trạng thái block:", error);
    return false;
  }
}

export async function handleSettingGroupCommand(api, message, groupInfo, aliasCommand) {
  const content = removeMention(message);
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();
  const args = content.slice(prefix.length).trim().split(/\s+/);

  args.shift();

  if (args.length < 1) {
    const result = {
      success: false,
      message: `Sử dụng: ${prefix}${aliasCommand} <loại config> <giá trị>` +
        `\n\n[Cài đặt Bật/Tắt] (on/off hoặc 1/0):` +
        `\n- lockchat: ${groupInfo.setting?.lockSendMsg ? "Tắt" : "Mở"} chat trong nhóm` +
        `\n- lockview: ${groupInfo.setting?.lockViewMember ? "Tắt" : "Mở"} xem thành viên trong nhóm` +
        `\n- history: ${groupInfo.setting?.enableMsgHistory ? "Mở" : "Tắt"} cho phép thành viên mới đọc tin nhắn gần nhất` +
        `\n- joinappr: ${groupInfo.setting?.joinAppr ? "Mở" : "Tắt"} chế độ phê duyệt thành viên` +
        `\n- showkey: ${groupInfo.setting?.signAdminMsg ? "Mở" : "Tắt"} hiển thị key quản trị` +
        `\n\n[Cài đặt Chuỗi]:` +
        `\n- name <tên mới>: Đổi tên nhóm`
    };
    await sendMessageFromSQL(api, message, result, false, 60000);
    return;
  }

  const settingType = args[0].toLowerCase();
  const value = args.slice(1).join(" ");

  // Xử lý các cài đặt chuỗi
  if (["name"].includes(settingType)) {
    if (!value) {
      await sendMessageStateQuote(api, message, `Vui lòng nhập giá trị cho cài đặt ${settingType}`, false, 60000);
      return;
    }

    try {
      switch (settingType) {
        case "name":
          await api.changeGroupName(threadId, value);
          await sendMessageStateQuote(api, message, `Tên nhóm đã được đổi thành ${value}`, true, 60000);
          break;
      }
      return;
    } catch (error) {
      console.error(`Lỗi khi thay đổi ${settingType}:`, error);
      await sendMessageStateQuote(api, message, `Không thể thay đổi ${settingType}: ${error.message}`, false, 60000);
      return;
    }
  }

  // Xử lý các cài đặt on/off
  if (!value || !["on", "off", "0", "1"].includes(value.toLowerCase())) {
    await sendMessageStateQuote(api, message, `Vui lòng chọn on/off hoặc 1/0 để thay đổi cài đặt`, false, 60000);
    return;
  }

  const newValue = ["on", "1"].includes(value.toLowerCase()) ? 1 : 0;
  const currentSettings = groupInfo.setting || {};

  try {
    switch (settingType) {
      case "lockchat":
        currentSettings.lockSendMsg = newValue;
        const status = newValue === 1 ? "tắt" : "mở";
        await updateGroupSetting(api, message, threadId, currentSettings, `Đã ${status} chat cho tất cả thành viên!`);
        break;

      case "lockview":
        currentSettings.lockViewMember = newValue;
        const memberStatus = newValue === 1 ? "tắt" : "mở";
        await updateGroupSetting(api, message, threadId, currentSettings, `Đã ${memberStatus} xem thành viên trong nhóm!`);
        break;

      case "history":
        currentSettings.enableMsgHistory = newValue;
        const historyStatus = newValue === 1 ? "mở" : "tắt";
        await updateGroupSetting(api, message, threadId, currentSettings, `Đã ${historyStatus} cho phép thành viên mới đọc tin nhắn gần nhất!`);
        break;

      case "joinappr":
        currentSettings.joinAppr = newValue;
        const joinApprStatus = newValue === 1 ? "mở" : "tắt";
        await updateGroupSetting(api, message, threadId, currentSettings, `Đã ${joinApprStatus} chế độ phê duyệt thành viên!`);
        break;

      case "showkey":
        currentSettings.signAdminMsg = newValue;
        const showKeyStatus = newValue === 1 ? "mở" : "tắt";
        await updateGroupSetting(api, message, threadId, currentSettings, `Đã ${showKeyStatus} hiển thị key quản trị!`);
        break;

      // Thêm các case khác ở đây trong tương lai
      // case "setting_name":
      //   currentSettings.settingKey = newValue;
      //   await updateGroupSetting(...);
      //   break;

      default:
        await sendMessageStateQuote(api, message, `Loại cài đặt '${settingType}' Không hợp lệ!`, false, 60000);
        break;
    }
  } catch (error) {
    console.error("Lỗi khi thay đổi cài đặt nhóm:", error);
    await sendMessageStateQuote(api, message, `Không thể thay đổi cài đặt nhóm: ${error.message}`, false, 60000);
  }
}

export async function handleGroupBlockList(api, message, args, aliasCommand, groupTypeString) {
  const prefix = getGlobalPrefix(api.getBotId());
  const threadId = message.threadId;
  const botId = api.getBotId();

  if (args.length < 1) {
    await sendMessageStateQuote(
      api,
      message,
      `Cú pháp câu lệnh: ${prefix}${aliasCommand} block <add/remove/list> <@mention|index>\n` +
      `list: hiển thị danh sách đối tượng chặn trong ${groupTypeString}.\n` +
      `add: thêm đối tượng vào danh sách chặn (thông qua mention hoặc uid chỉ định).\n` +
      `remove: xóa đối tượng khỏi danh sách chặn thông qua index hoặc 'all' để xóa toàn bộ.`,
      false,
      60000,
      false
    );
    return;
  }

  const action = args[0].toLowerCase();
  switch (action) {
    case "add":
      const uid = args[1];
      let userInfo;
      try {
        userInfo = await getUserInfoData(api, uid);
      } catch (error) {
        console.error(`Không thể lấy thông tin cho người dùng ${uid}:`, error);
      }

      const result = await api.blockUsers(message.threadId, [uid]);
      if (result.errorMembers && result.errorMembers.length > 0) {
        await sendMessageWarning(api, message, "Ném Đây Cái Key Vàng 🔑, Tôi Block Cho Bạn Xem :D 🚀", false);
        return;
      }

      await sendMessageStateQuote(
        api,
        message,
        `🚨 Đã chặn tài khoản sau khỏi ${groupTypeString}: ${userInfo ? userInfo.name : uid}.`,
        false,
        300000,
        false
      );
      break;

    case "remove":
      try {
        const stt = args[1]?.toLowerCase();
        const blockList = await getGroupBlockList(api, message);
        if (blockList && blockList.length > 0) {
          if (stt === "all") {
            const uidsToUnblock = blockList.map((item) => item.id);
            const result = await api.unblockUsers(message.threadId, uidsToUnblock);
            if (result.errorMembers && result.errorMembers.length > 0) {
              await sendMessageWarning(api, message, `Mình không đủ quyền hạn để thực hiện hành động này`);
              return;
            }
            await sendMessageStateQuote(
              api,
              message,
              `🚨 Đã mở chặn toàn bộ tài khoản trong danh sách chặn của ${groupTypeString}.`,
              false,
              300000,
              false
            );
            return;
          }
          if (isNaN(stt)) {
            await sendMessageStateQuote(
              api,
              message,
              `🚨 Vui lòng nhập số thứ tự, uid của tài khoản cần mở chặn, hoặc 'all' để xóa toàn bộ trong ${groupTypeString}.\n` +
              `Để xem danh sách chặn, chat: ${prefix}${aliasCommand} block list`,
              false,
              60000,
              false
            );
            return;
          }
          let target;
          target = blockList.find((item) => item.id === stt);
          if (!target) {
            const index = parseInt(stt) - 1;
            if (index < 0 || index >= blockList.length) {
              await sendMessageStateQuote(
                api,
                message,
                `🚨 Số thứ tự không hợp lệ, vui lòng nhập lại hoặc kiểm tra lại danh sách chặn.\n` +
                `Để xem danh sách chặn, chat: ${prefix}${aliasCommand} block list`,
                false,
                60000,
                false
              );
              return;
            }
            target = blockList[index];
          }
          const result = await api.unblockUsers(message.threadId, [target.id]);
          if (result.errorMembers && result.errorMembers.length > 0) {
            await sendMessageWarning(api, message, `Mình không đủ quyền hạn để thực hiện hành động này`);
            return;
          }
          await sendMessageStateQuote(
            api,
            message,
            `🚨 Đã mở chặn tài khoản sau trong ${groupTypeString}: ${target.dName}.`,
            false,
            300000,
            false
          );
        } else {
          await sendMessageStateQuote(
            api,
            message,
            `🚨 Không có ai bị chặn trong ${groupTypeString} này để mở chặn.`,
            false,
            60000,
            false
          );
        }
      } catch (error) {
        await sendMessageStateQuote(
          api,
          message,
          `Không thể lấy được danh sách chặn thành viên từ ${groupTypeString}`,
          false,
          60000,
          false
        );
      }
      break;

    case "list":
      try {
        const blockList = await getGroupBlockList(api, message);
        if (blockList && blockList.length > 0) {
          let imagePath = null;
          try {
            imagePath = await createBlockListImage(blockList, groupTypeString);
            await sendMessageCompleteRequest(
              api,
              message,
              {
                caption: `Đây là danh sách người dùng bị chặn trong ${groupTypeString}.`,
                imagePath,
              },
              600000
            );
          } catch (error) {
            // Fallback về text nếu có lỗi
            const listBlockedUsers = blockList.map((blocked) => blocked.dName);
            const chunksArr = chunkArray(listBlockedUsers, 50);
            await sendMessageStateQuote(
              api,
              message,
              `Danh sách tài khoản bị chặn trong ${groupTypeString} này:\n${chunksArr[0]
                .map((user, index) => `- ${index + 1}. ${user}`)
                .join("\n")}`,
              false,
              180000,
              false
            );
            if (chunksArr.length > 1) {
              for (let i = 1; i < chunksArr.length; i++) {
                await sendMessageStateQuote(
                  api,
                  message,
                  chunksArr[i].map((user, index) => `- ${index + 1 + i * 50}. ${user}`).join("\n"),
                  false,
                  180000,
                  false
                );
              }
            }
          } finally {
            deleteFile(imagePath);
          }
        } else {
          await sendMessageStateQuote(
            api,
            message,
            `🚨 Không có ai bị chặn trong ${groupTypeString} này.`,
            false,
            60000,
            false
          );
        }
      } catch (error) {
        await sendMessageStateQuote(
          api,
          message,
          `Không thể lấy được danh sách chặn thành viên từ ${groupTypeString}`,
          false,
          60000,
          false
        );
      }
      break;

    default:
      await sendMessageStateQuote(
        api,
        message,
        `Cú pháp câu lệnh: ${prefix}${aliasCommand} block <add/remove/list> <uid for add|index for remove>\n` +
        `list: hiển thị danh sách đối tượng chặn trong ${groupTypeString}.\n` +
        `add: thêm đối tượng vào danh sách chặn (thông qua mention hoặc uid chỉ định).\n` +
        `remove: xóa đối tượng khỏi danh sách chặn thông qua index hoặc 'all' để xóa toàn bộ.`,
        false,
        60000,
        false
      );
      break;
  }
}

function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function getGroupBlockList(api, message) {
  const threadId = message.threadId;
  let listBlockedUsers = [];
  let continueGet = true;
  let page = 1;

  try {
    while (continueGet) {
      const blockList = await api.getGroupBlockList(threadId, page);
      if (blockList && blockList.blocked_members && blockList.blocked_members.length > 0) {
        blockList.blocked_members = blockList.blocked_members.map((member) => {
          if (member.avatar && !member.avatar.startsWith("https:")) {
            member.avatar = "https:" + member.avatar;
          }
          if (member.avatar_25 && !member.avatar_25.startsWith("https:")) {
            member.avatar_25 = "https:" + member.avatar_25;
          }
          return member;
        });
        listBlockedUsers = [...listBlockedUsers, ...blockList.blocked_members];
        continueGet = blockList.has_more;
        page += 1;
      } else {
        continueGet = false;
      }
    }
    return listBlockedUsers;
  } catch (error) {
    throw error;
  }
}



async function createBlockListImage(blockList, groupTypeString) {
  const tempCanvas = createCanvas(1, 1);
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.font = "bold 32px BeVietnamPro";

  // Tính toán kích thước cần thiết
  const avatarSize = 80;
  const padding = 30;
  const nameWidth = 400;
  const levelWidth = 200;
  const extraPadding = padding * 4;

  // Tính tổng số người dùng bị block
  const totalBlockedUsers = blockList.length;
  const useDoubleColumn = totalBlockedUsers > 10;

  // Tính width tổng (nhân đôi nếu 2 cột)
  const columnWidth = avatarSize + nameWidth + levelWidth + extraPadding;
  const width = useDoubleColumn ? columnWidth * 2 + padding * 2 : columnWidth;

  // Tính chiều cao (chia 2 nếu 2 cột)
  const headerHeight = 180;
  const itemHeight = 120;
  const itemsPerColumn = useDoubleColumn ? Math.ceil(totalBlockedUsers / 2) : totalBlockedUsers;
  const height = headerHeight + itemsPerColumn * itemHeight + 40;

  // Tạo canvas chính
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Vẽ background với gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(59, 130, 246, 0.9)");
  gradient.addColorStop(1, "rgba(17, 24, 39, 0.95)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Vẽ tiêu đề chính
  let yPos = padding * 2;
  ctx.textAlign = "center";
  ctx.font = "bold 48px BeVietnamPro";
  ctx.fillStyle = cv.getRandomGradient(ctx, width);
  ctx.fillText("BLOCK-LIST-IN-GROUP", width / 2, yPos);

  // Vẽ phụ đề
  yPos += 80;
  ctx.font = "bold 36px BeVietnamPro";
  ctx.fillStyle = "#FFD700";
  ctx.fillText(`Danh Sách Chặn Của ${groupTypeString}`, width / 2, yPos);
  yPos += 40;

  if (useDoubleColumn) {
    // Chia danh sách thành 2 cột
    const midPoint = Math.ceil(blockList.length / 2);

    // Vẽ cột trái
    let leftYPos = yPos;
    for (let i = 0; i < midPoint; i++) {
      if (blockList[i]) {
        leftYPos = await drawBlockedItem(ctx, blockList[i], leftYPos, i + 1, padding, 0, useDoubleColumn);
      }
    }

    // Vẽ cột phải
    let rightYPos = yPos;
    for (let i = midPoint; i < blockList.length; i++) {
      if (blockList[i]) {
        rightYPos = await drawBlockedItem(
          ctx,
          blockList[i],
          rightYPos,
          i + 1,
          padding,
          columnWidth + padding * 2 - 30,
          useDoubleColumn
        );
      }
    }

    // Vẽ đường phân cách giữa 2 cột
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(width / 2, yPos - 20, 2, height - yPos);
  } else {
    // Vẽ 1 cột như bình thường
    let index = 1;
    for (const blockedUser of blockList) {
      yPos = await drawBlockedItem(ctx, blockedUser, yPos, index++, padding, 0, useDoubleColumn);
    }
  }

  // Lưu và trả về đường dẫn ảnh
  const outputPath = path.join(tempDir, `block_list_${Date.now()}.png`);
  const out = fsOnly.createWriteStream(outputPath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);

  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(outputPath));
    out.on("error", reject);
  });
}

async function drawBlockedItem(ctx, blockedUser, yPos, index, padding, xOffset, isDoubleColumn) {
  const itemHeight = 120;
  try {
    const avatarSize = 80;
    const itemPadding = 20;

    // Vẽ background cho item
    ctx.fillStyle = "rgba(29, 18, 18, 0.1)";
    ctx.beginPath();

    // Tính toán width của background
    const backgroundWidth = isDoubleColumn ? (ctx.canvas.width - padding * 4) / 2 : ctx.canvas.width - padding * 2;

    ctx.roundRect(padding + xOffset, yPos, backgroundWidth, itemHeight - itemPadding, 10);
    ctx.fill();

    // Vẽ avatar
    if (blockedUser.avatar && cv.isValidUrl(blockedUser.avatar)) {
      const avatar = await loadImage(blockedUser.avatar);
      const avatarX = padding * 2 + xOffset;
      const avatarY = yPos + (itemHeight - avatarSize) / 2 - itemPadding / 2;

      // Vẽ viền avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
      const borderGradient = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
      borderGradient.addColorStop(0, "#dc3545");
      borderGradient.addColorStop(1, "#c82333");
      ctx.fillStyle = borderGradient;
      ctx.fill();

      // Vẽ avatar trong clip path tròn
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
    }

    // Vẽ separator
    const separatorX = padding * 3 + avatarSize + xOffset;
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(separatorX, yPos + itemPadding - 8, 2, itemHeight - itemPadding * 2);

    // Vẽ thông tin
    const textX = separatorX + padding * 2 - 20;
    const textY = yPos + itemPadding;

    ctx.textAlign = "left";
    ctx.font = "bold 32px BeVietnamPro";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`${index}. ${blockedUser.dName}`, textX, textY + 20);

    ctx.font = "28px BeVietnamPro";
    ctx.fillStyle = "#dc3545";
    ctx.fillText("Người Dùng Bị Chặn", textX, textY + 60);

    return yPos + itemHeight;
  } catch (error) {
    console.error("Lỗi khi vẽ thông tin người dùng bị block:", error);
    return yPos + itemHeight;
  }
}

async function updateGroupSetting(api, message, threadId, settings, successMessage) {
  await api.changeGroupSetting(threadId, settings);
  await sendMessageStateQuote(api, message, successMessage, true, 60000);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TAGET_FILE_PATH = path.join(__dirname, "tagetList.json");

// Hàm đọc danh sách taget từ file JSON
async function readTagetList() {
  try {
    const data = await fs.readFile(TAGET_FILE_PATH, "utf8");
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error.code === "ENOENT") {

      const initialData = {};
      await fs.writeFile(TAGET_FILE_PATH, JSON.stringify(initialData, null, 2), "utf8");
      return initialData;
    }

    return {};
  }
}

// Hàm ghi danh sách taget vào file JSON
async function writeTagetList(tagetData) {
  try {
    await fs.writeFile(TAGET_FILE_PATH, JSON.stringify(tagetData, null, 2), "utf8");

  } catch (error) {

    throw new Error(`Không thể ghi vào tagetList.json: ${error.message}`);
  }
}

// Hàm kiểm tra xem người dùng có bị taget trong nhóm không
export async function isUserTagged(senderId, threadId) {
  try {
    const tagetData = await readTagetList();
    const normalizedSenderId = String(senderId);
    const groupData = tagetData[threadId] || { tagetList: [] };
    const isTagged = groupData.tagetList.some((tagged) => {
      const match = tagged.idUserZalo === normalizedSenderId;

      return match;
    });
    return isTagged;
  } catch (error) {

    return false;
  }
}

// Hàm xử lý lệnh taget để chặn và thêm người dùng vào danh sách taget theo nhóm
export async function handleTaget(api, message, groupInfo) {
  const threadId = message.threadId;
  const groupName = groupInfo.name;
  const senderId = message.data.uidFrom;

  // Kiểm tra quyền quản trị
  if (!isAdmin(senderId, threadId)) {
    await sendMessageInsufficientAuthority(api, message, "Bạn không có quyền sử dụng lệnh này!");
    return;
  }

  // Kiểm tra xem có người được nhắc đến không
  if (!message.data.mentions || message.data.mentions.length === 0) {
    await sendMessageWarning(
      api,
      message,
      ":D Đại Ca muốn taget ai? 🚀",
      false
    );
    return;
  }

  // Đọc danh sách taget hiện tại
  const tagetData = await readTagetList();
  if (!tagetData[threadId]) {
    tagetData[threadId] = { tagetList: [] };
  }
  const uids = [];
  const userDataMentions = [];
  let messageContent = "";

  // Xử lý từng người được nhắc đến
  for (const mention of message.data.mentions) {
    const userId = String(mention.uid); // Chuẩn hóa ID thành chuỗi
    if (isAdmin(userId, threadId)) {

      await sendMessageWarning(
        api,
        message,
        `Đại Ca không thể taget quản trị viên: ${userId} 🚀`,
        false
      );
      continue;
    }
    uids.push(userId);
    try {
      const userInfo = await getUserInfoData(api, userId);
      if (userInfo) {
        userDataMentions.push(userInfo);
      } else {

      }
    } catch (error) {

    }
  }

  if (uids.length === 0) {
    await sendMessageWarning(
      api,
      message,
      "🚨 Không có người dùng hợp lệ để taget!",
      false
    );
    return;
  }

  try {
    // Thêm độ trễ để đảm bảo API ổn định
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Chặn người dùng
    const result = await api.blockUsers(threadId, uids);
    if (result.errorMembers && result.errorMembers.length > 0) {
      await sendMessageWarning(
        api,
        message,
        `🚨 Không thể chặn một số thành viên: ${result.errorMembers.join(", ")}`,
        false
      );
      return;
    }

    let taggedUsers = [];
    let alreadyTaggedUsers = [];

    for (const userInfo of userDataMentions) {
      const userId = String(userInfo.uid);
      const isTagged = tagetData[threadId].tagetList.some((tagged) => tagged.idUserZalo === userId);
      if (isTagged) {
        alreadyTaggedUsers.push(userInfo.name);
      } else {
        tagetData[threadId].tagetList.push({
          idUserZalo: userId,
          senderName: userInfo.name || "Không xác định",
        });
        taggedUsers.push(userInfo.name);
      }

      // Gửi thông báo text cho mỗi người dùng bị chặn
      await api.sendMessage(
        {
          msg: `🚨 Đã chặn và taget ${userInfo.name} trong nhóm!`,
          quote: message,
          ttl: 300000,
        },
        threadId,
        message.type
      );
    }

    // Tạo thông báo tóm tắt
    if (taggedUsers.length > 0) {
      messageContent += `✅ Đã taget và chặn: ${taggedUsers.join(", ")}\n`;
    }
    if (alreadyTaggedUsers.length > 0) {
      messageContent += `❌ Đã taget từ trước: ${alreadyTaggedUsers.join(", ")}\n`;
    }

    if (messageContent.trim() === "") {
      messageContent = "🚨 Không có mục tiêu hợp lệ để taget!";
    }

    await api.sendMessage(
      {
        msg: messageContent.trim(),
        quote: message,
        ttl: 300000,
      },
      threadId,
      message.type
    );

    // Lưu danh sách taget vào file JSON
    if (taggedUsers.length > 0) {

      await writeTagetList(tagetData);
    } else {

    }
  } catch (error) {

    await sendMessageWarning(
      api,
      message,
      `🚨 Lỗi khi xử lý lệnh taget: ${error.message}`,
      false
    );
  }
}
export async function handleMemberJoin(api, event) {
  const threadId = event.threadId;
  const updateMembers = event.data?.updateMembers || [];
  const groupName = event.data?.groupName || "Nhóm";

  if (!updateMembers.length) {
    return;
  }

  // Thử lấy bot ID từ api.getBotId()
  let botId;
  try {
    botId = await api.getBotId();
    if (!botId) {
      throw new Error("ID bot trả về là undefined hoặc null");
    }
  } catch (error) {
    await api.sendMessage(
      {
        msg: `🚨 Cảnh báo: Không thể lấy ID bot từ API: ${error.message}. Tính năng chặn người dùng bị tạm vô hiệu hóa.`,
        ttl: 300000,
      },
      threadId,
      MessageType.GroupMessage
    );
    return; // Thoát hàm nếu không lấy được botId
  }

  for (const member of updateMembers) {
    const userId = String(member.id); // Chuẩn hóa ID thành chuỗi

    try {
      if (await isUserTagged(userId, threadId)) {
        let groupInfo;
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          groupInfo = await api.getGroupInfo(threadId);
          if (!groupInfo || !groupInfo.gridInfoMap?.[threadId]) {
            await api.sendMessage(
              {
                msg: `🚨 Lỗi: Không thể lấy thông tin nhóm ${threadId}!`,
                ttl: 300000,
              },
              threadId,
              MessageType.GroupMessage
            );
            continue;
          }
        } catch (error) {
          await api.sendMessage(
            {
              msg: `🚨 Lỗi: Không thể lấy thông tin nhóm ${threadId}: ${error.message}`,
              ttl: 300000,
            },
            threadId,
            MessageType.GroupMessage
          );
          continue;
        }

        let userName = "Không xác định";
        try {
          const userInfo = await getUserInfoData(api, userId);
          userName = userInfo.name || userName;
        } catch (error) {
        }

        try {
          if (!botId) {
            await api.sendMessage(
              {
                msg: `🚨 Lỗi: ID bot không được cấu hình! Vui lòng liên hệ quản trị viên hệ thống.`,
                ttl: 300000,
              },
              threadId,
              MessageType.GroupMessage
            );
            continue;
          }
          if (!isAdmin(botId, threadId)) {
            await api.sendMessage(
              {
                msg: `🚨 Lỗi: Bot không có quyền chặn người dùng trong nhóm ${groupName}! Vui lòng thêm bot làm quản trị viên.`,
                ttl: 300000,
              },
              threadId,
              MessageType.GroupMessage
            );
            continue;
          }
        } catch (error) {
          await api.sendMessage(
            {
              msg: `🚨 Lỗi: Không thể xác định quyền của bot trong nhóm ${groupName}: ${error.message}`,
              ttl: 300000,
            },
            threadId,
            MessageType.GroupMessage
          );
          continue;
        }

        await new Promise(resolve => setTimeout(resolve, 200));

        try {
          const result = await api.blockUsers(threadId, [userId]);
          if (result.errorMembers && result.errorMembers.includes(userId)) {
            await api.sendMessage(
              {
                msg: `🚨 Lỗi khi chặn ${userName}: Không thể chặn! Error: ${JSON.stringify(result.errorMembers)}`,
                ttl: 300000,
              },
              threadId,
              MessageType.GroupMessage
            );
            continue;
          }

          await api.sendMessage(
            {
              msg: `🚨 ${userName} đã bị chặn do nằm trong danh sách taget!`,
              ttl: 300000,
            },
            threadId,
            MessageType.GroupMessage
          );
        } catch (error) {
          await api.sendMessage(
            {
              msg: `🚨 Lỗi khi chặn ${userName}: ${error.message}`,
              ttl: 300000,
            },
            threadId,
            MessageType.GroupMessage
          );
          continue;
        }
      }
    } catch (error) {
      await api.sendMessage(
        {
          msg: `🚨 Lỗi xử lý thành viên tham gia ${userId}: ${error.message}`,
          ttl: 300000,
        },
        threadId,
        MessageType.GroupMessage
      );
    }
  }
}