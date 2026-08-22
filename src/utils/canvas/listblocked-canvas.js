import { createCanvas, loadImage } from "canvas";
import fs from "fs/promises";
import path from "path";

export async function createBlockedListImage(blocked) {
  if (!blocked || blocked.length === 0) {
    const width = 500;
    const height = 150;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    ctx.font = "bold 20px Arial";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Không có thành viên nào bị chặn", width / 2, height / 2);

    ctx.font = "bold 18px Arial";
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "bottom";
    ctx.fillText("Tạo bởi Hà Huy Hoàng", width / 2, height - 5);

    const filePath = path.resolve(`./assets/temp/blocked_list_${Date.now()}.png`);
    await fs.writeFile(filePath, canvas.toBuffer());
    return filePath;
  }

  const total = blocked.length;
  let numColumns = total > 25 ? 2 : 1;
  const membersPerColumn = Math.min(25, Math.ceil(total / numColumns));

  const maxHeight = 1200;
  let itemHeight = Math.min(90, Math.max(50, Math.floor((maxHeight - 100) / membersPerColumn)));

  const columnWidth = numColumns === 1 ? 500 : 320;
  const headerHeight = 100;
  const sidePadding = numColumns === 1 ? 30 : 20;

  const width = columnWidth * numColumns;
  const height = headerHeight + membersPerColumn * itemHeight + sidePadding * 2 + 30;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  const titleFontSize = numColumns === 1 ? 28 : 32;
  const subtitleFontSize = numColumns === 1 ? 24 : 28;

  ctx.font = `bold ${titleFontSize}px Arial`;
  ctx.fillStyle = "#4da3ff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("BLOCK-LIST-IN-GROUP", width / 2, 20);

  ctx.font = `bold ${subtitleFontSize}px Arial`;
  ctx.fillStyle = "#fff";
  ctx.fillText("Danh Sách Chặn Của Cộng Đồng", width / 2, 60);

  const avatars = await Promise.all(
    blocked.map(async (user) => {
      try {
        return user && user.avatar ? await loadImage(user.avatar) : null;
      } catch {
        return null;
      }
    })
  );

  const columns = [];
  let start = 0;
  for (let i = 0; i < numColumns; i++) {
    const count = Math.min(membersPerColumn, total - start);
    columns.push(blocked.slice(start, start + count));
    start += count;
  }

  columns.forEach((column, colIndex) => {
    const colX = colIndex * columnWidth + sidePadding;

    column.forEach((user, rowIndex) => {
      const yPos = headerHeight + sidePadding + rowIndex * itemHeight;

      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(colX, yPos, columnWidth - sidePadding * 2, itemHeight - 6);

      const numberBoxSize = Math.max(24, Math.floor(itemHeight * 0.4));
      const centerY = yPos + itemHeight / 2;

      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(colX + 10, centerY - numberBoxSize / 2, numberBoxSize, numberBoxSize);
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(12, Math.floor(numberBoxSize * 0.6))}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${colIndex * membersPerColumn + rowIndex + 1}`, colX + 10 + numberBoxSize / 2, centerY);

      const avatarSize = Math.max(36, Math.floor(itemHeight * 0.65));
      const avatarX = colX + 50;
      const avatarY = yPos + (itemHeight - avatarSize) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      const avatarImg = avatars[colIndex * membersPerColumn + rowIndex];
      if (avatarImg) ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
      else {
        ctx.fillStyle = "#555";
        ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
      }
      ctx.restore();

      ctx.strokeStyle = "#e74c3c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.stroke();

      const textCenterY = yPos + itemHeight / 2;
      const nameFontSize = Math.max(12, Math.floor(itemHeight * 0.28));
      const roleFontSize = Math.max(10, Math.floor(itemHeight * 0.18)); // Giảm font vai trò
      const roleOffsetY = numColumns === 1 ? 18 : 10; // Tăng khoảng cách dọc lên 18px

      ctx.font = `bold ${nameFontSize}px Arial`;
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(user.name || "(Không tên)", avatarX + avatarSize + 10, textCenterY - 8);

      ctx.font = `${roleFontSize}px Arial`;
      ctx.fillStyle = "#ff3333";
      ctx.fillText(user.role || "Người Dùng Bị Chặn", avatarX + avatarSize + 10, textCenterY + roleOffsetY);
    });
  });

  ctx.font = "bold 18px Arial";
  ctx.fillStyle = "#dbf300ff";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("Tạo bởi Hà Huy Hoàng", width / 2, height - 6);

  const filePath = path.resolve(`./assets/temp/blocked_list_${Date.now()}.png`);
  await fs.writeFile(filePath, canvas.toBuffer());
  return filePath;
}