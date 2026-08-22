import os from "os";
import si from "systeminformation";
import disk from "diskusage";
import { readFileSync } from "fs";
import { join } from "path";
import { getBotId } from "../../index.js";
import { getUserInfoData } from "./user-info.js";
import { createBotInfoImage, clearImagePath } from "../../utils/canvas/detailSystem-Config.js";

export async function getBotDetails(api, message, groupSettings = {}) {
  const threadId = message.threadId;
  const uptime = getUptime();
  const memoryUsage = getMemoryUsage();
  const { onConfigs, offConfigs } = getConfigStatus(threadId, groupSettings);
  const botVersion = getBotVersion();
  const botId = getBotId();

  const botInfo = await getUserInfoData(api, botId);

  const path = os.platform() === 'win32' ? 'C:' : '/';
  const [cpuData, diskData] = await Promise.all([
    si.currentLoad(),
    disk.check(path)
  ]);

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedRam = ((totalMem - freeMem) / 1024 / 1024 / 1024).toFixed(1);
  const totalRam = (totalMem / 1024 / 1024 / 1024).toFixed(1);
  const freeRam = (freeMem / 1024 / 1024 / 1024).toFixed(1);

  const diskUsage = diskData ? `${((diskData.total - diskData.available) / 1024 / 1024 / 1024).toFixed(1)}GB `
    + `/`
    + ` ${(diskData.total / 1024 / 1024 / 1024).toFixed(1)}GB`
    + ` (Free ${(diskData.available / 1024 / 1024 / 1024).toFixed(1)}GB)` : "N/A";

  const botStats = {
    version: botVersion,
    os: getOsInfo(),
    memoryUsage,
    cpu: `${os.cpus().length} Cores - Utilization ${cpuData.currentLoad.toFixed(1)}% `,
    ram: `${usedRam} GB / ${totalRam} GB (Free ${freeRam} GB)`,
    cpuModel: os.cpus()[0].model,
    disk: diskUsage,
    Name: "HÀ HUY HOÀNG"
  };

  let imagePath = null;
  try {
    imagePath = await createBotInfoImage(botInfo, uptime, botStats, onConfigs, offConfigs);
    // Send message and get message ID
    const sentMessage = await api.sendMessage({ msg: "", attachments: [imagePath], ttl: 600000, }, threadId, message.type);
    
    // Set timeout to delete the message after 30 seconds (adjustable)
    setTimeout(async () => {
      try {
        await api.deleteMessage(threadId, sentMessage.messageId); // Assumes api.deleteMessage exists
      } catch (error) {
        console.error("Lỗi khi xoá tin nhắn:", error);
      }
    }, 3000000); // 30 seconds
  } catch (error) {
    console.error("Lỗi khi tạo hình ảnh thông tin bot:", error);
  } finally {
    if (imagePath) await clearImagePath(imagePath);
  }
}

function getOsInfo() {
  let typeOs = "Unknown";
  switch (os.type()) {
    case "Linux":
      typeOs = "Linux";
      break;
    case "Darwin":
      typeOs = "macOS";
      break;
    case "Windows_NT":
      typeOs = "Windows";
      break;
  }
  return `${typeOs} ${os.release()}`;
}

