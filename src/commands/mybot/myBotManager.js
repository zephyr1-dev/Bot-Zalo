import fs from "fs/promises";
import path from "path";
import { createCanvas, loadImage } from "canvas";
import { createBot } from "./Manager/createBot.js";
import { detailBot } from "./Manager/infoBot.js";
import { getGlobalPrefix } from "../../service-debug/service.js";
import {
  checkBotExists,
  stopPM2Process,
  startBotWithLauncher,
  checkPM2Status,
  waitForPM2Process,
  restartPM2Process,
  updateBotStatus,
  deletePM2Process,
  checkExistingBot,
  createBotConfig,
  validateCredentials,
  getAvailablePort,
  createAllRequiredFiles,
  saveBotToMyBots,
  ensureDirectoriesExist,
} from "./System/pm2-manager.js";
import { sendMessageComplete, sendMessageWarning } from "../../service-debug/chat-zalo/chat-style/chat-style.js";
import { initSession, verifyClient, generateQRCode, waitingScan, waitingConfirm, getUserInfo } from "./Credentials/qr-login.js";
import { handleQrLogin } from "./Manager/qr-login-command.js";
import { loadImageBuffer } from "../../utils/util.js";
import { getUserInfoData } from "../../service-debug/info-service/user-info.js";
import { createBotListImage } from "./list-canvas.js";

const projectRoot = path.resolve(process.cwd());
const myBotDir = path.join(projectRoot, "mybot");
const myBotsPath = path.join(myBotDir, "mybots.json");
const configsDir = path.join(myBotDir, "configs");
const defaultCommand = path.join(myBotDir, "defaultCommand.json");
const botsDir = path.join(myBotDir, "bots");
const adminListPath = path.join("assets", "data", "list_admin.json");
const launcherPath = path.join(projectRoot, "index.js");

