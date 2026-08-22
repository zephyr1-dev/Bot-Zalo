import fs from "fs";
import path from "path";
import { getGlobalPrefix } from "../../../service-debug/service.js";
import { checkBotExists, stopPM2Process, startBotWithLauncher, checkPM2Status, 
  waitForPM2Process, restartPM2Process, updateBotStatus, deletePM2Process, checkExistingBot, createBotConfig,
  validateCredentials, getAvailablePort, createAllRequiredFiles, saveBotToMyBots, ensureDirectoriesExist } from "../System/pm2-manager.js";
import { sendMessageComplete, sendMessageWarning } from "../../../service-debug/chat-zalo/chat-style/chat-style.js";
import { initSession, verifyClient, generateQRCode, waitingScan, waitingConfirm, getUserInfo } from "../Credentials/qr-login.js";
const projectRoot = path.resolve(process.cwd());
const myBotDir = path.join(projectRoot, "mybot");
const myBotsPath = path.join(myBotDir, "mybots.json");
const configsDir = path.join(myBotDir, "configs");
const defaultCommand = path.join(myBotDir, "defaultCommand.json");
const botsDir = path.join(myBotDir, "bots");
const adminListPath = path.join("assets", "json-data", "list_admin.json");
const launcherPath = path.join(projectRoot, "index.js");
async function sendMessage(api, msg, threadId, type, message) {
  try {
    await api.sendMessage({ msg: msg, quote: message, ttl: 120000 }, threadId, type);
  } catch (err) {
    console.error(`Lỗi khi gửi tin nhắn: ${err.message}`);
  }
}

async function validateImageFile(filePath) {
  try {
    const stats = await fs.promises.stat(filePath);
    if (stats.size < 100) {
      throw new Error("QR code image is too small or corrupted");
    }
    return true;
  } catch (error) {
    console.error(`Error validating image file ${filePath}: ${error.message}`);
    return false;
  }
}

