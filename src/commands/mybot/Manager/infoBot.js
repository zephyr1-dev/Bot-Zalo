import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { checkBotExists, stopPM2Process, startBotWithLauncher, checkPM2Status, 
waitForPM2Process, restartPM2Process, updateBotStatus, deletePM2Process } from "../System/pm2-manager.js";
import { createBotDetailImage } from "./detail-canvas.js";
import { clearImagePath } from "../../../utils/canvas/index.js"; 

const projectRoot = path.resolve(process.cwd());
const myBotDir = path.join(projectRoot, "mybot");
const myBotsPath = path.join(myBotDir, "mybots.json");
const adminListPath = path.join("assets", "json-data", "list_admin.json");
const isWindows = process.platform === "win32";

export async function detailBot(api, message, groupAdmins) {
  const { threadId, data: { uidFrom, dName, index }, type } = message;
  try {
    let isMotherBotAdmin = await checkMotherBotAdmin(uidFrom);
    let targetUid = uidFrom;

    if (index !== undefined && isMotherBotAdmin) {
      const botUid = await getBotUidByIndex(index);
      if (botUid) {
        targetUid = botUid;
      } else {
        return await sendMessage(api, `Không tìm thấy bot với index ${index}!`, threadId, type);
      }
    } else if (index !== undefined && !isMotherBotAdmin) {
      await sendMessage(api, `⚠️ Bạn không có quyền xem chi tiết bot khác! Hiển thị thông tin bot hiện tại của bạn.`, threadId, type);
    }

    const checkResult = await checkBotExists(targetUid);
    if (!checkResult.exists) {
      return await sendMessage(api, `Bot ${targetUid} không tồn tại trong hệ thống!`, threadId, type);
    }

    const botInfo = checkResult.botInfo;
    const pm2Status = await checkPM2Status(targetUid);
    let realStatus = "stopped";
    if (pm2Status.running && pm2Status.status === "online") {
      realStatus = "running";
    } else if (["trialExpired", "expired", "stopping", "rejected"].includes(botInfo.status)) {
      realStatus = botInfo.status;
    }
    let statusUpdated = false;
    if (botInfo.status !== realStatus && !["trialExpired", "expired", "stopping", "rejected"].includes(botInfo.status)) {
      console.log(`Updating bot ${targetUid} status from ${botInfo.status} to ${realStatus}`);
      await updateBotStatus(targetUid, realStatus);
      statusUpdated = true;
    }

    const createdAt = new Date(botInfo.createdAt);
    const expiryAt = botInfo.expiryAt === "-1" ? null : new Date(botInfo.expiryAt);
    const createdBy = botInfo.createdBy || dName;

    let imagePath = null;
    try {
      
      imagePath = await createBotDetailImage(botInfo, pm2Status, createdAt, expiryAt, createdBy, api);
      
      await api.sendMessage({ msg: "", attachments: [imagePath], ttl: 600000 }, threadId, type);
      console.log(`Bot detail image sent for ${targetUid} by ${dName}`);
    } catch (error) {
      console.error(`Lỗi khi tạo hoặc gửi hình ảnh thông tin bot: ${error.message}`);
      
      const now = new Date();
      let timeRemaining;
      if (realStatus === "rejected" && expiryAt && expiryAt < now) {
        timeRemaining = "Vô Hiệu Hóa Vĩnh Viễn";
      } else if (botInfo.expiryAt === "-1") {
        timeRemaining = "Vĩnh viễn";
      } else if (expiryAt > now) {
        timeRemaining = formatTimeDifference(now, expiryAt);
      } else {
        timeRemaining = "Đã hết hạn";
      }
      const statusIcons = {
        "running": "Đang hoạt động",
        "stopped": "Đã dừng",
        "trialExpired": "Hết thời gian dùng thử",
        "expired": "Đã hết hạn",
        "stopping": "Đang bảo trì",
        "rejected": "Vô Hiệu Hóa"
      };
      const botName = botInfo.displayName || botInfo.name || targetUid;
      const rejecterInfo = botInfo.rejecter ? `\n👤 Vô Hiệu Hóa Bởi: ${botInfo.rejecter}` : "";
      const infoMessage = `📌 THÔNG TIN CHI TIẾT BOT 📌\n\n` +
                         `👤 ID Owner: ${targetUid}\n` +
                         `📱 Tên Bot: ${botName}\n` +
                         `🟢 Trạng thái: ${statusIcons[realStatus] || realStatus}${rejecterInfo}\n` +
                         `🌐 Web Port: ${botInfo.webPort || "Không có"}\n` +
                         `🗄️ Database: ${botInfo.database || "Không có"}\n` +
                         `🔄 Đang chạy: ${formatTimeDifference(createdAt, now)}\n` +
                         `⏳ Thời hạn còn: ${timeRemaining}\n\n` +
                         `📊 THÔNG TIN ĐĂNG KÝ\n` +
                         `📅 Ngày tạo: ${formatDateTime(createdAt)}\n` +
                         `👤 Người tạo: ${createdBy}\n` +
                         `👮 Được phê duyệt bởi: Bùi Quang Dũng\n` +
                         `✅ Thời gian xem xét gần nhất: ${formatDateTime(createdAt)}\n\n` +
                         `🔧 TRẠNG THÁI KỸ THUẬT:\n` +
                         `⚙️ PM2 Status: ${pm2Status.status}\n` +
                         `⚒️ Cập nhật cuối: ${botInfo.lastUpdated ? formatDateTime(new Date(botInfo.lastUpdated)) : "Chưa cập nhật"}`;
      await sendMessage(api, infoMessage, threadId, type);
    } finally {
      if (imagePath) {
        await clearImagePath(imagePath); 
      }
    }
  } catch (error) {
    await handleError(error, api, threadId, "lấy thông tin chi tiết bot", type);
  }
}