export async function mybotHandleCommand(api, message, isAdminLevelHighest, aliasCommand) {
  const { threadId, data: { uidFrom, dName, content, mentions }, type } = message;
  const args = content.split(/\s+/);
  const prefix = getGlobalPrefix();
  const helpargs = `《 HỆ THỐNG QUẢN LÝ BOT 》

✪ Tạo/Sửa Bot:

➤ ${prefix}${aliasCommand} qrlogin: Đăng nhập bot thông qua mã QR
➤ ${prefix}${aliasCommand} login: Đăng nhập bot bằng data của bạn
• Cú pháp: ${prefix}${aliasCommand} login  imei cookie
• Chức năng: Đăng ký/sửa đổi thông tin vào hệ thống Bùi Quang Dũng
• Lưu ý: 
   - Nếu không biết cách điền, chat "${prefix}${aliasCommand} login" để xem hướng dẫn
   - Chỉ hoạt động trong tin nhắn riêng

✪ Trợ Giúp:
➤ ${prefix}${aliasCommand} help: Hướng dẫn quản lý bot căn bản `;
  try {
    if (!args || args.length < 2) {
      return await sendMessageComplete(api, message, helpargs, true, false);
    }

    const subCommand = args[1].toLowerCase();
    const arg = args.slice(1);
    let modifiedMessage = { ...message };
    let isMotherBotAdmin = false;
    try {
      if (await fs.access(adminListPath).then(() => true).catch(() => false)) {
        const adminList = JSON.parse(await fs.readFile(adminListPath, "utf8"));
        isMotherBotAdmin = Array.isArray(adminList) && adminList.includes(uidFrom.toString());
      }
    } catch (error) {
      console.error(`Lỗi đọc file list_admin.json: ${error.message}`);
    }

    if (isMotherBotAdmin && ["delete", "start", "stop", "restart", "detail", "reject", "approve"].includes(subCommand) && args.length >= 3) {
      if (!api.is_main_bot && !isAdminLevelHighest) {
        return await sendMessageWarning(
          api,
          message,
          "Chỉ Main Bot và Quản Trị Cấp Cao của Main Bot mới có thể quản lý hệ thống bot",
          true,
          false
        );
      }
      if (args[2].toLowerCase() === "all") {
        if (subCommand === "detail") {
          return await sendMessageWarning(
            api,
            message,
            `Lệnh ${prefix}${aliasCommand} detail không hỗ trợ chức năng này. Vui lòng sử dụng số thứ tự cụ thể!`,
            true,
            false
          );
        }
        await handleAllBots(api, message, isAdminLevelHighest, subCommand);
        return;
      }
      if (args[2].includes(",")) {
        if (subCommand === "detail") {
          return await sendMessageWarning(
            api,
            message,
            `Lệnh ${prefix}${aliasCommand} detail không hỗ trợ nhiều số thứ tự. Vui lòng sử dụng một số thứ tự cụ thể!`,
            true,
            false
          );
        }
        const indices = args[2].split(",").map(i => parseInt(i.trim(), 10)).filter(i => !isNaN(i));
        if (indices.length === 0) {
          return await sendMessageWarning(api, message, "Danh sách số thứ tự không hợp lệ!", true, false);
        }
        await handleMultipleBots(api, message, isAdminLevelHighest, subCommand, indices);
        return;
      }
      if (/^\d+$/.test(args[2])) {
        const index = parseInt(args[2], 10);
        const botUid = await getBotUidByIndex(index);
        if (!botUid) {
          return await sendMessageWarning(api, message, `Không tìm thấy bot với số thứ tự ${index}!`, true, false);
        }
        modifiedMessage = { ...message, data: { ...message.data, uidFrom: botUid } };
      } else {
        return await sendMessageWarning(
          api,
          message,
          `Sai cú pháp!\nCách dùng: ${prefix}${aliasCommand} ${subCommand} [số thứ tự]`,
          true,
          false
        );
      }
    } else if (isMotherBotAdmin && ["extend", "active", "minus"].includes(subCommand) && args.length >= 3) {
      if (/^\d+$/.test(args[2])) {
        const index = parseInt(args[2], 10);
        const botUid = await getBotUidByIndex(index);
        if (!botUid) {
          return await sendMessageWarning(api, message, `Không tìm thấy bot với số thứ tự ${index}!`, true, false);
        }
        modifiedMessage = { ...message, data: { ...message.data, uidFrom: botUid } };
      } else {
        return await sendMessageWarning(
          api,
          message,
          `Sai cú pháp!\nCách dùng: ${prefix}${aliasCommand} ${subCommand} [số thứ tự] [thời gian|-1]`,
          true,
          false
        );
      }
    }

    switch (subCommand) {
    case "nameserver":
        if (args.length < 3) {
          return await sendMessageWarning(
            api,
            message,
            `Sai cú pháp!\n\nCách dùng: ${prefix}${aliasCommand} nameserver [tên server mới]`,
            true,
            false
          );
        }
        const newNameServer = args.slice(2).join(" ");
        await handleChangeNameServer(api, uidFrom, dName, newNameServer, threadId, type, message);
        break;
      case "detail":
        await detailBot(api, modifiedMessage, isAdminLevelHighest, arg);
        break;
      case "start":
      case "restart":
        if (isMotherBotAdmin && args.length < 3) {
          return await sendMessageWarning(
            api,
            message,
            `Sai cú pháp!\nCách dùng: ${prefix}${aliasCommand} ${subCommand} [Số thứ tự|all|1,2,3]`,
            true,
            false
          );
        }
        await startBot(api, modifiedMessage, isAdminLevelHighest, arg, false);
        break;
      case "stop":
      case "shutdown":
        if (isMotherBotAdmin && args.length < 3) {
          return await sendMessageWarning(
            api,
            message,
            `Sai cú pháp!\nCách dùng: ${prefix}${aliasCommand} ${subCommand} [Số thứ tự|all|1,2,3]`,
            true,
            false
          );
        }
        await stopBot(api, modifiedMessage, isAdminLevelHighest, arg);
        break;
      case "delete":
        if (isMotherBotAdmin && args.length < 3) {
          return await sendMessageWarning(
            api,
            message,
            `Sai cú pháp!\nCách dùng: ${prefix}${aliasCommand} ${subCommand} [Số thứ tự|all|1,2,3]`,
            true,
            false
          );
        }
        await deleteBot(api, modifiedMessage, isAdminLevelHighest, arg);
        break;
      case "qrlogin":
      case "getlogin":
        await handleQrLogin(api, message, threadId, type);
        break;
      case "login":
      case "create":
        await createBot(api, message, isAdminLevelHighest, arg, aliasCommand);
        break;
      case "list":
        await handleListBots(api, threadId, type, message);
        break;
      case "extend":
      case "active":
        if (!isMotherBotAdmin) {
          return await sendMessageWarning(
            api,
            message,
            `Chỉ Main Bot mới có quyền sử dụng lệnh ${subCommand}!`,
            true,
            false
          );
        }
        if (args.length < 4) {
          return await sendMessageWarning(
            api,
            message,
            `Sai cú pháp!\n\nCách dùng: ${prefix}${aliasCommand} ${subCommand} [số thứ tự] [thời gian|-1]\nVí dụ: ${prefix}${aliasCommand} ${subCommand} 1 30d hoặc ${prefix}${aliasCommand} ${subCommand} 1 -1`,
            true,
            false
          );
        }
        await extendBotExpiry(api, modifiedMessage, isAdminLevelHighest, args[3], parseInt(args[2], 10));
        break;
      case "minus":
        if (!isMotherBotAdmin) {
          return await sendMessageWarning(
            api,
            message,
            `Chỉ Main Bot mới có quyền sử dụng lệnh ${subCommand}!`,
            true,
            false
          );
        }
        if (args.length < 4) {
          return await sendMessageWarning(
            api,
            message,
            `Sai cú pháp!\n\nCách dùng: ${prefix}${aliasCommand} ${subCommand} [số thứ tự] [thời gian|-1]\nVí dụ: ${prefix}${aliasCommand} ${subCommand} 1 30d hoặc ${prefix}${aliasCommand} ${subCommand} 1 -1`,
            true,
            false
          );
        }
        await reduceBotExpiry(api, modifiedMessage, isAdminLevelHighest, args[3], parseInt(args[2], 10));
        break;       
      case "clean":
        if (!isMotherBotAdmin) {
          return await sendMessageWarning(
            api,
            message,
            `Chỉ Main Bot mới có quyền sử dụng lệnh ${subCommand}!`,
            true,
            false
          );
        }
        await cleanExpiredBots(api, message, isAdminLevelHighest);
        break;
      case "reject":
        if (!isMotherBotAdmin) {
          return await sendMessageWarning(
            api,
            message,
            `Chỉ Main Bot mới có quyền sử dụng lệnh ${subCommand}!`,
            true,
            false
          );
        }
        if (args.length < 3) {
          return await sendMessageWarning(
            api,
            message,
            `Sai cú pháp!\nCách dùng: ${prefix}${aliasCommand} ${subCommand} [số thứ tự] [-1]`,
            true,
            false
          );
        }
        const isPermanent = args[3] === "-1";
        await rejectBot(api, modifiedMessage, isAdminLevelHighest, isPermanent, dName);
        break;
      case "approve":
        if (!isMotherBotAdmin) {
          return await sendMessageWarning(
            api,
            message,
            `Chỉ Main Bot mới có quyền sử dụng lệnh ${subCommand}!`,
            true,
            false
          );
        }
        if (args.length < 3) {
          return await sendMessageWarning(
            api,
            message,
            `Sai cú pháp!\nCách dùng: ${prefix}${aliasCommand} ${subCommand} [số thứ tự]`,
            true,
            false
          );
        }
        await approveBot(api, modifiedMessage, isAdminLevelHighest);
        break;
      case "update":
        if (args.length < 4) {
          return await sendMessageWarning(
            api,
            message,
            `Sai cú pháp!\nCách dùng: ${prefix}${aliasCommand} ${subCommand} [Imei] [Cookie]`,
            true,
            false
          );
        }
        await updateBotCredentials(api, message, args.slice(2), aliasCommand);
        break;
      case "getupdate":
        await handleQrUpdate(api, message, threadId, type);
        break;
      case "update":
        if (args.length < 3) {
          return await sendMessageWarning(
            api,
            message,
            `Sai cú pháp!\n\nCách dùng:\n• ${prefix}${aliasCommand} ${subCommand} name [tên mới]\n• ${prefix}${aliasCommand} update description [mô tả mới]`,
            true,
            false
          );
        }
        const updateType = args[2].toLowerCase();
        const newValue = args.slice(3).join(" ");
        if (updateType === "name") {
          await handleUpdateName(api, uidFrom, dName, newValue, threadId, type, message);
        } else if (updateType === "description") {
          await handleUpdateDescription(api, uidFrom, dName, newValue, threadId, type, message);
        } else {
          await sendMessageWarning(api, message, "Chỉ hỗ trợ update: name hoặc description", true, false);
        }
        break;
      case "help":
        const helpMessage = `📋 HƯỚNG DẪN QUẢN LÝ BOT 📋:

1️⃣ Các lệnh cơ bản:

➤ ${prefix}${aliasCommand} detail: Xem thông tin chi tiết bot
➤ ${prefix}${aliasCommand} start: Kích hoạt bot
➤ ${prefix}${aliasCommand} restart: Khởi động lại bot
➤ ${prefix}${aliasCommand} stop: Tắt bot tạm thời

2️⃣ Các lệnh quản lý bot:

➤ ${prefix}${aliasCommand} qtv: Xem danh sách lệnh quản lý bot

3️⃣ Đối với quản trị viên

➤ ${prefix}${aliasCommand} manager: Xem danh sách lệnh quản lý hệ thống bot`;

        await sendMessageComplete(api, message, helpMessage, true, false);
        break;
      case "qtv":
        const qtvMessage = `📋 HƯỚNG DẪN QUẢN LÝ BOT 📋

1️⃣ Các lệnh qtv:

➤ ${prefix}${aliasCommand} nameserver: Đổi tên server của bot 
➤ ${prefix}${aliasCommand} update: Cập nhật Imei và Cookie
➤ ${prefix}${aliasCommand} getupdate: Cập nhật thông tin đăng nhập qua QR
➤ ${prefix}${aliasCommand} delete: Xoá bot khỏi hệ thống`;
        await sendMessageComplete(api, message, qtvMessage, true, false);
        break;
      case "manager":
        if (!isMotherBotAdmin) {
          await sendMessageWarning(api, message, "Chỉ có quản trị cấp cao của Bot Admin mới có thể kiểm tra danh sách lệnh quản trị");
          return;
        }
        const managerMessage = `👮 LỆNH QUẢN TRỊ BOT 👮

✪ Quản lý danh sách:
  ➤ ${prefix}${aliasCommand} list: Xem danh sách tất cả bot
  ➤ ${prefix}${aliasCommand} notify [nội dung]: Thông báo cho tất cả khách hàng đang thuê bot

✪ Quản lý bot cụ thể:
  ➤ ${prefix}${aliasCommand} detail [index]: Xem thông tin bot theo số thứ tự
  ➤ ${prefix}${aliasCommand} restart [index]: Reset lại bot theo số thứ tự
  ➤ ${prefix}${aliasCommand} start [index]: Khởi động bot theo số thứ tự
  ➤ ${prefix}${aliasCommand} stop [index] - Tắt bot theo số thứ tự

✪ Phê duyệt/Từ chối bot:
  ➤ ${prefix}${aliasCommand} approve: Cho phép bot hoạt động lại
  ➤ ${prefix}${aliasCommand} reject: Vô hiệu hóa bot hoàn toàn
  ➤ ${prefix}${aliasCommand} extend: Gia hạn bot
  ➤ ${prefix}${aliasCommand} minus: Rút ngắn hạn bot hoặc đặt hết hạn vĩnh viễn

✪ Quản lý hệ thống:
  ➤ ${prefix}${aliasCommand} delete: Xoá bot khỏi hệ thống
  ➤ ${prefix}${aliasCommand} clean: Xóa các bot đã hết hạn
  ➤ ${prefix}${aliasCommand} restart all: Khởi chạy tất cả bot
  ➤ ${prefix}${aliasCommand} stop all: Tắt tất cả bot`;

        await sendMessageWarning(api, message, managerMessage, true, false);
        break;
      default:
        break;
    }
  } catch (error) {
    await handleError(error, api, threadId, "xử lý lệnh mybot", type, message);
  }
}

