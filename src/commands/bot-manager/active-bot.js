import { MessageStyle, MessageType } from "../../api-zalo/index.js";
import { updateNameServer } from "../../database/index.js";
import { isAdmin } from "../../index.js";
import {
  sendMessageComplete,
  sendMessageFailed,
  sendMessageResultRequest, 
} from "../../service-debug/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../service-debug/service.js";
import { removeMention } from "../../utils/format-util.js";
import { readManagerFile, writeManagerFile } from "../../utils/io-json.js";
import schedule from 'node-schedule';
import fs from "fs";
import path from "path";

// Khởi tạo managerData từ file
export const managerData = {
  data: readManagerFile(),
  hasChanges: false,
};

export async function notifyResetGroup(api) {
  const groupRequiredReset = managerData.data.groupRequiredReset;
  if (groupRequiredReset !== "-1") {
    let group;
    try {
      group = await api.getGroupInfo(groupRequiredReset);
    } catch (error) {
      group = null;
    }

    await sendMessageResultRequest(api,
      group ? MessageType.GroupMessage : MessageType.DirectMessage,
      groupRequiredReset,
      "Khởi động lại hoàn tất!\nBot đã hoạt động trở lại!", true, 30000);
    managerData.data.groupRequiredReset = "-1";
    managerData.hasChanges = true;
  }
}

export async function exitRestartBot(api, message) {
  try {
    const threadId = message.threadId;
    managerData.data.groupRequiredReset = threadId;
    managerData.hasChanges = true;
    saveManagerData();

    await sendMessageResultRequest(api, MessageType.GroupMessage, threadId, "Tiến hành khởi động lại...", true, 12000);

    await new Promise(resolve => setTimeout(resolve, 1000));

    process.exit(0);
  } catch (error) {
    await sendMessageFailed(api, message, "Không thể tắt bot: " + error.message, false, 15000);
  }
}

const saveManagerData = () => {
  writeManagerFile(managerData.data);
  managerData.hasChanges = false;
}

// Kiểm tra và lưu thay đổi mỗi 5 giây sử dụng node-schedule
schedule.scheduleJob('*/5 * * * * *', () => {
  if (managerData.hasChanges) {
    saveManagerData();
  }
});

const configPath = path.join(process.cwd(), "assets", "json-data", "database-config.json");

async function handleSetNameServer(api, message, newName) {
  if (!newName) {
    return api.sendMessage("❌ Vui lòng nhập tên server mới!", message.threadId);
  }

  try {
    // Luôn đọc mới từ file trước khi cập nhật
    let config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

    config.nameServer = newName;

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { encoding: "utf-8" });

    // Cập nhật nameServer trong index.js
    await updateNameServer(newName);

    await sendMessageComplete(api, message, `✅ Đã đổi nameServer thành: ${newName}\n`);
  } catch (err) {
    console.error(err);
    await sendMessageFailed(api, message, "⚠️ Lỗi khi đổi nameServer!");
  }
}

export async function handleActiveBotUser(api, message, groupSettings) {
  const content = removeMention(message);
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const prefix = getGlobalPrefix();
  const botCommand = content.replace(`${prefix}bot`, "").trim();

  if (!botCommand || botCommand === "on" || botCommand === "off") {
    if (groupSettings) {
      let newStatus;
      if (!botCommand) {
        newStatus = !groupSettings[threadId].activeBot;
      } else {
        newStatus = botCommand === "off" ? false : true;
      }

      groupSettings[threadId].activeBot = newStatus;

      const statusMessage = newStatus ? "kích hoạt" : "vô hiệu hóa";
      const caption = `Đã ${statusMessage} tương tác thành viên với bot trong nhóm này.`;
      if (newStatus) {
        await sendMessageComplete(api, message, caption);
      } else {
        await sendMessageFailed(api, message, caption);
      }
    } else {
      await sendMessageFailed(api, message, "Không thể setup nhóm ở tin nhắn riêng tư!");
    }

    return true;
  }

  if (botCommand.includes("privatebot")) {
    const privateCommand = botCommand.replace("privatebot", "").trim();
    let newStatus;
    if (!privateCommand) {
      newStatus = !managerData.data.onBotPrivate;
    } else {
      newStatus = privateCommand === "on" ? true : false;
    }
    managerData.data.onBotPrivate = newStatus;
    managerData.hasChanges = true;
    const statusMessage = newStatus ? "kích hoạt" : "vô hiệu hóa";
    const caption = `Đã ${statusMessage} tương tác lệnh trong tin nhắn riêng tư với tất cả người dùng.`;
    if (newStatus) {
      await sendMessageComplete(api, message, caption);
    } else {
      await sendMessageFailed(api, message, caption);
    }
  }

  if (botCommand.includes("privategame")) {
    const privateCommand = botCommand.replace("privategame", "").trim();
    let newStatus;
    if (!privateCommand) {
      newStatus = !managerData.data.onGamePrivate;
    } else {
      newStatus = privateCommand === "on" ? true : false;
    }
    managerData.data.onGamePrivate = newStatus;
    managerData.hasChanges = true;
    const statusMessage = newStatus ? "kích hoạt" : "vô hiệu hóa";
    const caption = `Đã ${statusMessage} tương tác game trong tin nhắn riêng tư với tất cả người dùng.`;
    if (newStatus) {
      await sendMessageComplete(api, message, caption);
    } else {
      await sendMessageFailed(api, message, caption);
    }
  }

  if (botCommand.includes("rs")) {
    if (isAdmin(senderId)) {
      await exitRestartBot(api, message);
      return true;
    }
    await sendMessageFailed(api, message, "Bạn không có quyền khởi động lại bot!");
  }

  // 👉 Lệnh đổi nameServer
  if (botCommand.startsWith("nameServer")) {
    const newName = botCommand.replace("nameServer", "").trim();
    await handleSetNameServer(api, message, newName);
    return true;
  }

  if (!botCommand) {
    let config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const currentName = config.nameServer || "Chưa có nameServer";
    await sendMessageComplete(api, message, `📛 NameServer hiện tại: ${currentName}`);
    return true;
  }

  return false;
}

export async function handleActiveGameUser(
  api,
  message,
  groupSettings
) {
  const content = removeMention(message);
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();
  const gameCommand = `${prefix}gameactive`;

  if (
    content === gameCommand ||
    content === `${gameCommand} on` ||
    content === `${gameCommand} off`
  ) {
    let newStatus;
    if (content === gameCommand) {
      newStatus = !groupSettings[threadId].activeGame;
    } else {
      newStatus = content === `${gameCommand} off` ? false : true;
    }

    groupSettings[threadId].activeGame = newStatus;

    const statusMessage = newStatus ? "kích hoạt" : "vô hiệu hóa";
    const caption = `Đã ${statusMessage} xử lý tương tác trò chơi trong nhóm này.`;
    if (newStatus) {
      await sendMessageComplete(api, message, caption);
    } else {
      await sendMessageFailed(api, message, caption);
    }

    return true;
  }

  return false;
}