async function checkMotherBotAdmin(uidFrom) {
  try {
    if (!fs.existsSync(adminListPath)) {
      console.warn(`File list_admin.json không tồn tại tại ${adminListPath}`);
      return false;
    }
    const adminList = JSON.parse(fs.readFileSync(adminListPath, "utf8"));
    return Array.isArray(adminList) && adminList.includes(uidFrom.toString());
  } catch (error) {
    console.error(`Lỗi kiểm tra admin bot mẹ: ${error.message}`);
    return false;
  }
}

async function getBotUidByIndex(index) {
  try {
    if (!fs.existsSync(myBotsPath)) {
      console.warn(`File mybots.json không tồn tại tại ${myBotsPath}`);
      return null;
    }
    const myBots = JSON.parse(fs.readFileSync(myBotsPath, "utf8"));
    const botUids = Object.keys(myBots);
    const idx = parseInt(index) - 1;
    if (idx >= 0 && idx < botUids.length) {
      return botUids[idx];
    }
    return null;
  } catch (error) {
    console.error(`Lỗi lấy bot UID theo index ${index}: ${error.message}`);
    return null;
  }
}

function formatDateTime(date) {
  const options = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh"
  };
  return date.toLocaleString("vi-VN", options);
}

function formatTimeDifference(startDate, endDate) {
  const diffMs = Math.abs(endDate - startDate);
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) {
    const remainingHours = diffHours % 24;
    return `${diffDays} ngày ${remainingHours} giờ`;
  } else if (diffHours > 0) {
    const remainingMinutes = diffMinutes % 60;
    return `${diffHours} giờ ${remainingMinutes} phút`;
  } else if (diffMinutes > 0) {
    const remainingSeconds = diffSeconds % 60;
    return `${diffMinutes} phút ${remainingSeconds} giây`;
  } else {
    return `${diffSeconds} giây`;
  }
}

async function sendMessage(api, msg, threadId, type) {
  const maxRetries = 3;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      await api.sendMessage({ msg: msg, ttl: 120000 }, threadId, type);
      return;
    } catch (err) {
      attempt++;
      console.error(`Lỗi khi gửi tin nhắn (thử ${attempt}/${maxRetries}): ${err.message}`);
      if (err.code === 'ETIMEDOUT') {
        if (attempt === maxRetries) {
          console.error(`Hết số lần thử gửi tin nhắn đến ${threadId}`);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      } else {
        throw err;
      }
    }
  }
}

async function handleError(error, api, threadId, context, type) {
  console.error(`Lỗi ${context}: ${error.message}`);
  console.error(`Stack trace: ${error.stack}`);
  let errorDetails = error.message;
  if (error.code) errorDetails += ` (Code: ${error.code})`;
  if (error.path) errorDetails += ` (Path: ${error.path})`;
  let errorMessage = `Đã xảy ra lỗi khi ${context}!\n\n🔍 Chi tiết: ${errorDetails}\n\n💡 Vui lòng thử lại sau hoặc liên hệ admin.`;
  if (error.code === 'ETIMEDOUT') {
    errorMessage = `Không thể kết nối đến máy chủ! Vui lòng kiểm tra mạng và thử lại.\n\n🔍 Chi tiết: ${errorDetails}`;
  }
  await sendMessage(api, errorMessage, threadId, type);
}