export async function startBot(api, message, isAdminLevelHighest, args, suppressMessages = false) {
  const { threadId, data: { uidFrom, dName }, type } = message;
  try {
    const checkResult = await checkBotExists(uidFrom);
    if (!checkResult.exists) {
      if (!suppressMessages) {
        await sendMessageWarning(api, message, "Bạn chưa có BOT được tạo", true, false);
      }
      return false;
    }
    const botInfo = checkResult.botInfo;
    if (botInfo.status === "rejected") {
      if (!suppressMessages) {
        await sendMessageWarning(api, message, `Không thể khởi động bot ${botInfo.displayName || botInfo.name || uidFrom} vì đã bị Bot Admin vô hiệu hóa!!`, true, false);
      }
      return false;
    }
    if (["trialExpired", "expired", "stopping"].includes(botInfo.status)) {
      const statusMessages = {
        trialExpired: "Bạn đã hết thời gian dùng thử! Hãy gia hạn bot của bạn.",
        expired: "Bot của bạn đã hết hạn! Hãy gia hạn để tiếp tục sử dụng.",
        stopping: "Bot của bạn đang trong trạng thái bảo trì! Hãy liên hệ admin.",
      };
      if (!suppressMessages) {
        await sendMessageWarning(api, message, statusMessages[botInfo.status], true, false);
      }
      return false;
    }
    const pm2Status = await checkPM2Status(uidFrom);
    const botName = botInfo.displayName || botInfo.name || uidFrom;
    const createdBy = botInfo.createdBy || dName;
    const restartMessage = botName === createdBy
      ? `Đang khởi động lại bot của ${botName}`
      : `Đang khởi động lại bot ${botName} của ${createdBy}`;

    if (botInfo.status === "running" && pm2Status.running) {
      if (!suppressMessages) {
        await sendMessageComplete(api, message, restartMessage, true, false);
      }
      const restartSuccess = await restartPM2Process(uidFrom);
      if (restartSuccess) {
        if (!suppressMessages) {
          await sendMessageComplete(
            api,
            message,
            `Đã khởi động lại bot thành công!\nTên: ${botName}\nTrạng thái: Đang hoạt động\nWeb Port: ${botInfo.webPort}`,
            true,
            false
          );
        }
        console.log(`Bot "${uidFrom}" đã được khởi động lại bởi ${dName}`);
        return true;
      } else {
        if (!suppressMessages) {
          await sendMessageWarning(api, message, "Không thể khởi động lại bot. Vui lòng thử lại sau!", true, false);
        }
        return false;
      }
    }
    if (botInfo.status === "stopped" || !pm2Status.running) {
      if (!suppressMessages) {
        await sendMessageComplete(api, message, "Đang khởi động bot của bạn", true, false);
      }
      if (!(await fs.access(launcherPath).then(() => true).catch(() => false))) {
        if (!suppressMessages) {
          await sendMessageWarning(api, message, "Đã xảy ra lỗi nghiêm trọng!!!", true, false);
        }
        return false;
      }
      const startSuccess = await startBotWithLauncher(uidFrom);
      if (startSuccess) {
        await updateBotStatus(uidFrom, "running");
        if (!suppressMessages) {
          await sendMessageComplete(
            api,
            message,
            `Đã khởi động lại bot thành công!\nTên: ${botName}\nTrạng thái: Đang hoạt động`,
            true,
            false
          );
        }
        console.log(`Bot "${uidFrom}" đã được khởi động bởi ${dName}`);
        return true;
      } else {
        if (!suppressMessages) {
          await sendMessageWarning(api, message, "Không thể khởi động bot. Vui lòng kiểm tra logs và thử lại sau!", true, false);
        }
        return false;
      }
    }
    if (!suppressMessages) {
      await sendMessageWarning(
        api,
        message,
        `📊 Trạng thái bot hiện tại: ${botInfo.status}\n💡 Vui lòng liên hệ admin nếu cần hỗ trợ.`,
        true,
        false
      );
    }
    return false;
  } catch (error) {
    await handleError(error, api, threadId, "khởi động bot", type, message);
    return false;
  }
}

export async function deleteBot(api, message, isAdminLevelHighest, args) {
  const { threadId, data: { uidFrom, dName }, type } = message;
  try {
    const checkResult = await checkBotExists(uidFrom);
    if (!checkResult.exists) {
      await sendMessageComplete(api, message, "Bạn chưa có bot để xóa!!", true, false);
      return false;
    }
    const botInfo = checkResult.botInfo;
    const pm2Status = await checkPM2Status(uidFrom);
    if (pm2Status.running) {
      console.log(`Stopping PM2 process for bot ${uidFrom} before deletion...`);
      const stopSuccess = await stopPM2Process(uidFrom);
      if (!stopSuccess) {
        console.warn(`Failed to stop PM2 process for bot ${uidFrom}, continuing with deletion...`);
      }
    }
    const deleteSuccess = await deletePM2Process(uidFrom);
    if (!deleteSuccess) {
      await sendMessageWarning(api, message, "Không thể xóa tiến trình PM2. Vui lòng thử lại!", true, false);
      return false;
    }

    // Lấy cấu hình bot để xác định các file và thư mục cần xóa
    const botConfig = createBotConfig(uidFrom, botInfo.webPort);

    // Danh sách các file cần xóa từ botConfig
    const filesToDelete = [
      botConfig.configFilePath,
      botConfig.groupSettingsPath,
      botConfig.adminFilePath,
      botConfig.commandFilePath,
      botConfig.MANAGER_FILE_PATH,
      botConfig.DATA_GAME_FILE_PATH,
      botConfig.DATA_NT_PATH,
      botConfig.PROPHYLACTIC_CONFIG_PATH,
      botConfig.WEB_CONFIG_PATH,
      botConfig.databaseFile,
      botConfig.dataTrainingPath,
      botConfig.rankInfoPath,
      path.join(botsDir, `${uidFrom}.json`), // File cấu hình bot chính
    ];

    // Danh sách các thư mục cần xóa (nếu trống)
    const directoriesToDelete = [
      botConfig.logDir,
      botConfig.resourceDir,
      botConfig.tempDir,
      botConfig.dataGifPath,
    ];

    // Xóa các file
    for (const file of filesToDelete) {
      const filePath = path.join(projectRoot, file);
      try {
        if (await fs.access(filePath).then(() => true).catch(() => false)) {
          await fs.unlink(filePath);
          console.log(`Đã xóa file: ${filePath}`);
        }
      } catch (error) {
        console.warn(`Không thể xóa file ${filePath}: ${error.message}`);
      }
    }

    // Xóa các thư mục (chỉ xóa nếu trống để tránh xóa dữ liệu không mong muốn)
    for (const dir of directoriesToDelete) {
      const dirPath = path.join(projectRoot, dir);
      try {
        if (await fs.access(dirPath).then(() => true).catch(() => false)) {
          await fs.rm(dirPath, { recursive: true, force: true });
          console.log(`Đã xóa thư mục: ${dirPath}`);
        }
      } catch (error) {
        console.warn(`Không thể xóa thư mục ${dirPath}: ${error.message}`);
      }
    }

    // Xóa bot khỏi danh sách mybots.json
    const removeSuccess = await removeBotFromList(uidFrom);
    if (removeSuccess) {
      const botName = botInfo.displayName || botInfo.name || uidFrom;
      await sendMessageComplete(api, message, `Đã xóa bot ${botName} khỏi hệ thống quản lý bot!`, true, false);
      console.log(`Bot "${uidFrom}" đã được xóa hoàn toàn bởi ${dName}`);
      return true;
    } else {
      await sendMessageWarning(api, message, "Đã xảy ra lỗi khi xóa bot khỏi danh sách. Vui lòng thử lại!", true, false);
      return false;
    }
  } catch (error) {
    await handleError(error, api, threadId, "xóa bot", type, message);
    return false;
  }
}