function getUptime() {
  const uptimeInSeconds = process.uptime();
  const days = Math.floor(uptimeInSeconds / 86400);
  const hours = Math.floor((uptimeInSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeInSeconds % 60);

  return `${days} ngày, ${hours} giờ, ${minutes} phút, ${seconds} giây`;
}

function getMemoryUsage() {
  const usedMem = process.memoryUsage().heapUsed;
  return `${Math.round((usedMem / 1024 / 1024) * 100) / 100} MB`;
}

function getConfigStatus(threadId, groupSettings) {
  const settings = groupSettings[threadId] || {};
  const onConfigs = [];
  const offConfigs = [];

  Object.entries(settings)
    .filter(([key, value]) => typeof value === "boolean")
    .forEach(([key, value]) => {
      const status = value ? "✅" : "❌";
      const configLine = `${getSettingEmoji(key)} ${getSettingName(key)}: ${status}`;
      if (value) {
        onConfigs.push(configLine);
      } else {
        offConfigs.push(configLine);
      }
    });

  return { onConfigs, offConfigs };
}

function getBotVersion() {
  try {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    return packageJson.version || "Không xác định";
  } catch (error) {
    console.error("Lỗi khi đọc phiên bản bot:", error);
    return "Không xác định";
  }
}

function getSettingEmoji(settingKey) {
  const emojiMap = {
  antiSpam: "🛑",         
  removeLinks: "🔗",    
  autoJoin: "🤝",          
  filterBadWords: "🚫",    
  welcomeGroup: "👋",     
  byeGroup: "👋🏻",          
  learnEnabled: "📚",    
  replyEnabled: "💬",     
  activeBot: "🤖",          
  activeGame: "🎮",         
  memberApprove: "✅",     
  removeTags: "🏷️",       
  enableSetup: "⚙️",        
  antiNude: "🙅‍♀️",       
  allowSticker: "🎟️",       
  allowStickerlag: "🐢",    
  antiUndo: "⏪",          
  antiMention: "🔕",        
  sendTask: "📢",         
  sendstk: "🎭",            
  sendtext: "📝",           
  enableDownload: "📥",   
  enableAntiBot: "🛡️",     
  autoReplyCommand: "🤖",   
  antiFile: "📂",           
  antiPhotoVideo: "🖼️",    
  antiVoice: "🎙️",          
  antiText: "🔤",           
  antiJoinLeave: "🚷",     
  updateGroup: "🔔",        
  antiKickBlock: "🛡️",      
  blockForward: "📵",       
  antiPhoneNumber: "📞", 
  };
  return emojiMap[settingKey] || "⚙️";
}

export function getSettingName(settingKey) {
const nameMap = {
  activeBot: "Tương tác với thành viên",
  activeGame: "Xử lý trò chơi",
  antiSpam: "Chống spam",
  removeTags: "Chặn tag thành viên",
  enableSetup: "Cấu hình hệ thống",
  antiMention: "Chống spam mention",
  removeLinks: "Chặn liên kết",
  filterBadWords: "Xóa từ ngữ thô tục",
  welcomeGroup: "Chào mừng thành viên mới",
  byeGroup: "Thông báo thành viên rời nhóm",
  learnEnabled: "Học hỏi (AI)",
  replyEnabled: "Trả lời tin nhắn nhóm",
  onlyText: "Chỉ cho phép văn bản",
  memberApprove: "Phê duyệt thành viên mới",
  antiNude: "Chống ảnh nhạy cảm",
  antiUndo: "Chặn thu hồi tin nhắn",
  sendTask: "Gửi nội dung định kỳ",
  sendstk: "Tự động gửi sticker",
  sendtext: "Tự động gửi tin nhắn",
  enableDownload: "Tự động tải xuống",
  allowStickerlag: "Chặn sticker gây lag",
  allowSticker: "Chặn sticker",
  enableAntiBot: "Chặn bot người dùng",
  autoReplyCommand: "Auto reply (AI)",
  antiFile: "Chặn gửi file",
  antiPhotoVideo: "Chặn ảnh & video",
  antiVoice: "Chặn voice",
  antiText: "Chặn văn bản",
  antiJoinLeave: "Chặn spam vào/ra nhóm",
  updateGroup: "Thông báo sự kiện nhóm",
  antiKickBlock: "Chống kick/block",
  blockForward: "Chặn chuyển tiếp tin nhắn",
  autoJoin: "Tự động tham gia nhóm",
  antiPhoneNumber: "Chặn số điện thoại"
};

  return nameMap[settingKey] || settingKey;
}