export async function handleQrLogin(api, message, threadId, type) {
   const { data: { dName, uidFrom } } = message;
   const qrPath = path.join(process.cwd(), ".cache", "qr_code.png");
 
   try {
     console.log(`[DEBUG] Starting handleQrLogin for uidFrom=${uidFrom}, threadId=${threadId}, type=${type}`);
 
     const checkResult = await checkExistingBot(uidFrom);
     if (checkResult.exists) {
       return await sendMessageComplete(
         api,
         message,
         checkResult.message || "Bạn đã tạo BOT từ trước",
         true,false
       );
     }
 
    //  await sendMessage(
    //    api,
    //    `${dName}, đang tạo mã QR để đăng nhập Zalo...`,
    //    threadId,
    //    type,
    //    message
    //  );
 
     let session = await initSession();
     if (!session) {
       console.error("[ERROR] Failed to initialize session");
       await sendMessageWarning(
         api, message,
         `Không thể khởi tạo phiên đăng nhập! Vui lòng thử lại sau.`,
         true, false
       );
       return;
     }
 
     session = await verifyClient(session);
     if (!session) {
       console.error("[ERROR] Failed to verify client");
       await sendMessageWarning(
         api, message,
         `Không thể xác minh phiên đăng nhập! Vui lòng thử lại sau.`,
         true, false
       );
       return;
     }
 
     const [code, updatedSession] = await generateQRCode(session);
     session = updatedSession;
     if (!code) {
       console.error("[ERROR] Failed to generate QR code");
       await sendMessageWarning(
        api, message,
        `Đã xảy ra lỗi khi tạo QR`,
        true, false
      );
       return;
     }
     if (!(await validateImageFile(qrPath))) {
       console.error(`[ERROR] QR code image at ${qrPath} is invalid or missing`);
       await sendMessageWarning(
        api, message,
        `Đã xảy ra lỗi khi tạo QR`,
        true, false
      );
       return;
     }
 
     try {
       await api.sendMessage(
         {
           msg: `${dName}, mở app Zalo và quét mã QR này để đăng nhập!`,
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
       await sendMessageWarning(
        api, message,
        `Đã xảy ra lỗi khi gửi QR`,
        true, false
      );
       return;
     }
 
    //  await sendMessage(
    //    api,
    //    `${dName}, vui lòng quét mã QR trong vòng 5 phút để tiếp tục.`,
    //    threadId,
    //    type,
    //    message
    //  );
 
     const scanResult = await waitingScan(code, session);
     if (!scanResult) {
       console.error("[ERROR] QR code scan not completed");
       await sendMessageWarning(
        api, message,
        `Đăng nhập không thành công`,
        true, false
      );
       return;
     }
     if (scanResult) {
      await sendMessageComplete(
        api, message,
        `đã quét QR Login, vui lòng xác nhận đăng nhập trên thiết bị của bạn.`,
        true, false
      );
     }
 
     const [resultData, rawCookies] = await waitingConfirm(code, session);
     if (!resultData || !rawCookies) {
       console.error("[ERROR] QR code confirmation not completed");
       await sendMessageWarning(
        api, message,
        `Đăng nhập không thành công, do người dùng từ chối xác nhận`,
        true, false
      );
       return;
     }
 
     console.log("[DEBUG] Login confirmation successful");
 
     const userInfo = await getUserInfo(session);
     if (!userInfo) {
       console.error("[ERROR] Failed to get user info");
       await sendMessageWarning(
         api, message,
         `Đăng nhập thành công nhưng không thể lấy thông tin người dùng!`,
         true, false
       );
       return;
     }
 
    //  await sendMessageComplete(
    //    api,
    //    `${dName}, đăng nhập thành công!\nTên: ${userInfo.data.info.name}\nĐang tạo bot...`,
    //    threadId,
    //    type,
    //    message
    //  );
 
     try {
       if (!fs.existsSync(launcherPath)) {
         return await sendMessageWarning(api, message, "Đã xảy ra lỗi gì đó trong dự án", true, false);
       }
 
       await ensureDirectoriesExist();
       const webPort = getAvailablePort();
       const botConfig = createBotConfig(uidFrom, webPort);
 
       const credentialsData = {
         cookie: {
           url: "https://chat.zalo.me",
           cookies: rawCookies.cookies
         },
         imei: resultData.imei,
         userAgent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36"
       };
       await createAllRequiredFilesWithCredentials(uidFrom, credentialsData, botConfig);
       const success = await startBotWithLauncher(uidFrom);
       if (success) {
         const now = new Date();
         const expiryTime = new Date(now.getTime() + 60 * 60 * 1000);
         await saveBotToMyBots(uidFrom, dName, webPort, expiryTime);
         await sendMessageComplete(
           api,
           message,
           `Bot của ${dName} đã được khởi tạo thành công!\n\nNgười tạo: ${dName}\nTên BOT: ${userInfo.data.info.name}\nTrạng thái: Hoạt động\nThời gian dùng thử: 1 giờ`,
           true,
           false
         );
 
         console.log(`Bot con "${uidFrom}" đã được khởi tạo thành công bởi ${dName} trên port ${webPort} qua QR login`);
       } else {
         return sendMessageWarning(api, message, "Đã xảy ra lỗi gì đó trong quá trình tạo bot!", true, false);
       }
 
     } catch (botCreateError) {
       console.error(`[ERROR] Failed to create bot: ${botCreateError.message}`);
       await sendMessageWarning(
        api, message,
        `Đăng nhập thành công nhưng không thể tạo BOT!`,
        true, false
      );
       return;
     }
 
   } catch (error) {
     console.error(`[ERROR] Unexpected error in handleQrLogin: ${error.message}`);
     await sendMessage(
       api,
       `${dName}, đã xảy ra lỗi khi xử lý lệnh qrlogin: ${error.message}`,
       threadId,
       type,
       message
     );
   }
 }
 
 async function createAllRequiredFilesWithCredentials(uidFrom, credentialsData, botConfig) {
   const requiredDirs = [
     path.join(myBotDir, "credentials"),
     path.join(myBotDir, "configs"),
     path.join(myBotDir, "settings"),
     path.join(myBotDir, "json-data"),
     path.join(projectRoot, "logs", uidFrom),
     path.join(projectRoot, "assets", "resources", uidFrom),
     path.join(projectRoot, "assets", "temp", uidFrom),
     path.join(projectRoot, "assets", "resources", "gif", uidFrom)
   ];
 
   requiredDirs.forEach(dir => {
     if (!fs.existsSync(dir)) {
       fs.mkdirSync(dir, { recursive: true });
     }
   });
 
   const fileMap = {
     [path.join(projectRoot, botConfig.configFilePath)]: credentialsData,
     [path.join(projectRoot, botConfig.groupSettingsPath)]: {},
     [path.join(projectRoot, botConfig.adminFilePath)]: [],
     [path.join(projectRoot, botConfig.MANAGER_FILE_PATH)]: {
       "groupRequiredReset": "-1",
       "onGamePrivate": false,
       "onBotPrivate": false
     },
     [path.join(projectRoot, botConfig.DATA_GAME_FILE_PATH)]: {},
     [path.join(projectRoot, botConfig.PROPHYLACTIC_CONFIG_PATH)]: {
       "prophylacticUploadAttachment": {
         "enable": false,
         "lastBlocked": Date.now(),
         "numRequestZalo": 1,
         "lastRequestTime": Date.now()
       }
     },
     [path.join(projectRoot, botConfig.WEB_CONFIG_PATH)]: {},
     [path.join(projectRoot, botConfig.databaseFile)]: {
       "nameServer": "Bùi Quang Dũng",
       "host": "localhost",
       "user": "root",
       "password": "",
       "database": `${uidFrom}`,
       "port": 3306,
       "tablePlayerZalo": "players_zalo",
       "tableAccount": "account",
       "dailyReward": 100000000000
     },
     [path.join(projectRoot, botConfig.dataTrainingPath)]: {},
     [path.join(projectRoot, botConfig.rankInfoPath)]: {}
   };
 
   for (const [filePath, data] of Object.entries(fileMap)) {
     try {
       fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
     } catch (error) {
       throw new Error(`Không thể tạo file ${filePath}: ${error.message}`);
     }
   }
 
   if (fs.existsSync(defaultCommand)) {
     try {
       await fs.promises.copyFile(defaultCommand, path.join(projectRoot, botConfig.commandFilePath));
     } catch (error) {
       throw new Error(`Không thể copy file defaultCommand.json: ${error.message}`);
     }
   } else {
     fs.writeFileSync(path.join(projectRoot, botConfig.commandFilePath), JSON.stringify({}, null, 2));
   }
 
   const botConfigPath = path.join(botsDir, `${uidFrom}.json`);
   try {
     fs.writeFileSync(botConfigPath, JSON.stringify(botConfig, null, 4));
   } catch (error) {
     throw new Error(`Không thể tạo file config bot: ${error.message}`);
   }
 }