export async function stopBot(api, message, isAdminLevelHighest, args) {
  const { threadId, data: { uidFrom, dName }, type } = message;
  try {
    const checkResult = await checkBotExists(uidFrom);
    if (!checkResult.exists) {
      await sendMessageWarning(api, message, "Bạn không có bot để dừng", true, false);
      return false;
    }
    const botInfo = checkResult.botInfo;
    const botName = botInfo.displayName || botInfo.name || uidFrom;
    if (botInfo.status === "stopped") {
      await sendMessageWarning(api, message, "Bot của bạn có chạy đâu mà dừng", true, false);
      return false;
    }
    if (["trialExpired", "expired", "stopping", "rejected"].includes(botInfo.status)) {
      const statusMessages = {
        trialExpired: "Bạn đã hết thời gian dùng thử! Hãy gia hạn bot của bạn.",
        expired: "Bot của bạn đã hết hạn! Hãy gia hạn để tiếp tục sử dụng.",
        stopping: "Bot của bạn đang trong trạng thái bảo trì! Hãy liên hệ admin.",
        rejected: `Bot ${botName} đã bị Bot Admin vô hiệu hóa!`,
      };
      await sendMessageWarning(api, message, statusMessages[botInfo.status], true, false);
      return false;
    }
    const pm2Status = await checkPM2Status(uidFrom);
    if (!pm2Status.running) {
      await updateBotStatus(uidFrom, "stopped");
      await sendMessageWarning(api, message, "Bot của bạn đã dừng từ trước!!", true, false);
      return false;
    }
    const stopSuccess = await stopPM2Process(uidFrom);
    if (stopSuccess) {
      await updateBotStatus(uidFrom, "stopped");
      await sendMessageComplete(api, message, `Bot: ${botName} đã tạm dừng trong hệ thống!!`, true, false);
      console.log(`Bot "${uidFrom}" đã được dừng bởi ${dName}`);
      return true;
    } else {
      await sendMessageWarning(api, message, "Không thể dừng bot. Vui lòng thử lại hoặc liên hệ admin!", true, false);
      return false;
    }
  } catch (error) {
    await handleError(error, api, threadId, "dừng bot", type, message);
    return false;
  }
}

async function cleanExpiredBots(api, message, isAdminLevelHighest) {
  const { threadId, data: { dName }, type } = message;
  try {
    if (!(await fs.access(myBotsPath).then(() => true).catch(() => false))) {
      return await sendMessageWarning(api, message, "Chưa có bot nào được tạo!", true, false);
    }
    const myBots = JSON.parse(await fs.readFile(myBotsPath, "utf8"));
    const botList = Object.keys(myBots);
    if (botList.length === 0) {
      return await sendMessageWarning(api, message, "Danh sách bot trống!", true, false);
    }
    const startTime = Date.now();
    await sendMessageComplete(api, message, "Đang kiểm tra và xóa các bot đã hết hạn...", true, false);
    let deletedCount = 0;
    const currentTime = new Date();
    for (const uid of botList) {
      const botInfo = myBots[uid];
      if (botInfo.expiryAt !== "-1" && new Date(botInfo.expiryAt) < currentTime && botInfo.status !== "rejected") {
        const modifiedMessage = { ...message, data: { ...message.data, uidFrom: uid } };
        const result = await deleteBot(api, modifiedMessage, isAdminLevelHighest, [], true);
        if (result) deletedCount++;
      }
    }
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    await sendMessageComplete(
      api,
      message,
      `Đã xóa ${deletedCount}/${botList.length} bot hết hạn trong ${duration}s`,
      true,
      false
    );
    console.log(`Cleaned ${deletedCount}/${botList.length} expired bots by ${dName} in ${duration}s`);
  } catch (error) {
    await handleError(error, api, threadId, "xóa bot hết hạn", type, message);
  }
}

async function rejectBot(api, message, isAdminLevelHighest, isPermanent, rejecter) {
  const { threadId, data: { uidFrom, dName }, type } = message;
  try {
    const checkResult = await checkBotExists(uidFrom);
    if (!checkResult.exists) {
      await sendMessageWarning(api, message, "Bot không tồn tại!", true, false);
      return false;
    }
    const botInfo = checkResult.botInfo;
    const botName = botInfo.displayName || botInfo.name || uidFrom;
    if (botInfo.status === "rejected") {
      await sendMessageWarning(api, message, `Bot ${botName} đã bị vô hiệu hóa trước đó!`, true, false);
      return false;
    }
    const pm2Status = await checkPM2Status(uidFrom);
    if (pm2Status.running) {
      const stopSuccess = await stopPM2Process(uidFrom);
      if (!stopSuccess) {
        console.warn(`Failed to stop PM2 process for bot ${uidFrom} during rejection`);
      }
    }
    const updates = [
      { field: "status", value: "rejected" },
      { field: "rejecter", value: rejecter },
    ];
    if (isPermanent) {
      const expiredTime = new Date(Date.now() - 1000).toISOString();
      updates.push({ field: "expiryAt", value: expiredTime });
    }
    let allUpdatesSuccessful = true;
    for (const { field, value } of updates) {
      const updated = await updateBotField(uidFrom, field, value);
      if (!updated) {
        allUpdatesSuccessful = false;
        console.warn(`Failed to update ${field} for bot ${uidFrom}`);
      }
    }
    if (allUpdatesSuccessful) {
      const messageText = isPermanent
        ? `Bot ${botName} đã bị vô hiệu hóa vĩnh viễn và đánh dấu hết hạn bởi ${rejecter}!`
        : `Bot ${botName} đã bị vô hiệu hóa thành công bởi ${rejecter}!`;
      await sendMessageComplete(api, message, messageText, true, false);
      console.log(`Bot ${uidFrom} ${isPermanent ? "permanently rejected and expired" : "rejected"} by ${rejecter}`);
      return true;
    } else {
      await sendMessageWarning(api, message, "Không thể vô hiệu hóa bot hoàn toàn. Vui lòng thử lại!", true, false);
      return false;
    }
  } catch (error) {
    await handleError(error, api, threadId, "vô hiệu hóa bot", type, message);
    return false;
  }
}

