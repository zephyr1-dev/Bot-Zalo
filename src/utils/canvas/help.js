import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";
import * as cv from "./index.js";

export const linkBackgroundDefault = "./src/service-debug/chat-zalo/chat-special/data-send/help.txt";

// Tạo Hình Lệnh !Help
export async function createInstructionsImage(helpContent, isAdminBox, width = 800) {
  const ctxTemp = createCanvas(999, 999).getContext("2d");

  const space = 36;
  let yTemp = 60;

  ctxTemp.font = "bold 28px Tahoma";
  for (const key in helpContent.allMembers) {
    if (helpContent.allMembers.hasOwnProperty(key)) {
      const keyHelpContent = `${helpContent.allMembers[key].icon} ${helpContent.allMembers[key].command}`;
      const labelWidth = ctxTemp.measureText(keyHelpContent).width;
      const valueHelpContent = " -> " + helpContent.allMembers[key].description;
      const lineWidth = labelWidth + space + ctxTemp.measureText(valueHelpContent).width;
      if (lineWidth > width) {
        yTemp += 52;
      }
      yTemp += 52;
    }
  }

  yTemp += 60; // Khoảng cách dưới

  if (isAdminBox) {
    for (const key in helpContent.admin) {
      if (helpContent.admin.hasOwnProperty(key)) {
        const keyHelpContent = `${helpContent.admin[key].icon} ${helpContent.admin[key].command}`;
        const labelWidth = ctxTemp.measureText(keyHelpContent).width;
        const valueHelpContent = " -> " + helpContent.admin[key].description;
        const lineWidth = labelWidth + space + ctxTemp.measureText(valueHelpContent).width;
        if (lineWidth > width) {
          yTemp += 52;
        }
        yTemp += 52;
      }
    }
    yTemp += 60; // Khoảng cách dưới
  }

  const height = yTemp > 430 ? yTemp : 430;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Đọc danh sách link ảnh từ file và chọn ngẫu nhiên
  let backgroundImageUrl = null;
  try {
    const fileContent = fs.readFileSync(linkBackgroundDefault, "utf-8");
    const imageLinks = fileContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && line.startsWith("http")); // Lọc các dòng hợp lệ
    if (imageLinks.length > 0) {
      backgroundImageUrl = imageLinks[Math.floor(Math.random() * imageLinks.length)];
    }
  } catch (error) {
    console.error("Lỗi khi đọc file chứa link ảnh:", error);
  }

  // Tải và vẽ ảnh nền
  if (backgroundImageUrl) {
    try {
      const backgroundImage = await loadImage(backgroundImageUrl);
      // Tỷ lệ ảnh để phù hợp với canvas
      const imgAspectRatio = backgroundImage.width / backgroundImage.height;
      const canvasAspectRatio = width / height;

      let drawWidth, drawHeight, offsetX, offsetY;

      if (imgAspectRatio > canvasAspectRatio) {
        // Ảnh rộng hơn canvas: fit theo chiều cao, căn giữa theo chiều ngang
        drawHeight = height;
        drawWidth = height * imgAspectRatio;
        offsetX = (width - drawWidth) / 2; // Căn giữa ngang
        offsetY = 0;
      } else {
        // Ảnh cao hơn canvas: fit theo chiều rộng, căn giữa theo chiều dọc
        drawWidth = width;
        drawHeight = width / imgAspectRatio;
        offsetX = 0;
        offsetY = (height - drawHeight) / 2; // Căn giữa dọc
      }

      ctx.drawImage(backgroundImage, offsetX, offsetY, drawWidth, drawHeight);
    } catch (error) {
      console.error("Lỗi khi tải ảnh nền:", error);
      // Dự phòng: sử dụng nền đen với gradient
      const backgroundGradient = ctx.createLinearGradient(0, 0, 0, height);
      backgroundGradient.addColorStop(0, "#3B82F6");
      backgroundGradient.addColorStop(1, "#111827");
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    // Không có link ảnh hợp lệ: sử dụng nền đen với gradient
    const backgroundGradient = ctx.createLinearGradient(0, 0, 0, height);
    backgroundGradient.addColorStop(0, "#3B82F6");
    backgroundGradient.addColorStop(1, "#111827");
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);
  }

  // Vẽ icon nổi như background
