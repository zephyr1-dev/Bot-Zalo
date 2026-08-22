import { createCanvas, loadImage } from "canvas";
import fs from "fs/promises";
import path from "path";
import { loadImageBuffer } from "../../utils/util.js";
import { getUserInfoData } from "../../service-debug/info-service/user-info.js";

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

function formatTimeRemaining(expiryDate, now, isRejected, rejecter, isPermanent) {
  if (isRejected) {
    return `Vô Hiệu Hóa Bởi ${rejecter || "Admin"}`;
  }
  if (isPermanent) {
    return "Vĩnh Viễn";
  }
  const diffMs = expiryDate - now;
  if (diffMs <= 0) return "Hết Hạn";
  
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffMonths / 12);

  if (diffYears >= 1) {
    const remainingMonths = diffMonths % 12;
    return remainingMonths > 0 ? `${diffYears} năm ${remainingMonths} tháng` : `${diffYears} năm`;
  } else if (diffMonths >= 1) {
    const remainingDays = diffDays % 30;
    return remainingDays > 0 ? `${diffMonths} tháng ${remainingDays} ngày` : `${diffMonths} tháng`;
  } else if (diffDays >= 1) {
    const remainingHours = diffHours % 24;
    return remainingHours > 0 ? `${diffDays} ngày ${remainingHours} giờ` : `${diffDays} ngày`;
  } else if (diffHours >= 1) {
    const remainingMinutes = diffMinutes % 60;
    return remainingMinutes > 0 ? `${diffHours} giờ ${remainingMinutes} phút` : `${diffHours} giờ`;
  } else if (diffMinutes >= 1) {
    const remainingSeconds = diffSeconds % 60;
    return remainingSeconds > 0 ? `${diffMinutes} phút ${remainingSeconds} giây` : `${diffMinutes} phút`;
  } else {
    return `${diffSeconds} giây`;
  }
}

export async function createBotListImage(bots, api) {
  const tempCanvas = createCanvas(1, 1);
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.font = "bold 18px BeVietnamPro";

  const maxNameWidth = bots.reduce((maxWidth, bot) => {
    const name = bot.displayName.length > 36 ? bot.displayName.slice(0, 36) + "..." : bot.displayName;
    const nameWidth = tempCtx.measureText(name).width;
    return nameWidth > maxWidth ? nameWidth : maxWidth;
  }, 0);

  const maxTimeWidth = bots.reduce((maxWidth, bot) => {
    const timeText = formatTimeRemaining(new Date(bot.expiryAt), new Date(), bot.status === "rejected", bot.rejecter, bot.expiryAt === "-1");
    const timeWidth = tempCtx.measureText(timeText).width;
    return timeWidth > maxWidth ? timeWidth : maxWidth;
  }, 0);

  const thumbnailSize = 60;
  const padding = 12;
  const numberWidth = 35;
  const separatorWidth = 10;
  const extraPadding = padding * 4;
  const width = thumbnailSize + separatorWidth + maxNameWidth + maxTimeWidth + numberWidth + extraPadding;
  const finalWidth = Math.max(500, Math.min(width, 1000));
  const headerHeight = 60;
  const cardHeight = 75;
  const height = bots.length * cardHeight + 20 + headerHeight;

  const canvas = createCanvas(finalWidth, height);
  const ctx = canvas.getContext("2d");

  try {
    const thumbnailPromises = bots.map(async (bot) => {
      try {
        const userInfo = await getUserInfoData(api, bot.uid);
        if (userInfo && userInfo.avatar) {
          const processedThumbnail = await loadImageBuffer(userInfo.avatar);
          if (processedThumbnail) {
            return await loadImage(processedThumbnail);
          }
        }
        return null;
      } catch (error) {
        console.error(`Lỗi lấy avatar cho bot ${bot.uid}: ${error.message}`);
        return null;
      }
    });

    const thumbnails = await Promise.all(thumbnailPromises);

        // Set solid black background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, finalWidth, height);

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.8)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.9)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, finalWidth, height);

    let yPos = padding;

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px BeVietnamPro";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("DANH SÁCH BOT", finalWidth / 2, yPos + 20);
    yPos += headerHeight;

    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];

      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      ctx.roundRect(padding, yPos, finalWidth - padding * 2 - numberWidth - separatorWidth, cardHeight - 8, 6);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      const thumbX = padding * 2;
      const thumbY = yPos + (cardHeight - thumbnailSize) / 2 - 3;
      const radius = thumbnailSize / 2;
      ctx.arc(thumbX + radius, thumbY + radius, radius + 1, 0, Math.PI * 2);
      const gradient = ctx.createLinearGradient(thumbX, thumbY, thumbX + thumbnailSize, thumbY + thumbnailSize);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.5)");
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.2)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0.5)");
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(thumbX + radius, thumbY + radius, radius - 1, 0, Math.PI * 2);
      ctx.clip();

      if (thumbnails[i]) {
        ctx.drawImage(thumbnails[i], thumbX, thumbY, thumbnailSize, thumbnailSize);
      } else {
        drawDefaultThumbnail(ctx, thumbX, thumbY, thumbnailSize);
      }
      ctx.restore();

      const isRunning = bot.status === "running";
      const isRejected = bot.status === "rejected";
      const dotSize = 16;
      const dotX = thumbX + thumbnailSize - dotSize / 2;
      const dotY = thumbY + thumbnailSize - dotSize / 2;
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = isRunning ? "#00FF00" : isRejected ? "#FF0000" : "#808080";
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.fillRect(thumbX + thumbnailSize + padding, yPos + 10, 2, cardHeight - 20);
      ctx.restore();

      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const textX = thumbX + thumbnailSize + padding * 2;

      ctx.font = "bold 18px BeVietnamPro";
      ctx.fillStyle = "#ffffff";
      const maxNameWidth = finalWidth - textX - padding * 3 - maxTimeWidth - numberWidth - separatorWidth;
      let name = bot.displayName;
      if (ctx.measureText(name).width > maxNameWidth) {
        while (ctx.measureText(name + "...").width > maxNameWidth && name.length > 0) {
          name = name.slice(0, -1);
        }
        name += "...";
      }
      ctx.fillText(name, textX, yPos + 10);

      ctx.font = "bold 16px BeVietnamPro";
      ctx.fillStyle = "#cccccc";
      const timeText = formatTimeRemaining(new Date(bot.expiryAt), new Date(), isRejected, bot.rejecter, bot.expiryAt === "-1");
      ctx.fillText(timeText, textX, yPos + 30);

      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      ctx.roundRect(finalWidth - padding - numberWidth, yPos, numberWidth, cardHeight - 8, [0, 6, 6, 0]);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 23px BeVietnamPro";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${i + 1}`, finalWidth - padding - numberWidth / 2, yPos + cardHeight / 2 - 4);

      yPos += cardHeight;
    }

    const filePath = path.resolve(`./assets/temp/bot_list_${Date.now()}.png`);
    await fs.writeFile(filePath, canvas.toBuffer("image/png"));
    return filePath;
  } catch (error) {
    throw error;
  }
}