async function approveBot(api, message, isAdminLevelHighest) {
  const { threadId, data: { uidFrom, dName }, type } = message;
  try {
    const checkResult = await checkBotExists(uidFrom);
    if (!checkResult.exists) {
      await sendMessageWarning(api, message, "Bot không tồn tại!", true, false);
      return false;
    }
    const botInfo = checkResult.botInfo;
    const botName = botInfo.displayName || botInfo.name || uidFrom;
    if (botInfo.status !== "rejected") {
      await sendMessageWarning(api, message, `Bot ${botName} không ở trạng thái bị vô hiệu hóa!`, true, false);
      return false;
    }
    const currentTime = new Date();
    const expiryTime = new Date(botInfo.expiryAt);
    const updatedStatus = botInfo.expiryAt === "-1" || expiryTime > currentTime ? "stopped" : "expired";
    const updated = await updateBotField(uidFrom, "status", updatedStatus);
    if (updated) {
      await sendMessageComplete(
        api,
        message,
        `Bot ${botName} đã được cho phép hoạt động lại bởi ${dName}!\nTrạng thái: ${updatedStatus === "stopped" ? "Đã dừng" : "Hết hạn"}`,
        true,
        false
      );
      console.log(`Bot ${uidFrom} approved by ${dName}, status set to ${updatedStatus}`);
      return true;
    } else {
      await sendMessageWarning(api, message, "Không thể cho phép bot. Vui lòng thử lại!", true, false);
      return false;
    }
  } catch (error) {
    await handleError(error, api, threadId, "cho phép bot", type, message);
    return false;
  }
}

async function updateBotCredentials(api, message, args, aliasCommand) {
  const { threadId, data: { uidFrom, dName }, type } = message;
  try {
    const checkResult = await checkBotExists(uidFrom);
    if (!checkResult.exists) {
      return await sendMessageWarning(api, message, "Bạn chưa có bot để cập nhật!", true, false);
    }
    const botInfo = checkResult.botInfo;
    const botName = botInfo.displayName || botInfo.name || uidFrom;
    const currentTime = new Date();
    if (botInfo.expiryAt !== "-1" && new Date(botInfo.expiryAt) < currentTime) {
      return await sendMessageWarning(
        api,
        message,
        `Bot không có thời hạn để thay đổi cấu hình, còn gì đâu. Thay làm méo gì!`,
        true,
        false
      );
    }
    const validationResult = validateCredentials(args, getGlobalPrefix(), aliasCommand);
    if (!validationResult.valid) {
      return await sendMessageWarning(api, message, validationResult.message, true, false);
    }
    const credentialsData = {
      cookie: {
        url: "https://chat.zalo.me",
        cookies: JSON.parse(args[1])
      },
      imei: args[0],
      userAgent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36"
    };
    const botConfig = createBotConfig(uidFrom, botInfo.webPort);
    await fs.writeFile(path.join(projectRoot, botConfig.configFilePath), JSON.stringify(credentialsData, null, 2), "utf-8");
    await sendMessageComplete(
      api,
      message,
      `Đã cập nhật thông tin đăng nhập cho bot ${botName} thành công!`,
      true,
      false
    );
    console.log(`Bot ${uidFrom} credentials updated by ${dName}`);
    if (botInfo.status === "running") {
      const restartSuccess = await restartPM2Process(uidFrom);
      if (restartSuccess) {
        await sendMessageComplete(
          api,
          message,
          `Bot ${botName} đã được khởi động lại để áp dụng thông tin mới!`,
          true,
          false
        );
      } else {
        await sendMessageWarning(api, message, "Không thể khởi động lại bot sau khi cập nhật!", true, false);
      }
    }
  } catch (error) {
    await handleError(error, api, threadId, "cập nhật thông tin đăng nhập bot", type, message);
  }
}

async function handleQrUpdate(api, message, threadId, type) {
  const { data: { dName, uidFrom } } = message;
  const qrPath = path.join(process.cwd(), ".cache", "qr_code.png");

  try {
    console.log(`[DEBUG] Starting handleQrUpdate for uidFrom=${uidFrom}, threadId=${threadId}, type=${type}`);

    const checkResult = await checkBotExists(uidFrom);
    if (!checkResult.exists) {
      return await sendMessageWarning(api, message, "Bạn chưa có bot để cập nhật!", true, false);
    }
    const botInfo = checkResult.botInfo;
    const botName = botInfo.displayName || botInfo.name || uidFrom;
    const currentTime = new Date();
    if (botInfo.expiryAt !== "-1" && new Date(botInfo.expiryAt) < currentTime) {
      return await sendMessageWarning(
        api,
        message,
        `Bot không có thời hạn để thay đổi cấu hình, còn gì đâu. Thay làm méo gì!`,
        true,
        false
      );
    }

    let session = await initSession();
    if (!session) {
      console.error("[ERROR] Failed to initialize session");
      await sendMessageWarning(api, message, `Không thể khởi tạo phiên đăng nhập! Vui lòng thử lại sau.`, true, false);
      return;
    }

    session = await verifyClient(session);
    if (!session) {
      console.error("[ERROR] Failed to verify client");
      await sendMessageWarning(api, message, `Không thể xác minh phiên đăng nhập! Vui lòng thử lại sau.`, true, false);
      return;
    }

    const [code, updatedSession] = await generateQRCode(session);
    session = updatedSession;
    if (!code) {
      console.error("[ERROR] Failed to generate QR code");
      await sendMessageWarning(api, message, `Đã xảy ra lỗi khi tạo QR`, true, false);
      return;
    }

    if (!(await validateImageFile(qrPath))) {
      console.error(`[ERROR] QR code image at ${qrPath} is invalid or missing`);
      await sendMessageWarning(api, message, `Đã xảy ra lỗi khi tạo QR`, true, false);
      return;
    }

    try {
      await api.sendMessage(
        {
          msg: `${dName}, mở app Zalo và quét mã QR này để cập nhật thông tin đăng nhập!`,
          attachments: [qrPath],
          mentions: [{ pos: 0, uid: uidFrom, len: dName.length }],
          ttl: 300000
        },
        threadId,
        type
      );
      console.log(`[DEBUG] QR code image sent successfully to threadId=${threadId}`);
    } catch (error) {
      console.error(`[ERROR] Failed to send QR code image: ${error.message}`);
      await sendMessageWarning(api, message, `Đã xảy ra lỗi khi gửi QR`, true, false);
      return;
    }

    const scanResult = await waitingScan(code, session);
    if (!scanResult) {
      console.error("[ERROR] QR code scan not completed");
      await sendMessageWarning(api, message, `Cập nhật không thành công`, true, false);
      return;
    }

    console.log("[DEBUG] QR code scanned successfully");
    await sendMessageComplete(api, message, `Đã quét QR, vui lòng xác nhận cập nhật trên thiết bị của bạn.`, true, false);

    const [resultData, rawCookies] = await waitingConfirm(code, session);
    if (!resultData || !rawCookies) {
      console.error("[ERROR] QR code confirmation not completed");
      await sendMessageWarning(api, message, `Cập nhật không thành công, do người dùng từ chối xác nhận`, true, false);
      return;
    }

    console.log("[DEBUG] Update confirmation successful");

    const userInfo = await getUserInfo(session);
    if (!userInfo) {
      console.error("[ERROR] Failed to get user info");
      await sendMessageWarning(api, message, `Cập nhật thành công nhưng không thể lấy thông tin người dùng!`, true, false);
      return;
    }

    try {
      const credentialsData = {
        cookie: {
          url: "https://chat.zalo.me",
          cookies: rawCookies.cookies
        },
        imei: resultData.imei,
        userAgent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36"
      };
      const botConfig = createBotConfig(uidFrom, botInfo.webPort);
      await fs.writeFile(path.join(projectRoot, botConfig.configFilePath), JSON.stringify(credentialsData, null, 2), "utf-8");
      await sendMessageComplete(
        api,
        message,
        `Đã cập nhật thông tin đăng nhập cho bot ${botName} thành công!\nTên: ${userInfo.data.info.name}`,
        true,
        false
      );
      console.log(`Bot ${uidFrom} credentials updated via QR by ${dName}`);
      if (botInfo.status === "running") {
        const restartSuccess = await restartPM2Process(uidFrom);
        if (restartSuccess) {
          await sendMessageComplete(
            api,
            message,
            `Bot ${botName} đã được khởi động lại để áp dụng thông tin mới!`,
            true,
            false
          );
        } else {
          await sendMessageWarning(api, message, "Không thể khởi động lại bot sau khi cập nhật!", true, false);
        }
      }
    } catch (error) {
      console.error(`[ERROR] Failed to update bot credentials: ${error.message}`);
      await sendMessageWarning(api, message, `Cập nhật thành công nhưng không thể cập nhật thông tin bot!`, true, false);
    }
  } catch (error) {
    console.error(`[ERROR] Unexpected error in handleQrUpdate: ${error.message}`);
    await sendMessageWarning(api, message, `Đã xảy ra lỗi khi xử lý lệnh getupdate: ${error.message}`, true, false);
  }
}

