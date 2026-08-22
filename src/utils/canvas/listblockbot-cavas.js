import { createCanvas } from "canvas";
import fs from "fs/promises";
import path from "path";

export async function createBlockedBotListImage(blockedUsers) {
  const limitedBlockedUsers = blockedUsers.slice(0, 50);
  const width = 660;
  const itemHeight = 80;
  const headerHeight = 70;
  const height = headerHeight + limitedBlockedUsers.length * itemHeight + 20;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Nền gradient đen
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.8)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.95)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Tiêu đề
  ctx.font = "bold 28px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DANH SÁCH NGƯỜI DÙNG BỊ CHẶN BOT", width / 2, headerHeight / 2);

  const moveRight = 30; // Dịch phải 30px

  // Vẽ từng người dùng bị chặn
  limitedBlockedUsers.forEach((user, index) => {
    const yPos = headerHeight + index * itemHeight + 10;
    const centerY = yPos + (itemHeight - 10) / 2;

    // Khung item
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.roundRect(10, yPos, width - 20, itemHeight - 10, 10);
    ctx.fill();

    // Số thứ tự
    const numberBoxSize = 30;
    const numberBoxY = centerY - numberBoxSize / 2;
    ctx.fillStyle = "#2ecc71";
    ctx.beginPath();
    ctx.roundRect(20 + moveRight, numberBoxY, numberBoxSize, numberBoxSize, 6);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${index + 1}`, 20 + moveRight + numberBoxSize / 2, numberBoxY + numberBoxSize / 2);

    // Placeholder avatar (vì không có dữ liệu avatar)
    const avatarSize = 50;
    const avatarX = 65 + moveRight;
    const avatarY = centerY - avatarSize / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#555";
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    // Viền sáng avatar
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.stroke();

    // Tên người dùng
    ctx.font = "bold 20px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(user.senderName, avatarX + avatarSize + 20, centerY);
  });

  // Chữ ký
  ctx.font = "bold 18px Arial";
  ctx.fillStyle = "#ffcc00";
  ctx.textAlign = "center";
  ctx.fillText("Tạo bởi: Hà Huy Hoàng", width / 2, height - 11);

  const filePath = path.resolve(`./assets/temp/blocked_bot_list_${Date.now()}.png`);
  await fs.writeFile(filePath, canvas.toBuffer());
  return filePath;
}