import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";
import * as cv from "../../../utils/canvas/index.js";
import { getUserInfoData } from "../../../service-debug/info-service/user-info.js";
import { loadImageBuffer } from "../../../utils/util.js";

function drawBox(ctx, x, y, w, h, title) {
  const boxGradient = ctx.createLinearGradient(x, y, x, y + h);
  boxGradient.addColorStop(0, "rgba(0, 0, 0, 0.55)");
  boxGradient.addColorStop(1, "rgba(0, 0, 0, 0.35)");
  ctx.fillStyle = boxGradient;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fill();
  ctx.stroke();

  const titleGradient = ctx.createLinearGradient(x, y, x + w, y);
  titleGradient.addColorStop(0, "#4ECB71");
  titleGradient.addColorStop(1, "#1E90FF");
  ctx.fillStyle = titleGradient;
  ctx.font = "bold 36px BeVietnamPro";
  ctx.textAlign = "center";
  ctx.fillText(title, x + w / 2, y + 45);
}

function drawVerticalDivider(ctx, x, y, h) {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + 60);
  ctx.lineTo(x, y + h - 60);
  ctx.stroke();
}

function measureTextWidth(ctx, text, font) {
  ctx.font = font;
  return ctx.measureText(text).width;
}

function drawDefaultThumbnail(ctx, x, y, size) {
  ctx.fillStyle = "#fff3cd";
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#dc3545";
  ctx.lineWidth = 2;
  const padding = size * 0.2;

  ctx.beginPath();
  ctx.moveTo(x + padding, y + padding);
  ctx.lineTo(x + size - padding, y + size - padding);
  ctx.moveTo(x + size - padding, y + padding);
  ctx.lineTo(x + padding, y + size - padding);
  ctx.stroke();
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

export async function createBotDetailImage(botInfo, pm2Status, createdAt, expiryAt, createdBy, api) {
  
  if (!botInfo || !botInfo.name) {
    console.error("Lỗi: botInfo hoặc botInfo.uid không được xác định");
    throw new Error("Thông tin bot không hợp lệ");
  }
  if (!api || typeof api.getUserInfo !== "function") {
    console.error("Lỗi: api không hợp lệ hoặc không có phương thức getUserInfo");
    throw new Error("API không hợp lệ");
  }

  let width = 1400;
  let height = 0;

  const now = new Date();
  let timeRemaining;
  if (botInfo.status === "rejected" && expiryAt && expiryAt < now) {
    timeRemaining = `Vô Hiệu Hóa Bởi ${botInfo.rejecter || "Admin"}`;
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

  const botFields = [
    { label: "👤 ID Owner:", value: botInfo.name || "Unknown" },
    { label: "📱 Tên Bot:", value: botInfo.displayName || botInfo.name || botInfo.uid },
    { label: "🟢 Trạng thái:", value: statusIcons[botInfo.status] || botInfo.status },
    { label: "🌐 Web Port:", value: botInfo.webPort || "Không có" },
    { label: "🗄️ Database:", value: botInfo.database || "Không có" },
    { label: "🔄 Đang chạy:", value: formatTimeDifference(createdAt, now) },
    { label: "⏳ Thời hạn còn:", value: timeRemaining },
  ];

  const registrationFields = [
    { label: "📅 Ngày tạo:", value: createdAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) },
    { label: "👤 Người tạo:", value: createdBy || "Unknown" },
    { label: "👮 Phê duyệt bởi:", value: "Bùi Quang Dũng" },
    { label: "✅ Xem xét gần nhất:", value: createdAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) },
  ];

  const technicalFields = [
    { label: "⚙️ PM2 Status:", value: pm2Status.status || "Unknown" },
    { label: "⚒️ Cập nhật cuối:", value: botInfo.lastUpdated ? new Date(botInfo.lastUpdated).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Chưa cập nhật" },
  ];

  const tempCanvas = createCanvas(1, 1);
  const tempCtx = tempCanvas.getContext("2d");

  let maxLeftWidth = 0;
  [botFields, registrationFields, technicalFields].forEach(fields => {
    fields.forEach(f => {
      const textWidth = measureTextWidth(tempCtx, `${f.label} ${f.value}`, "bold 28px BeVietnamPro");
      maxLeftWidth = Math.max(maxLeftWidth, textWidth);
    });
  });

  const leftColumnWidth = Math.max(650, maxLeftWidth + 120);
  width = leftColumnWidth + 120;

  const headerH = 220;
  const headerY = 30;
  const botBoxHeight = botFields.length * 50 + 100;
  const regBoxHeight = registrationFields.length * 50 + 100;
  const techBoxHeight = technicalFields.length * 50 + 100;

  height = headerY + headerH + 30 + botBoxHeight + regBoxHeight + techBoxHeight + 90;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#0F2027");
  bg.addColorStop(0.5, "#203A43");
  bg.addColorStop(1, "#2C5364");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const metallicGradient = ctx.createLinearGradient(0, 0, width, height);
  metallicGradient.addColorStop(0, "rgba(255,255,255,0.05)");
  metallicGradient.addColorStop(0.5, "rgba(255,255,255,0.1)");
  metallicGradient.addColorStop(1, "rgba(255,255,255,0.05)");
  ctx.fillStyle = metallicGradient;
  ctx.fillRect(0, 0, width, height);

  drawBox(ctx, 60, headerY, width - 120, headerH, "Thông Tin Chi Tiết Bot");

  
  let avatarImage = null;
  try {
    const userInfo = await getUserInfoData(api, botInfo.name);
    if (userInfo && userInfo.avatar) {
      const processedThumbnail = await loadImageBuffer(userInfo.avatar);
      if (processedThumbnail) {
        avatarImage = await loadImage(processedThumbnail);
      }
    }
  } catch (error) {
    console.error(`Lỗi lấy avatar cho bot ${botInfo.name}: ${error.message}`);
  }

  const size = 140;
  const cx = 150;
  const cy = headerY + headerH / 2;
  const grad = ctx.createLinearGradient(cx - size/2, cy - size/2, cx + size/2, cy + size/2);
  grad.addColorStop(0, "#4ECB71");
  grad.addColorStop(1, "#1E90FF");
  ctx.beginPath();
  ctx.arc(cx, cy, size/2 + 8, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size/2, 0, Math.PI * 2, true);
  ctx.clip();
  if (avatarImage) {
    ctx.drawImage(avatarImage, cx - size/2, cy - size/2, size, size);
  } else {
    drawDefaultThumbnail(ctx, cx - size/2, cy - size/2, size);
  }
  ctx.restore();

  
  const isRunning = botInfo.status === "running";
  const isRejected = botInfo.status === "rejected";
  const dotSize = 28;
  const dotX = cx + size/2 - dotSize/2;
  const dotY = cy + size/2 - dotSize/2;
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotSize/2, 0, Math.PI * 2);
  ctx.fillStyle = isRunning ? "#00FF00" : isRejected ? "#FF0000" : "#808080";
  ctx.fill();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = cv.getRandomGradient ? cv.getRandomGradient(ctx, leftColumnWidth) : "#ffffff";
  ctx.font = "bold 36px BeVietnamPro";
  ctx.fillText(botInfo.displayName || botInfo.name || botInfo.name, 250, headerY + 100);
  const leftColumnX = 60;

  
  const botBoxY = headerY + headerH + 30;
  drawBox(ctx, leftColumnX, botBoxY, leftColumnWidth, botBoxHeight, "Thông Tin Bot");
  let yBot = botBoxY + 100;
  const lineHeight = 50;
  botFields.forEach(f => {
    ctx.textAlign = "left";
    ctx.fillStyle = cv.getRandomGradient ? cv.getRandomGradient(ctx, leftColumnWidth) : "#ffffff";
    ctx.font = "bold 28px BeVietnamPro";
    ctx.fillText(f.label, leftColumnX + 40, yBot);
    ctx.textAlign = "right";
    ctx.fillText(f.value, leftColumnX + leftColumnWidth - 40, yBot);
    yBot += lineHeight;
  });

  
  const regBoxY = botBoxY + botBoxHeight + 30;
  drawBox(ctx, leftColumnX, regBoxY, leftColumnWidth, regBoxHeight, "Thông Tin Đăng Ký");
  let yReg = regBoxY + 100;
  registrationFields.forEach(f => {
    ctx.textAlign = "left";
    ctx.fillStyle = cv.getRandomGradient ? cv.getRandomGradient(ctx, leftColumnWidth) : "#ffffff";
    ctx.font = "bold 28px BeVietnamPro";
    ctx.fillText(f.label, leftColumnX + 40, yReg);
    ctx.textAlign = "right";
    ctx.fillText(f.value, leftColumnX + leftColumnWidth - 40, yReg);
    yReg += lineHeight;
  });

  
  const techBoxY = regBoxY + regBoxHeight + 30;
  drawBox(ctx, leftColumnX, techBoxY, leftColumnWidth, techBoxHeight, "Trạng Thái Kỹ Thuật");
  let yTech = techBoxY + 100;
  technicalFields.forEach(f => {
    ctx.textAlign = "left";
    ctx.fillStyle = cv.getRandomGradient ? cv.getRandomGradient(ctx, leftColumnWidth) : "#ffffff";
    ctx.font = "bold 28px BeVietnamPro";
    ctx.fillText(f.label, leftColumnX + 40, yTech);
    ctx.textAlign = "right";
    ctx.fillText(f.value, leftColumnX + leftColumnWidth - 40, yTech);
    yTech += lineHeight;
  });

  const filePath = path.resolve(`./assets/temp/bot_detail_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}