async function handleAllBots(api, message, isAdminLevelHighest, subCommand) {
  const { threadId, data: { dName }, type } = message;
  try {
    if (!(await fs.access(myBotsPath).then(() => true).catch(() => false))) {
      return await sendMessageWarning(api, message, "Chưa có bot nào được tạo!", true, false);
    }
    const myBots = JSON.parse(await fs.readFile(myBotsPath, "utf8"));
    const botList = Object.keys(myBots);
    if (botList.length === 0) {
      return await sendMessageWarning(api, message, "Danh sách bot trống!", true, false);
    }
    const startTime = Date.now();
    await sendMessageComplete(api, message, `Tiến hành ${subCommand} tất cả bot...`, true, false);
    let successCount = 0;
    for (const uid of botList) {
      const modifiedMessage = { ...message, data: { ...message.data, uidFrom: uid } };
      if (subCommand === "start" || subCommand === "restart") {
        const result = await startBot(api, modifiedMessage, isAdminLevelHighest, [], true);
        if (result) successCount++;
      } else if (subCommand === "stop" || subCommand === "shutdown") {
        const result = await stopBot(api, modifiedMessage, isAdminLevelHighest, []);
        if (result) successCount++;
      } else if (subCommand === "delete") {
        const result = await deleteBot(api, modifiedMessage, isAdminLevelHighest, []);
        if (result) successCount++;
      } else if (subCommand === "reject") {
        const result = await rejectBot(api, modifiedMessage, isAdminLevelHighest, false, dName);
        if (result) successCount++;
      } else if (subCommand === "approve") {
        const result = await approveBot(api, modifiedMessage, isAdminLevelHighest);
        if (result) successCount++;
      }
    }
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const actionVerb = {
      start: "khởi động",
      restart: "khởi động lại",
      stop: "dừng",
      shutdown: "dừng",
      delete: "xóa",
      reject: "vô hiệu hóa",
      approve: "cho phép",
    }[subCommand] || subCommand;
    await sendMessageComplete(
      api,
      message,
      `Đã ${actionVerb} ${successCount}/${botList.length} bot trong ${duration}s`,
      true,
      false
    );
    console.log(`Performed ${subCommand} on all bots by ${dName}, ${successCount}/${botList.length} successful in ${duration}s`);
  } catch (error) {
    await handleError(error, api, threadId, `${subCommand} tất cả bot`, type, message);
  }
}

function parseTimeDuration(timeStr) {
  const regex = /^(\d+)(s|min|h|d|mon|y)$/;
  const match = timeStr.match(regex);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = {
    s: 1000,
    min: 1000 * 60,
    h: 1000 * 60 * 60,
    d: 1000 * 60 * 60 * 24,
    mon: 1000 * 60 * 60 * 24 * 30,
    y: 1000 * 60 * 60 * 24 * 365,
  };
  return value * multipliers[unit];
}

async function handleMultipleBots(api, message, isAdminLevelHighest, subCommand, indices) {
  const { threadId, data: { dName }, type } = message;
  try {
    if (!(await fs.access(myBotsPath).then(() => true).catch(() => false))) {
      return await sendMessageWarning(api, message, "Chưa có bot nào được tạo!", true, false);
    }
    const myBots = JSON.parse(await fs.readFile(myBotsPath, "utf8"));
    const botList = Object.keys(myBots);
    const validUids = [];
    for (const index of indices) {
      const uid = await getBotUidByIndex(index);
      if (uid && botList.includes(uid)) {
        validUids.push(uid);
      }
    }
    if (validUids.length === 0) {
      return await sendMessageWarning(api, message, "Không tìm thấy bot nào trong danh sách số thứ tự cung cấp!", true, false);
    }
    const startTime = Date.now();
    await sendMessageComplete(api, message, `Tiến hành ${subCommand} ${validUids.length} bot...`, true, false);
    let successCount = 0;
    for (const uid of validUids) {
      const modifiedMessage = { ...message, data: { ...message.data, uidFrom: uid } };
      if (subCommand === "start" || subCommand === "restart") {
        const result = await startBot(api, modifiedMessage, isAdminLevelHighest, [], true);
        if (result) successCount++;
      } else if (subCommand === "stop" || subCommand === "shutdown") {
        const result = await stopBot(api, modifiedMessage, isAdminLevelHighest, []);
        if (result) successCount++;
      } else if (subCommand === "delete") {
        const result = await deleteBot(api, modifiedMessage, isAdminLevelHighest, []);
        if (result) successCount++;
      } else if (subCommand === "reject") {
        const result = await rejectBot(api, modifiedMessage, isAdminLevelHighest, false, dName);
        if (result) successCount++;
      } else if (subCommand === "approve") {
        const result = await approveBot(api, modifiedMessage, isAdminLevelHighest);
        if (result) successCount++;
      }
    }
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const actionVerb = {
      start: "khởi động",
      restart: "khởi động lại",
      stop: "dừng",
      shutdown: "dừng",
      delete: "xóa",
      reject: "vô hiệu hóa",
      approve: "cho phép",
    }[subCommand] || subCommand;
    await sendMessageComplete(
      api,
      message,
      `Đã ${actionVerb} ${successCount}/${validUids.length} bot trong ${duration}s`,
      true,
      false
    );
    console.log(`Performed ${subCommand} on bots ${validUids.join(",")} by ${dName}, ${successCount}/${validUids.length} successful in ${duration}s`);
  } catch (error) {
    await handleError(error, api, threadId, `${subCommand} nhiều bot`, type, message);
  }
}