const icons = [
  "⭐", "⚡", "🔥", "💎", "✨", "🌙", "🎵", 
  "🌟", "🎶", "❤️", "💖", "💫", "🌈", "☀️", 
  "🌸", "🍀", "🌹", "🎇", "🎉", "🎁", "🪐", "💋"
];
  for (let i = 0; i < 30; i++) {
    const icon = icons[Math.floor(Math.random() * icons.length)];
    const fontSize = Math.floor(Math.random() * 50) + 30;
    ctx.font = `${fontSize}px Tahoma`;
    ctx.fillStyle = cv.getRandomGradient(ctx, width);
    ctx.globalAlpha = 0.4; // Làm icon mờ nhẹ để không lấn chữ
    ctx.shadowColor = "rgba(255,255,255,0.6)";
    ctx.shadowBlur = 12;
    ctx.fillText(icon, Math.random() * width, Math.random() * height);
  }
  ctx.globalAlpha = 1; // Reset lại để văn bản không bị mờ
  ctx.shadowBlur = 0;

  let y = 60;

  // Vẽ tiêu đề
  ctx.textAlign = "left";
  ctx.font = "bold 28px Tahoma";
  ctx.fillStyle = cv.getRandomGradient(ctx, width);
  ctx.fillText(helpContent.title, space, y);

  y += 50;

  // Vẽ nội dung cho allMembers
  ctx.textAlign = "left";
  ctx.font = "bold 28px Tahoma";
  ctx.fillStyle = "#FFFFFF";

  for (const key in helpContent.allMembers) {
    if (helpContent.allMembers.hasOwnProperty(key)) {
      ctx.fillStyle = cv.getRandomGradient(ctx, width);
      const keyHelpContent = `${helpContent.allMembers[key].icon} ${helpContent.allMembers[key].command}`;
      const labelWidth = ctx.measureText(keyHelpContent).width;
      ctx.fillText(keyHelpContent, space, y);
      ctx.fillStyle = "#FFFFFF";
      const valueHelpContent = " -> " + helpContent.allMembers[key].description;
      const lineWidth = labelWidth + space + ctx.measureText(valueHelpContent).width;
      if (lineWidth > width) {
        y += 52;
        ctx.fillText(valueHelpContent, space + 20, y);
      } else {
        ctx.fillText(valueHelpContent, space + labelWidth, y);
      }
      y += 52;
    }
  }

  // Vẽ nội dung cho admin nếu isAdminBox = true
  if (isAdminBox) {
    if (Object.keys(helpContent.admin).length > 0) {
      y += 30;
      ctx.textAlign = "left";
      ctx.font = "bold 28px Tahoma";
      ctx.fillStyle = cv.getRandomGradient(ctx, width);
      ctx.fillText(helpContent.titleAdmin, space, y);
      y += 50;
      for (const key in helpContent.admin) {
        if (helpContent.admin.hasOwnProperty(key)) {
          ctx.fillStyle = cv.getRandomGradient(ctx, width);
          const keyHelpContent = `${helpContent.admin[key].icon} ${helpContent.admin[key].command}`;
          const labelWidth = ctx.measureText(keyHelpContent).width;
          ctx.fillText(keyHelpContent, space, y);
          ctx.fillStyle = "#FFFFFF";
          const valueHelpContent = " -> " + helpContent.admin[key].description;
          const lineWidth = labelWidth + space + ctx.measureText(valueHelpContent).width;
          if (lineWidth > width) {
            y += 52;
            ctx.fillText(valueHelpContent, space + 20, y);
          } else {
            ctx.fillText(valueHelpContent, space + labelWidth, y);
          }
          y += 52;
        }
      }
    }
  }

  const filePath = path.resolve(`./assets/temp/help_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}