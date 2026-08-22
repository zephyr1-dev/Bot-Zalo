import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { checkBotExists, stopPM2Process, startBotWithLauncher, checkPM2Status, 
waitForPM2Process, restartPM2Process, updateBotStatus, deletePM2Process, checkExistingBot, createBotConfig,
validateCredentials, getAvailablePort, createAllRequiredFiles, saveBotToMyBots, ensureDirectoriesExist } from "../System/pm2-manager.js";
import { getGlobalPrefix } from "../../../service-debug/service.js";
import { sendMessageComplete, sendMessageWarning } from "../../../service-debug/chat-zalo/chat-style/chat-style.js";

const projectRoot = path.resolve(process.cwd());
const myBotDir = path.join(projectRoot, "mybot");
const botsDir = path.join(myBotDir, "bots");
const myBotsPath = path.join(myBotDir, "mybots.json");
const defaultCommand = path.join(myBotDir, "defaultCommand.json");
const launcherPath = path.join(projectRoot, "index.js");
const isWindows = process.platform === "win32";

export async function createBot(api, message, groupAdmins, arg, aliasCommand) {
  const { threadId, data: { uidFrom, dName, content }, type } = message;
  const prefix = getGlobalPrefix();
  let args = content.split(/\s+/);
  if (arg) args = arg;
  if (type === 1) return sendMessageWarning(api, message, "Vui lòng khởi tạo bot ở chat cá nhân, vì thông tin tạo bot là bảo mật an toàn", true, false);
  if (args.length < 3) return sendMessageComplete(api, message, `Cách sử dụng hệ thống tạo bot:\nSử dụng lệnh ${prefix}${aliasCommand} login/create [ImeiUUID] [SessionCookies] Để tạo bot`, true, false)
  const validationResult = validateCredentials(args, prefix, aliasCommand);
  if (!validationResult.valid) {
    return await sendMessageWarning(api, message, validationResult.message, true, false);
  }
  try {
    const checkResult = await checkExistingBot(uidFrom);
    if (checkResult.exists) {
      return await sendMessageWarning(api, message, checkResult.message);
    }
    if (!fs.existsSync(launcherPath)) {
      return await sendMessageWarning(api, message, "Đã xảy ra lỗi gì đó trong dự án");
    }
    await ensureDirectoriesExist();
    const webPort = getAvailablePort();
    const botConfig = createBotConfig(uidFrom, webPort);
    await createAllRequiredFiles(uidFrom, args, botConfig);
    const success = await startBotWithLauncher(uidFrom);
    if (success) {
      const now = new Date();
      const expiryTime = new Date(now.getTime() + 60 * 60 * 1000);
      await saveBotToMyBots(uidFrom, dName, webPort, expiryTime);
      await sendMessageComplete(api, message, `Bot của ${dName} đã được khởi tạo thành công!\n📋 Thông tin bot:\nBot ID: ${uidFrom}\nNgười tạo: ${dName}\nTrạng thái: ✅ Hoạt động`, true, false);
      console.log(`Bot con "${uidFrom}" đã được khởi tạo thành công bởi ${dName} trên port ${webPort}`);
    } else {
      return sendMessageWarning(api, message, "Đã xảy ra lỗi gì đó trong quá trình tạo bot!");
    }
  } catch (error) {
    await handleError(error, api, threadId, "tạo bot", type, message);
  }
}

async function handleError(error, api, threadId, context, type, message) {
  console.error(`Lỗi ${context}: ${error.message}`);
  console.error(`Stack trace: ${error.stack}`);
  let errorDetails = error.message;
  if (error.code) errorDetails += ` (Code: ${error.code})`;
  if (error.path) errorDetails += ` (Path: ${error.path})`;
  await sendMessage(api, `Đã xảy ra lỗi khi ${context}!\n\n🔍 Chi tiết: ${errorDetails}\n\n💡 Vui lòng kiểm tra logs và thử lại sau.`, threadId, type, message);
}