async function extendBotExpiry(api, message, isAdminLevelHighest, timeStr, index) {
  const { threadId, data: { uidFrom, dName }, type } = message;
  try {
    const checkResult = await checkBotExists(uidFrom);
    if (!checkResult.exists) {
      return await sendMessageWarning(api, message, `Bot với số thứ tự ${index} không tồn tại!`, true, false);
    }
    const botInfo = checkResult.botInfo;
    const botName = botInfo.displayName || botInfo.name || uidFrom;
    let newExpiry;
    if (timeStr === "-1") {
      newExpiry = "-1";
    } else {
      const durationMs = parseTimeDuration(timeStr);
      if (!durationMs) {
        return await sendMessageWarning(
          api,
          message,
          `Định dạng thời gian không hợp lệ!`,
          true,
          false
        );
      }
      const currentExpiry = new Date(botInfo.expiryAt);
      newExpiry = new Date(currentExpiry.getTime() + durationMs).toISOString();
    }
    const currentTime = new Date();
    const updated = await updateBotField(uidFrom, "expiryAt", newExpiry);
    if (!updated) {
      return await sendMessageWarning(api, message, "Không thể gia hạn bot. Vui lòng thử lại!", true, false);
    }
    let statusMessage = `Đã gia hạn bot thành công!\n\n🤖 Bot: ${botName}\n🆔 Bot ID: ${uidFrom}\n⏰ Hết hạn mới: ${newExpiry === "-1" ? "Vĩnh viễn" : formatDateTime(new Date(newExpiry))}\n👤 Gia hạn bởi: ${dName}`;
    if ((newExpiry === "-1" || new Date(newExpiry) > currentTime) && ["expired", "trialExpired"].includes(botInfo.status)) {
      const pm2Status = await checkPM2Status(uidFrom);
      if (!pm2Status.running) {
        if (await fs.access(launcherPath).then(() => true).catch(() => false)) {
          const startSuccess = await startBotWithLauncher(uidFrom);
          if (startSuccess) {
            await updateBotStatus(uidFrom, "running");
            statusMessage += `\n📊 Trạng thái: Đang hoạt động`;
            console.log(`Bot ${uidFrom} started after extension by ${dName}`);
          } else {
            await updateBotStatus(uidFrom, "stopped");
            statusMessage += `\n📊 Trạng thái: Đã dừng (không thể khởi động bot)`;
            console.warn(`Failed to start bot ${uidFrom} after extension`);
          }
        } else {
          await updateBotStatus(uidFrom, "stopped");
          statusMessage += `\n📊 Trạng thái: Đã dừng (launcher không tồn tại)`;
          console.warn(`Launcher not found for bot ${uidFrom} after extension`);
        }
      } else {
        await updateBotStatus(uidFrom, "running");
        statusMessage += `\n📊 Trạng thái: Đang hoạt động`;
      }
    }
    await sendMessageComplete(api, message, statusMessage, true, false);
    console.log(`Bot ${uidFrom} expiry extended to ${newExpiry} by ${dName}`);
  } catch (error) {
    await handleError(error, api, threadId, "gia hạn bot", type, message);
  }
}

async function reduceBotExpiry(api, message, isAdminLevelHighest, timeStr, index) {
  const { threadId, data: { uidFrom, dName }, type } = message;
  try {
    const checkResult = await checkBotExists(uidFrom);
    if (!checkResult.exists) {
      return await sendMessageWarning(api, message, `Bot với số thứ tự ${index} không tồn tại!`, true, false);
    }
    const botInfo = checkResult.botInfo;
    const botName = botInfo.displayName || botInfo.name || uidFrom;

    let newExpiry;
    if (timeStr === "-1") {
      newExpiry = new Date(Date.now() - 1000).toISOString();
    } else {
      const durationMs = parseTimeDuration(timeStr);
      if (!durationMs) {
        return await sendMessageWarning(
          api,
          message,
          `Định dạng thời gian không hợp lệ! Sử dụng: <số><đơn vị> (s/min/h/d/mon/y) hoặc -1 để hết hạn ngay`,
          true,
          false
        );
      }
      const currentExpiry = botInfo.expiryAt === "-1" ? new Date() : new Date(botInfo.expiryAt);
      newExpiry = new Date(currentExpiry.getTime() - durationMs);
      if (newExpiry < new Date()) {
        return await sendMessageWarning(
          api,
          message,
          `Không thể rút ngắn thời gian! Thời gian hết hạn mới (${formatDateTime(newExpiry)}) nhỏ hơn thời gian hiện tại.`,
          true,
          false
        );
      }
      newExpiry = newExpiry.toISOString();
    }

    const updated = await updateBotField(uidFrom, "expiryAt", newExpiry);
    if (!updated) {
      return await sendMessageWarning(api, message, "Không thể cập nhật thời gian bot. Vui lòng thử lại!", true, false);
    }

    if (newExpiry < new Date().toISOString()) {
      await updateBotStatus(uidFrom, "expired");
      const pm2Status = await checkPM2Status(uidFrom);
      if (pm2Status.running) {
        const stopSuccess = await stopPM2Process(uidFrom);
        if (!stopSuccess) {
          console.warn(`Không thể dừng bot ${uidFrom} sau khi đặt hết hạn`);
        }
      }
      await sendMessageComplete(
        api,
        message,
        `Bot ${botName} đã được đặt hết hạn vĩnh viễn!\n🆔 Bot ID: ${uidFrom}\n⏰ Trạng thái: Hết hạn\n👤 Thực hiện bởi: ${dName}`,
        true,
        false
      );
      console.log(`Bot ${uidFrom} set to expired immediately by ${dName}`);
    } else {
      await sendMessageComplete(
        api,
        message,
        `Đã rút ngắn thời gian bot thành công!\n🤖 Bot: ${botName}\n🆔 Bot ID: ${uidFrom}\n⏰ Hết hạn mới: ${formatDateTime(new Date(newExpiry))}\n👤 Rút ngắn bởi: ${dName}`,
        true,
        false
      );
      console.log(`Bot ${uidFrom} expiry reduced to ${newExpiry} by ${dName}`);
    }
  } catch (error) {
    await handleError(error, api, threadId, "rút ngắn thời gian bot", type, message);
  }
}

async function removeBotFromList(uidFrom) {
  try {
    if (!(await fs.access(myBotsPath).then(() => true).catch(() => false))) {
      throw new Error("File mybots.json không tồn tại");
    }
    const myBots = JSON.parse(await fs.readFile(myBotsPath, "utf8"));
    if (!myBots[uidFrom]) {
      throw new Error("Bot không tồn tại trong danh sách");
    }
    delete myBots[uidFrom];
    await fs.writeFile(myBotsPath, JSON.stringify(myBots, null, 2));
    console.log(`Đã xóa bot ${uidFrom} khỏi danh sách`);
    return true;
  } catch (error) {
    console.error(`Lỗi xóa bot khỏi danh sách: ${error.message}`);
    return false;
  }
}

async function getBotUidByIndex(index) {
  try {
    if (!(await fs.access(myBotsPath).then(() => true).catch(() => false))) {
      return null;
    }
    const myBots = JSON.parse(await fs.readFile(myBotsPath, "utf8"));
    const botList = Object.keys(myBots);
    if (index < 1 || index > botList.length) {
      return null;
    }
    return botList[index - 1];
  } catch (error) {
    console.error(`Lỗi lấy UID bot theo số thứ tự: ${error.message}`);
    return null;
  }
}

async function handleListBots(api, threadId, type, message) {
  try {
    if (!(await fs.access(myBotsPath).then(() => true).catch(() => false))) {
      return await sendMessageWarning(api, message, "Chưa có bot nào được tạo!", true, false);
    }
    const myBots = JSON.parse(await fs.readFile(myBotsPath, "utf8"));
    const botList = Object.values(myBots);
    if (botList.length === 0) {
      return await sendMessageWarning(api, message, "Danh sách bot trống!", true, false);
    }
    const botData = botList.map((bot, index) => ({
      index: index + 1,
      uid: bot.name,
      displayName: bot.displayName || bot.name || "Không có tên",
      avatar: bot.avatar || null,
      status: bot.status,
      expiryAt: bot.expiryAt,
      rejecter: bot.rejecter || null,
    }));
    let filePath;
    try {
      filePath = await createBotListImage(botData, api);
      await api.sendMessage({ msg: "", quote: message, attachments: [filePath], ttl: 60000 }, threadId, type);
    } catch (error) {
      console.error(`Lỗi tạo danh sách bot: ${error.message}`);
      await sendMessageWarning(api, message, "Lỗi khi tạo danh sách bot. Vui lòng thử lại!", true, false);
    } finally {
      if (filePath) await fs.unlink(filePath).catch(err => console.error(`Lỗi xóa file ảnh: ${err.message}`));
    }
  } catch (error) {
    console.error(`Lỗi lấy danh sách bot: ${error.message}`);
    await sendMessageWarning(api, message, "Không thể lấy danh sách bot. Vui lòng thử lại sau!", true, false);
  }
}

async function handleUpdateName(api, uidFrom, dName, newName, threadId, type, message) {
  try {
    const checkResult = await checkBotExists(uidFrom);
    if (!checkResult.exists) {
      return await sendMessageWarning(api, message, "Bạn chưa có bot nào được tạo!", true, false);
    }
    if (!newName || newName.trim().length === 0) {
      return await sendMessageWarning(api, message, "Tên hiển thị không được để trống!", true, false);
    }
    if (newName.length > 50) {
      return await sendMessageWarning(api, message, "Tên hiển thị không được quá 50 ký tự!", true, false);
    }
    const trimmedName = newName.trim();
    const updated = await updateBotField(uidFrom, "displayName", trimmedName);
    if (updated) {
      await sendMessageComplete(
        api,
        message,
        `Đã cập nhật tên hiển thị thành công!\nTên mới: ${trimmedName}\nCập nhật bởi: ${dName}`,
        true,
        false
      );
      console.log(`Bot ${uidFrom} displayName updated to "${trimmedName}" by ${dName}`);
    } else {
      await sendMessageWarning(api, message, "Không thể cập nhật tên hiển thị. Vui lòng thử lại!", true, false);
    }
  } catch (error) {
    console.error(`Lỗi cập nhật tên bot: ${error.message}`);
    await sendMessageWarning(api, message, "Đã xảy ra lỗi khi cập nhật tên hiển thị!", true, false);
  }
}

async function handleUpdateDescription(api, uidFrom, dName, newDescription, threadId, type, message) {
  try {
    const checkResult = await checkBotExists(uidFrom);
    if (!checkResult.exists) {
      return await sendMessageWarning(api, message, "Bạn chưa có bot nào được tạo!", true, false);
    }
    if (!newDescription || newDescription.trim().length === 0) {
      return await sendMessageWarning(api, message, "Mô tả không được để trống!", true, false);
    }
    if (newDescription.length > 200) {
      return await sendMessageWarning(api, message, "Mô tả không được quá 200 ký tự!", true, false);
    }
    const trimmedDescription = newDescription.trim();
    const updated = await updateBotField(uidFrom, "description", trimmedDescription);
    if (updated) {
      await sendMessageComplete(
        api,
        message,
        `Đã cập nhật mô tả bot thành công!\n\nMô tả mới: ${trimmedDescription}\nCập nhật bởi: ${dName}`,
        true,
        false
      );
      console.log(`Bot ${uidFrom} description updated by ${dName}`);
    } else {
      await sendMessageWarning(api, message, "Không thể cập nhật mô tả. Vui lòng thử lại!", true, false);
    }
  } catch (error) {
    //console.error(`Lỗi cập nhật mô tả bot: ${error.message}`);
    await sendMessageWarning(api, message, "Đã xảy ra lỗi khi cập nhật mô tả!", true, false);
  }
}

async function handleChangeNameServer(api, uidFrom, dName, newNameServer, threadId, type, message) {
  try {
    const checkResult = await checkBotExists(uidFrom);
    if (!checkResult.exists) {
      return await sendMessageWarning(api, message, "Bạn chưa có bot nào được tạo!", true, false);
    }

    if (!newNameServer || newNameServer.trim().length === 0) {
      return await sendMessageWarning(api, message, "Tên server không được để trống!", true, false);
    }

    if (newNameServer.length > 100) {
      return await sendMessageWarning(api, message, "Tên server không được quá 100 ký tự!", true, false);
    }

    const botConfig = createBotConfig(uidFrom, checkResult.botInfo.webPort);
    const databaseFilePath = path.join(projectRoot, botConfig.databaseFile);

    if (!(await fs.access(databaseFilePath).then(() => true).catch(() => false))) {
      return await sendMessageWarning(api, message, "Không tìm thấy file cấu hình cơ sở dữ liệu!", true, false);
    }

    const databaseConfig = JSON.parse(await fs.readFile(databaseFilePath, "utf8"));
    databaseConfig.nameServer = newNameServer.trim();

    await fs.writeFile(databaseFilePath, JSON.stringify(databaseConfig, null, 2));
    
    await sendMessageComplete(
      api,
      message,
      `Đã cập nhật tên server thành công!\nTên server mới: ${newNameServer.trim()}\nCập nhật bởi: ${dName}`,
      true,
      false
    );
    console.log(`Bot ${uidFrom} nameServer updated to "${newNameServer.trim()}" by ${dName}`);
  } catch (error) {
    console.error(`Lỗi cập nhật nameServer bot: ${error.message}`);
    await sendMessageWarning(api, message, "Đã xảy ra lỗi khi cập nhật tên server!", true, false);
  }
}

async function updateBotField(uidFrom, field, value) {
  try {
    if (!(await fs.access(myBotsPath).then(() => true).catch(() => false))) {
      throw new Error("File mybots.json không tồn tại");
    }
    const myBots = JSON.parse(await fs.readFile(myBotsPath, "utf8"));
    if (!myBots[uidFrom]) {
      throw new Error("Bot không tồn tại trong danh sách");
    }
    myBots[uidFrom][field] = value;
    myBots[uidFrom].lastUpdated = new Date().toISOString();
    await fs.writeFile(myBotsPath, JSON.stringify(myBots, null, 2));
    console.log(`Đã cập nhật ${field} cho bot ${uidFrom}`);
    return true;
  } catch (error) {
    console.error(`Lỗi cập nhật ${field}: ${error.message}`);
    return false;
  }
}

function formatDateTime(date) {
  const options = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  };
  return date.toLocaleString("vi-VN", options);
}

async function validateImageFile(filePath) {
  try {
    const stats = await fs.stat(filePath);
    if (stats.size < 100) {
      throw new Error("QR code image is too small or corrupted");
    }
    return true;
  } catch (error) {
    console.error(`Error validating image file ${filePath}: ${error.message}`);
    return false;
  }
}

async function handleError(error, api, threadId, context, type, message) {
  console.error(`Lỗi ${context}: ${error.message}`);
  await sendMessageWarning(api, message, `Đã xảy ra lỗi khi ${context}!\n\nChi tiết: ${error.message}`, true, false);
}