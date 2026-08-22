import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";
import * as cv from "./index.js";
import { formatCurrency } from "../format-util.js";

export function hanldeNameUser(name) {
  const words = name.split(" ");
  let line1 = "";
  let line2 = "";

  if (name.length <= 16) {
    return [name, ""];
  }

  if (words.length === 1) {
    line1 = name.substring(0, 16);
    line2 = name.substring(16);
  } else {
    for (let i = 0; i < words.length; i++) {
      if ((line1 + " " + words[i]).trim().length <= 16) {
        line1 += (line1 ? " " : "") + words[i];
      } else {
        line2 = words.slice(i).join(" ");
        break;
      }
    }
  }

  return [line1.trim(), line2.trim()];
}

export function handleNameLong(name, lengthLine = 16) {
  const words = name.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= lengthLine) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) {
        lines.push(currentLine.trim());
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine.trim());
  }

  // Nếu Không có dòng nào được tạo (tên ngắn hơn 16 ký tự), thêm tên gốc vào mảng
  if (lines.length === 0) {
    lines.push(name);
  }

  return {
    lines: lines,
    totalLines: lines.length,
  };
}

// Tạo Hình Lệnh !Info
export async function createUserInfoImage(userInfo) {
  if (!userInfo) {
    console.error("Dữ liệu userInfo không hợp lệ");
    return null;
  }

  const [nameLine1, nameLine2] = hanldeNameUser(userInfo.name || "Unnamed User");
  const padding = 30;
  const lineH = 35;
  const titleH = 40;

  // Calculate dimensions for dynamic sizing
  const tempCanvas = createCanvas(2000, 100);
  const tempCtx = tempCanvas.getContext("2d");

  // Measure title width
  tempCtx.font = "bold 48px BeVietnamPro";
  const titleWidth = tempCtx.measureText(userInfo.title || "User Profile").width;

  // Measure username width
  tempCtx.font = "bold 32px BeVietnamPro";
  const nameWidth1 = tempCtx.measureText(nameLine1).width;
  const nameWidth2 = nameLine2 ? tempCtx.measureText(nameLine2).width : 0;
  const nameWidth = Math.max(nameWidth1, nameWidth2);

  // Calculate bio lines
  let bioLinesArray = [];
  let maxBioWidth = 0;
  if (userInfo.bio && userInfo.bio !== "Không có thông tin bio") {
    tempCtx.font = "24px BeVietnamPro";
    const bioLines = [...userInfo.bio.split("\n")];
    bioLines.forEach((line) => {
      const { lines } = handleNameLong(line || "", 56);
      bioLinesArray.push(...lines);
      lines.forEach((bioLine) => {
        maxBioWidth = Math.max(maxBioWidth, tempCtx.measureText(bioLine).width);
      });
    });
  }
  const bioLines = Math.max(bioLinesArray.length, 1);
  const bioH = titleH + bioLines * lineH + padding * 4; // Increased padding for taller bio section

  // Info fields
  const infoLines = 6;
  const infoH = titleH + infoLines * lineH + padding * 2;
  tempCtx.font = "bold 24px BeVietnamPro";
  const fields = [
    { label: "🆔 Username", value: userInfo.username || "N/A" },
    { label: "🎂 Birthday", value: userInfo.birthday || "N/A" },
    { label: "🧑‍🤝‍🧑 Gender", value: userInfo.gender || "N/A" },
    { label: "💼 Business", value: userInfo.businessType || "N/A" },
    { label: "📅 Created", value: userInfo.createdDate || "N/A" },
    { label: "🕰️ Last Active", value: userInfo.lastActive || "N/A" },
  ];
  let maxInfoWidth = 0;
  fields.forEach((field) => {
    const labelText = field.label + ": " + field.value;
    maxInfoWidth = Math.max(maxInfoWidth, tempCtx.measureText(labelText).width);
  });

  // Calculate canvas dimensions
  const avatarSize = 180;
  const xAvatar = 170;
  const infoStartX = xAvatar + avatarSize / 2 + 86;
  const nameHeight = nameLine2 ? 54 + 28 : 54;
  const iconsHeight = nameLine2 ? 68 : 40;
  const headerH = avatarSize + nameHeight + iconsHeight + padding;
  const contentH = Math.max(headerH, infoH + padding);
  const totalH = contentH + (bioLinesArray.length > 0 ? bioH + padding : 0) + padding * 2;
  const minWidth = Math.max(
    titleWidth + padding * 2,
    xAvatar + avatarSize + maxInfoWidth + padding * 2,
    maxBioWidth + padding * 2
  );
  const width = Math.max(1000, minWidth);
  const height = Math.max(450, totalH);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Draw solid black background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  // Draw subtle icon overlays
const icons = [
  "⭐", "⚡", "🔥", "💎", "✨", "🌙", "🎵", 
  "🌟", "🎶", "❤️", "💖", "💫", "🌈", "☀️", 
  "🌸", "🍀", "🌹", "🎇", "🎉", "🎁", "🪐"
];
  for (let i = 0; i < 30; i++) {
    const icon = icons[Math.floor(Math.random() * icons.length)];
    const fontSize = Math.floor(Math.random() * 50) + 30;
    ctx.font = `${fontSize}px Tahoma`;
    ctx.fillStyle = cv.getRandomGradient(ctx, width);
    ctx.globalAlpha = 0.4;
    ctx.shadowColor = "rgba(255,255,255,0.6)";
    ctx.shadowBlur = 12;
    ctx.fillText(icon, Math.random() * width, Math.random() * height);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // Draw avatar
  const yAvatar = padding + 50;
  if (userInfo.avatar && cv.isValidUrl(userInfo.avatar)) {
    try {
      const avatar = await loadImage(userInfo.avatar);
      const borderWidth = 6;
      const gradient = ctx.createLinearGradient(
        xAvatar - avatarSize / 2 - borderWidth,
        yAvatar - borderWidth,
        xAvatar + avatarSize / 2 + borderWidth,
        yAvatar + avatarSize + borderWidth
      );
      const rainbowColors = ["#3B82F6", "#60A5FA", "#93C5FD", "#A5B4FC", "#C4B5FD", "#A5B4FC", "#60A5FA"];
      rainbowColors.forEach((color, index) => {
        gradient.addColorStop(index / (rainbowColors.length - 1), color);
      });

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      ctx.beginPath();
      ctx.arc(
        xAvatar,
        yAvatar + avatarSize / 2,
        avatarSize / 2 + borderWidth,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(
        xAvatar,
        yAvatar + avatarSize / 2,
        avatarSize / 2,
        0,
        Math.PI * 2
      );
      ctx.clip();
      ctx.drawImage(
        avatar,
        xAvatar - avatarSize / 2,
        yAvatar,
        avatarSize,
        avatarSize
      );
      ctx.restore();

      // Status dot
      const dotSize = 26;
      const dotX = xAvatar + avatarSize / 2 - dotSize / 2;
      const dotY = yAvatar + avatarSize - dotSize / 2;
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = userInfo.isOnline ? "#34D399" : "#6B7280";
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Username
      ctx.font = "bold 32px BeVietnamPro";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      const nameY = yAvatar + avatarSize + 54;
      if (nameLine2) {
        ctx.font = "bold 28px BeVietnamPro";
        ctx.fillText(nameLine1, xAvatar, nameY);
        ctx.fillText(nameLine2, xAvatar, nameY + 28);
      } else {
        ctx.fillText(nameLine1, xAvatar, nameY);
      }

      // Platform icons
      const iconSize = 24;
      const iconSpacing = 10;
      const icons = [];
      if (userInfo.isActive) icons.push("📱");
      if (userInfo.isActivePC) icons.push("💻");
      if (userInfo.isActiveWeb) icons.push("🌐");
      const iconsY = nameY + (nameLine2 ? 68 : 40);
      ctx.font = `${iconSize}px Arial`;
      icons.forEach((icon, index) => {
        const x = xAvatar + (index - (icons.length - 1) / 2) * (iconSize + iconSpacing);
        ctx.fillText(icon, x, iconsY);
      });
    } catch (error) {
      console.error("Lỗi load avatar:", error);
    }
  }

  // Draw title
  ctx.textAlign = "center";
  ctx.font = "bold 48px BeVietnamPro";
  const titleGradient = ctx.createLinearGradient(0, 60, width, 60);
  titleGradient.addColorStop(0, "#00FFFF");
  titleGradient.addColorStop(1, "#FFFF00");
  ctx.fillStyle = titleGradient;
  ctx.fillText(userInfo.title || "User Profile", width / 2, padding + 30);

  // Draw info box
  const boxY = yAvatar;
  const boxWidth = width - infoStartX - padding;
  const boxHeight = infoH;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, infoStartX, boxY, boxWidth, boxHeight, 12, true, true);

  ctx.font = "bold 26px BeVietnamPro";
  const infoGradient = ctx.createLinearGradient(0, boxY + 30, width, boxY + 30);
  infoGradient.addColorStop(0, "#00FFFF");
  infoGradient.addColorStop(1, "#FFFF00");
  ctx.fillStyle = infoGradient;
  ctx.textAlign = "center";
  ctx.fillText("User Information", infoStartX + boxWidth / 2, boxY + 40);

  ctx.textAlign = "left";
  ctx.font = "bold 24px BeVietnamPro";
  let y = boxY + 80;
  for (const field of fields) {
    const labelText = field.label + ":";
    const labelWidth = ctx.measureText(labelText).width;
    ctx.fillStyle = infoGradient;
    ctx.fillText(labelText, infoStartX + 20, y);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(" " + field.value, infoStartX + 20 + labelWidth, y);
    y += 40;
  }

  // Draw bio section
  if (userInfo.bio !== "Không có thông tin bio") {
    const bioBoxY = Math.max(headerH, boxY + boxHeight) + padding; // Reduced gap to bring bio closer
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    roundRect(ctx, padding, bioBoxY, width - padding * 2, bioH, 12, true, true);

    ctx.font = "bold 26px BeVietnamPro";
    const bioGradient = ctx.createLinearGradient(0, bioBoxY + 30, width, bioBoxY + 30);
    bioGradient.addColorStop(0, "#00FFFF");
    bioGradient.addColorStop(1, "#FFFF00");
    ctx.fillStyle = bioGradient;
    ctx.textAlign = "center";
    ctx.fillText("Bio", width / 2, bioBoxY + 30);

    ctx.font = "24px BeVietnamPro";
    y = bioBoxY + 60;
    bioLinesArray.forEach((line) => {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(line, width / 2, y);
      y += lineH;
    });
  }

  const filePath = path.resolve(`./assets/temp/user_info_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}

// Tạo Hình Card Game
export async function createUserCardGame(playerInfo) {
  const [nameLine1, nameLine2] = cv.hanldeNameUser(playerInfo.playerName);
  const width = 1080;

  const height = 535;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  cv.drawDynamicGradientBackground(ctx, width, height);
  cv.drawAnimatedBackground(ctx, width, height);

  let xAvatar = 180;
  let widthAvatar = 180;
  let heightAvatar = 180;
  let yAvatar = 100; // Đặt yAvatar cố định là 100
  let yA1 = height / 2 - heightAvatar / 2 - yAvatar; // Tính toán lại yA1

  if (playerInfo && cv.isValidUrl(playerInfo.avatar)) {
    try {
      const avatar = await loadImage(playerInfo.avatar);

      // Vẽ vòng tròn 7 màu cầu vồng
      const borderWidth = 10;
      const gradient = ctx.createLinearGradient(
        xAvatar - widthAvatar / 2 - borderWidth,
        yAvatar - borderWidth,
        xAvatar + widthAvatar / 2 + borderWidth,
        yAvatar + heightAvatar + borderWidth
      );

      const rainbowColors = [
        "#FF0000", // Đỏ
        "#FF7F00", // Cam
        "#FFFF00", // Vàng
        "#00FF00", // Lục
        "#0000FF", // Lam
        "#4B0082", // Chàm
        "#9400D3", // Tím
      ];

      // Xáo trộn mảng màu sắc
      const shuffledColors = [...rainbowColors].sort(() => Math.random() - 0.5);

      // Thêm các màu vào gradient
      shuffledColors.forEach((color, index) => {
        gradient.addColorStop(index / (shuffledColors.length - 1), color);
      });

      ctx.save();
      ctx.beginPath();
      ctx.arc(
        xAvatar,
        yAvatar + heightAvatar / 2,
        widthAvatar / 2 + borderWidth,
        0,
        Math.PI * 2,
        true
      );
      ctx.fillStyle = gradient;
      ctx.fill();

      // Thêm hiệu ứng bóng mờ màu trắng xung quanh avatar
      ctx.shadowColor = "rgba(255, 255, 255, 0.5)"; // Màu trắng với độ trong suốt
      ctx.shadowBlur = 20; // Độ mờ của bóng
      ctx.shadowOffsetX = 0; // Không có độ lệch theo chiều ngang
      ctx.shadowOffsetY = 0; // Không có độ lệch theo chiều dọc

      // Vẽ avatar
      ctx.beginPath();
      ctx.arc(
        xAvatar,
        yAvatar + heightAvatar / 2,
        widthAvatar / 2,
        0,
        Math.PI * 2,
        true
      );
      ctx.clip();
      ctx.drawImage(
        avatar,
        xAvatar - widthAvatar / 2,
        yAvatar,
        widthAvatar,
        heightAvatar
      );
      ctx.restore();

      // Giữ lại hiệu ứng bóng mờ chỉ xung quanh avatar
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;

      // Vẽ chấm trạng thái
      const dotSize = 26;
      const dotX = xAvatar + widthAvatar / 2 - dotSize / 2;
      const dotY = yAvatar + heightAvatar - dotSize / 2;
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotSize / 2, 0, Math.PI * 2);
      if (playerInfo.isOnline) {
        ctx.fillStyle = "#00FF00"; // Màu xanh lá cây cho trạng thái hoạt động
      } else {
        ctx.fillStyle = "#808080"; // Màu xám cho trạng thái Không hoạt động
      }
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Vẽ tên người dùng dưới avatar
      ctx.font = "bold 32px Tahoma";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      const nameY = yAvatar + heightAvatar + 54;
      if (nameLine2) {
        ctx.font = "bold 24px Tahoma";
        ctx.fillText(nameLine1, xAvatar, nameY);
        ctx.font = "bold 24px Tahoma";
        ctx.fillText(nameLine2, xAvatar, nameY + 28);
      } else {
        ctx.fillText(nameLine1, xAvatar, nameY);
      }

      // Thêm hiệu ứng gradient cho tên người dùng
      const nameGradient = ctx.createLinearGradient(
        xAvatar,
        nameY,
        xAvatar,
        nameY + 30
      );
      nameGradient.addColorStop(0, "#ff4b1f");
      nameGradient.addColorStop(1, "#1fddff");
      ctx.fillStyle = nameGradient;

      // Thêm khung và hiệu ứng cho avatar
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;

      // Vẽ các biểu tượng
      const iconSize = 24;
      const iconSpacing = 10;
      const icons = [];

      if (playerInfo.isActive) icons.push("📱");
      if (playerInfo.isActivePC) icons.push("💻");
      if (playerInfo.isActiveWeb) icons.push("🌐");
      const iconsY = nameY + (nameLine2 ? 68 : 40); // Đặt biểu tượng cách tên 40px

      ctx.font = `${iconSize}px Arial`;
      icons.forEach((icon, index) => {
        const x =
          xAvatar + (index - (icons.length - 1) / 2) * (iconSize + iconSpacing);
        ctx.fillText(icon, x, iconsY);
      });
    } catch (error) {
      console.error("Lỗi load avatar:", error);
    }
  }

  let y1 = 60;

  ctx.textAlign = "center";
  ctx.font = "bold 48px Tahoma";
  ctx.fillStyle = cv.getRandomGradient(ctx, width);
  ctx.fillText(playerInfo.title, width / 2, y1);

  // Sau khi vẽ tên và biểu tượng
  const nameWidth = ctx.measureText(nameLine1).width;
  const infoStartX = Math.max(
    xAvatar + widthAvatar / 2 + 60,
    xAvatar + nameWidth / 2 - 20
  );

  ctx.textAlign = "left";
  let y = y1 + 45;

  // Danh sách các trường thông tin cần hiển thị
  const fields = [
    { label: "🆔 Tên Đăng Nhập", value: playerInfo.account },
    // { label: "🧑‍🤝‍🧑 Giới tính", value: playerInfo.gender },
    {
      label: "💰 Số Dư Hiện Tại",
      value: formatCurrency(playerInfo.balance) + " VNĐ",
    },
    {
      label: "🏆 Tổng Thắng",
      value: formatCurrency(playerInfo.totalWinnings) + " VNĐ",
    },
    {
      label: "💸 Tổng Thua",
      value: formatCurrency(playerInfo.totalLosses) + " VNĐ",
    },
    {
      label: "💹 Lợi Nhuận Ròng",
      value: formatCurrency(playerInfo.netProfit) + " VNĐ",
    },
    {
      label: "🎮 Số Lượt Chơi",
      value:
        playerInfo.totalGames +
        " Games " +
        "(" +
        playerInfo.totalWinGames +
        "W/" +
        (playerInfo.totalGames - playerInfo.totalWinGames) +
        "L)",
    },
    { label: "📊 Tỉ Lệ Thắng", value: playerInfo.winRate + "%" },
    { label: "📅 Created Time", value: playerInfo.registrationTime },
    { label: "🎁 Nhận Quà Daily", value: playerInfo.lastDailyReward },
  ];

  ctx.font = "bold 28px Tahoma";
  for (const field of fields) {
    ctx.fillStyle = cv.getRandomGradient(ctx, width);
    const labelText = field.label + ":";
    const labelWidth = ctx.measureText(labelText).width;
    ctx.fillText(labelText, infoStartX, y);

    if (field.label === "📊 Tỉ Lệ Thắng") {
      // Vẽ thanh trạng thái cho t�� lệ thắng
      const barWidth = 200; // Chiều dài tối đa của thanh trạng thái
      const winRate = parseFloat(field.value); // Giả sử field.value là chuỗi "50%"
      const filledWidth = (winRate / 100) * barWidth; // Tính toán chiều dài đã điền của thanh

      // Tạo gradient nhẹ nhàng cho thanh trạng thái
      const barGradient = ctx.createLinearGradient(
        infoStartX + labelWidth,
        y - 20,
        infoStartX + labelWidth + barWidth,
        y
      );
      barGradient.addColorStop(0, "#b8e994"); // Màu xanh nhạt
      barGradient.addColorStop(0.5, "#96e6a1"); // Màu xanh lá nhạt
      barGradient.addColorStop(1, "#b8e994"); // Màu xanh nhạt

      // Vẽ thanh nền với góc bo tròn
      ctx.fillStyle = "#ddd"; // Màu nền của thanh
      cv.roundRect(
        ctx,
        infoStartX + labelWidth + 20,
        y - 20,
        barWidth,
        20,
        5,
        true,
        false
      );

      // Vẽ phần đã điền của thanh với gradient và góc bo tròn
      ctx.fillStyle = barGradient;
      cv.roundRect(
        ctx,
        infoStartX + labelWidth + 20,
        y - 20,
        filledWidth,
        20,
        5,
        true,
        false
      );

      // Hiển thị phần trăm bên phải thanh trạng thái
      ctx.fillStyle = "#fff"; // Màu chữ
      ctx.fillText(field.value, infoStartX + labelWidth + 30 + barWidth + 5, y); // Vị trí hiển thị phần trăm
    } else {
      // Vẽ giá trị thông thường cho các trường khác
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(" " + field.value, infoStartX + labelWidth, y);
    }

    y += 42; // Tăng y cho trường tiếp theo
  }

  ctx.beginPath();
  ctx.moveTo(width * 0.05, y - 20);
  ctx.lineTo(width * 0.95, y - 20);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.stroke();
  y += 20; // Tăng y cho trường tiếp theo

  ctx.font = "bold 28px Tahoma";
  ctx.fillStyle = cv.getRandomGradient(ctx, width);
  ctx.textAlign = "center";
  ctx.fillText("Chúc Bạn 8386 | Mãi Đỉnh Mãi Đỉnh", width / 2, y);

  const filePath = path.resolve(`./assets/temp/user_info_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}

export async function createBotInfoImage(botInfo, uptime, botStats, onConfigs, offConfigs) {
  const isPrivateMessage = onConfigs.length === 0 && offConfigs.length === 0;
  const isOnConfigsEmpty = onConfigs.length === 0;
  const width = isPrivateMessage ? 900 : isOnConfigsEmpty ? 1450 : 1700;
  const maxConfigs = isOnConfigsEmpty ? offConfigs.length : Math.max(onConfigs.length, offConfigs.length);
  const configsBoxH = 100 + maxConfigs * 24;

  // Calculate content height
  const headerHeight = 170; // Avatar (y=80, size=100) + text (110, 140, 170)
  const systemInfoBoxH = 180; // System Info box height
  const resourceUsageBoxH = 200; // Resource Usage box height
  const ramDiskBoxH = 260; // RAM & Disk Usage box height
  const pieChartExtraH = 100; // Extra space for pie chart labels (radius 60 + 25 + 45 + 65)
  const verticalSpacing = 30; // Space between boxes (220-170=50, 420-400=20, 640-620=20, adjusted to 30 for consistency)

  // Total content height
  let contentHeight = headerHeight + systemInfoBoxH + resourceUsageBoxH + ramDiskBoxH + pieChartExtraH;
  if (!isPrivateMessage) {
    contentHeight = Math.max(contentHeight, headerHeight + configsBoxH);
  }
  contentHeight += 2 * verticalSpacing; // Spaces between boxes

  // Desired padding for top and bottom (e.g., 40px each)
  const padding = 40;
  const height = contentHeight + 2 * padding;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Draw background
  try {
    const bg = botInfo?.avatar ? await loadImage(botInfo.avatar) : null;
    if (bg) {
      const scale = Math.max(width / bg.width, height / bg.height);
      ctx.filter = "blur(6px)";
      ctx.drawImage(bg, (width - bg.width * scale) / 2, (height - bg.height * scale) / 2, bg.width * scale, bg.height * scale);
      ctx.filter = "none";
    }
  } catch (error) {
    console.error("Lỗi load background:", error);
  }
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, 0, width, height);

  // Calculate starting Y position to center content
  const startY = padding;

  // Draw header (avatar and text)
  if (botInfo?.avatar) {
    try {
      const avatar = await loadImage(botInfo.avatar);
      const size = 100;
      const x = 80, y = startY + 30; // Adjusted for padding

      const borderWidth = 6;
      const gradient = ctx.createLinearGradient(
        x,
        y,
        x + size + borderWidth,
        y + size + borderWidth
      );
      const rainbowColors = [
        "#FF0000",
        "#FF7F00",
        "#FFFF00",
        "#00FF00",
        "#0000FF",
        "#4B0082",
        "#9400D3",
      ];
      rainbowColors.forEach((color, index) => {
        gradient.addColorStop(index / (rainbowColors.length - 1), color);
      });

      ctx.save();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2 + borderWidth / 2, 0, Math.PI * 2, true);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = borderWidth;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
      ctx.clip();
      ctx.drawImage(avatar, x, y, size, size);
      ctx.restore();
    } catch (error) {
      console.error("Lỗi load avatar:", error);
    }
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 32px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(botInfo.name || "</>Hà Huy Hoàng", 200, startY + 60);
  ctx.font = "20px sans-serif";
  ctx.fillStyle = "#AAAAAA";
  ctx.fillText(`Developer: ${botInfo.developer || "</>Hà Huy Hoàng"}`, 200, startY + 90);
  ctx.fillText(`Uptime: ${uptime}`, 200, startY + 120);

  function drawBox(title, items, x, y, w, h) {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    roundRect(ctx, x, y, w, h, 12, true, false);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 12, false, true);

    ctx.fillStyle = cv.getRandomGradient(ctx, w);
    ctx.font = "bold 24px BeVietnamPro";
    ctx.textAlign = "center";
    let titleText = title;
    const maxTitleWidth = w - 40;
    if (ctx.measureText(titleText).width > maxTitleWidth) {
      while (ctx.measureText(titleText + "...").width > maxTitleWidth && titleText.length > 0) {
        titleText = titleText.slice(0, -1);
      }
      titleText += "...";
    }
    ctx.fillText(titleText, x + w / 2, y + 30);

    ctx.textAlign = "left";
    ctx.font = "bold 20px BeVietnamPro";
    let yy = y + 50;
    const maxTextWidth = w - 40;
    items.forEach(item => {
      ctx.fillStyle = cv.getRandomGradient(ctx, w);
      let labelText = item.label + ":";
      if (ctx.measureText(labelText).width > maxTextWidth / 2) {
        while (ctx.measureText(labelText + "...").width > maxTextWidth / 2 && labelText.length > 0) {
          labelText = labelText.slice(0, -1);
        }
        labelText += "...";
      }
      const labelWidth = ctx.measureText(labelText).width;
      ctx.fillText(labelText, x + 20, yy);
      ctx.fillStyle = "#FFFFFF";
      let valueText = item.value.toString();
      if (ctx.measureText(labelText + " " + valueText).width > maxTextWidth) {
        while (ctx.measureText(labelText + " " + valueText + "...").width > maxTextWidth && valueText.length > 0) {
          valueText = valueText.slice(0, -1);
        }
        valueText += "...";
      }
      ctx.fillText(" " + valueText, x + 20 + labelWidth, yy);
      yy += 30;
    });
  }

  const leftBoxWidth = isPrivateMessage ? 820 : isOnConfigsEmpty ? 890 : 740;
  drawBox("System Info", [
    { label: "🔢 Phiên bản", value: botStats.version },
    { label: "💾 Bộ nhớ bot", value: botStats.memoryUsage },
    { label: "💻 Hệ điều hành", value: botStats.os },
    { label: "⚙️ CPU Model", value: botStats.cpuModel },
    { label: "📊 CPU Usage", value: botStats.cpu }
  ], 40, startY + headerHeight, leftBoxWidth, systemInfoBoxH);

  drawBox("Resource Usage", [
    { label: "🌡️ CPU Temp", value: botStats.cpuTemp || "36.0°C" },
    { label: "📈 RAM Usage", value: botStats.ram },
    { label: "💽 Disk Usage", value: botStats.disk },
    { label: "🌍 Network", value: botStats.networkSpeed || "N/A" },
    { label: "📶 Nhà mạng", value: botStats.isp || "FPT Telecom" }
  ], 40, startY + headerHeight + systemInfoBoxH + verticalSpacing, leftBoxWidth, resourceUsageBoxH);

  function drawPieChart(x, y, radius, percent, label) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#4ECB71";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(
      x,
      y,
      radius,
      -Math.PI / 2,
      -Math.PI / 2 + (percent / 100) * Math.PI * 2
    );
    ctx.fillStyle = "#FF6B6B";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 20px BeVietnamPro";
    ctx.textAlign = "center";
    ctx.fillText(`${percent.toFixed(1)}%`, x, y + 5);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "18px BeVietnamPro";
    ctx.fillText(label, x, y + radius + 25);

    ctx.fillStyle = "#FF6B6B";
    ctx.font = "14px BeVietnamPro";
    ctx.fillText("■ Đã dùng", x, y + radius + 45);

    ctx.fillStyle = "#4ECB71";
    ctx.fillText("■ Còn trống", x, y + radius + 65);
  }

  const ramDiskBoxY = startY + headerHeight + systemInfoBoxH + resourceUsageBoxH + 2 * verticalSpacing;
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  roundRect(ctx, 40, ramDiskBoxY, leftBoxWidth, ramDiskBoxH, 12, true, false);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 2;
  roundRect(ctx, 40, ramDiskBoxY, leftBoxWidth, ramDiskBoxH, 12, false, true);

  ctx.fillStyle = cv.getRandomGradient(ctx, leftBoxWidth);
  ctx.font = "bold 24px BeVietnamPro";
  ctx.textAlign = "center";
  ctx.fillText("RAM & Disk Usage", 40 + leftBoxWidth / 2, ramDiskBoxY + 30);

// Tính phần trăm RAM và Disk từ định dạng "4.9/6.9gb"
const calculatePercent = (str) => {
  if (!str || !str.includes('/')) return 0; // Kiểm tra chuỗi hợp lệ
  const cleanStr = str.replace("gb", "").trim(); // Xóa 'gb'
  const [used, total] = cleanStr.split("/").map(num => parseFloat(num)); // Tách và chuyển thành số
  return total > 0 ? (used / total) * 100 : 0; // Tính phần trăm
};

const ramPercent = calculatePercent(botStats.ram); // Tính % cho RAM
const diskPercent = calculatePercent(botStats.disk); // Tính % cho Disk

// Vẽ biểu đồ tròn với giá trị phần trăm chính xác
drawPieChart(40 + leftBoxWidth / 3, ramDiskBoxY + 120, 60, ramPercent, "RAM");
drawPieChart(40 + (leftBoxWidth / 3) * 2, ramDiskBoxY + 120, 60, diskPercent, "Disk");

  if (!isPrivateMessage) {
    const boxW = isOnConfigsEmpty ? 400 : 800;
    const boxX = 40 + leftBoxWidth + 80;
    const boxY = startY + headerHeight;
    const boxH = configsBoxH;

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    roundRect(ctx, boxX, boxY, boxW, boxH, 12, true, false);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    roundRect(ctx, boxX, boxY, boxW, boxH, 12, false, true);

    ctx.fillStyle = cv.getRandomGradient(ctx, boxW);
    ctx.font = "bold 24px BeVietnamPro";
    ctx.textAlign = "center";
    let groupConfigsTitle = "Group Configs";
    const maxTitleWidth = boxW - 40;
    if (ctx.measureText(groupConfigsTitle).width > maxTitleWidth) {
      while (ctx.measureText(groupConfigsTitle + "...").width > maxTitleWidth && groupConfigsTitle.length > 0) {
        groupConfigsTitle = groupConfigsTitle.slice(0, -1);
      }
      groupConfigsTitle += "...";
    }
    ctx.fillText(groupConfigsTitle, boxX + boxW / 2, boxY + 30);

    ctx.textAlign = "left";
    ctx.font = "18px sans-serif";
    const maxConfigWidth = (isOnConfigsEmpty ? boxW : boxW * 0.45) - 40;

    let oy = boxY + 70;
    ctx.fillStyle = "#FF6B6B";
    ctx.fillText("❌ Đang tắt:", boxX + 40, oy);
    oy += 30;
    offConfigs.forEach(line => {
      ctx.fillStyle = "#FFFFFF";
      let configText = "• " + line;
      if (ctx.measureText(configText).width > maxConfigWidth) {
        while (ctx.measureText(configText + "...").width > maxConfigWidth && configText.length > 0) {
          configText = configText.slice(0, -1);
        }
        configText += "...";
      }
      ctx.fillText(configText, boxX + 40, oy);
      oy += 24;
    });

    if (!isOnConfigsEmpty) {
      let py = boxY + 70;
      ctx.fillStyle = "#4ECB71";
      ctx.fillText("✅ Đang bật:", boxX + boxW * 0.55 + 20, py);
      py += 30;
      onConfigs.forEach(line => {
        ctx.fillStyle = "#FFFFFF";
        let configText = "• " + line;
        if (ctx.measureText(configText).width > maxConfigWidth) {
          while (ctx.measureText(configText + "...").width > maxConfigWidth && configText.length > 0) {
            configText = configText.slice(0, -1);
          }
          configText += "...";
        }
        ctx.fillText(configText, boxX + boxW * 0.55 + 20, py);
        py += 24;
      });
    }
  }

  const filePath = path.resolve(`./assets/temp/bot_info_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}
export function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine + (currentLine ? " " : "") + word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

// Tạo Hình Lệnh !Info
export async function createGroupInfoImage(groupInfo, owner) {
  if (!groupInfo || !owner) {
    console.error("Dữ liệu groupInfo hoặc owner không hợp lệ");
    return null;
  }

  // Thiết lập mặc định cho hiển thị các phần
  const showGroupInfo = groupInfo.showGroupInfo !== undefined ? groupInfo.showGroupInfo : true;
  const showSettings = groupInfo.showSettings !== undefined ? groupInfo.showSettings : true;
  const showDescription = groupInfo.showDescription !== undefined ? groupInfo.showDescription : true;

  const { lines: nameLines, totalLines: nameTotalLines } = handleNameLong(groupInfo.name || "Unnamed Group", 40);
  const padding = 20;
  const extraBottomPadding = 100; // Tăng padding dưới cùng lên 100px để tạo khoảng cách an toàn
  const avatarSize = 120;
  const headerH = 200;
  const lineH = 32; // Tăng line height để tránh chồng lấn
  const titleH = 40;
  const infoLines = 5;
  const infoH = titleH + infoLines * lineH + padding * 2;
  const gapBetweenBoxes = 35; // Khoảng cách giữa các phần

  // Tính toán chiều rộng tối đa cho tên nhóm
  const tempCanvas = createCanvas(2000, 100);
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.font = "bold 36px 'BeVietnamPro'"; // Giảm font size từ 40px xuống 36px
  const maxNameWidthEstimate = tempCtx.measureText(`${groupInfo.name || 'Unnamed Group'}`).width;
  const maxNameWidth = Math.max(600, maxNameWidthEstimate);
  const minWidth = maxNameWidth + (avatarSize + padding * 3) + (padding * 2);
  const width = Math.max(1000, minWidth);

  // Xử lý mô tả nhóm
  let bioLinesArray = [];
  let descH = 0;
  let hasDescription = false;
  if (groupInfo.desc && typeof groupInfo.desc === 'string' && groupInfo.desc.trim()) {
    const bioLines = groupInfo.desc.trim().split("\n");
    bioLines.forEach((line) => {
      const { lines } = handleNameLong(line || "", 60);
      bioLinesArray.push(...lines);
    });
    hasDescription = true;
    const maxDescLines = 12; // Tăng giới hạn dòng mô tả lên 12 để tránh cắt nội dung
    bioLinesArray = bioLinesArray.slice(0, maxDescLines);
    const descLines = Math.max(bioLinesArray.length, 1);
    descH = titleH + descLines * lineH + padding * 2;
  }

  const settingsList = [
    { key: 'blockName', label: 'Chặn đổi tên', inverted: false },
    { key: 'signAdminMsg', label: 'Ký tên quản trị viên', inverted: false },
    { key: 'addMemberOnly', label: 'Chỉ quản trị viên thêm thành viên', inverted: false },
    { key: 'setTopicOnly', label: 'Chỉ quản trị viên đặt chủ đề', inverted: true },
    { key: 'enableMsgHistory', label: 'Lịch sử tin nhắn', inverted: false },
    { key: 'lockCreatePost', label: 'Khóa tạo bài viết', inverted: false },
    { key: 'lockCreatePoll', label: 'Khóa tạo bình chọn', inverted: false },
    { key: 'joinAppr', label: 'Phê duyệt tham gia', inverted: false },
    { key: 'lockSendMsg', label: 'Khóa gửi tin nhắn', inverted: false },
    { key: 'lockViewMember', label: 'Khóa xem thành viên', inverted: false },
  ];
  const settingsLines = settingsList.length;
  const settingsH = titleH + settingsLines * lineH + padding * 2;

  // Tính toán chiều cao canvas động
  let totalContentH = 0;
  let currentY = 0;
  if (showGroupInfo) {
    totalContentH += infoH;
    currentY += infoH + gapBetweenBoxes;
  }
  if (showSettings) {
    totalContentH += settingsH;
    if (showGroupInfo) currentY += gapBetweenBoxes;
    currentY += settingsH;
  }
  if (showDescription && hasDescription) {
    totalContentH += descH;
    if (showSettings || showGroupInfo) currentY += gapBetweenBoxes;
    currentY += descH;
  }
  const height = headerH + totalContentH + extraBottomPadding + (nameTotalLines - 1) * 40;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Xóa canvas và áp dụng nền gradient
  ctx.clearRect(0, 0, width, height);
  const backgroundGradient = ctx.createLinearGradient(0, 0, 0, height);
  backgroundGradient.addColorStop(0, "#000000");
  backgroundGradient.addColorStop(1, "#000000");
  ctx.fillStyle = backgroundGradient;
  ctx.fillRect(0, 0, width, height);

  // Vẽ icon nổi như background
  const icons = [
    "⭐", "⚡", "🔥", "💎", "✨", "🌙", "🎵",
    "🌟", "🎶", "❤️", "💖", "💫", "🌈", "☀️",
    "🌸", "🍀", "🌹", "🎇", "🎉", "🎁", "🪐"
  ];
  for (let i = 0; i < 30; i++) {
    const icon = icons[Math.floor(Math.random() * icons.length)];
    const fontSize = Math.floor(Math.random() * 50) + 30;
    ctx.font = `${fontSize}px Tahoma`;
    ctx.fillStyle = cv.getRandomGradient(ctx, width);
    ctx.globalAlpha = 0.4;
    ctx.shadowColor = "rgba(255,255,255,0.6)";
    ctx.shadowBlur = 12;
    ctx.fillText(icon, Math.random() * width, Math.random() * height);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  let xAvatar = padding * 2;
  let yAvatar = padding;
  if (groupInfo.avt && cv.isValidUrl(groupInfo.avt)) {
    try {
      const avatar = await loadImage(groupInfo.avt);
      const borderWidth = 6;
      const gradient = ctx.createLinearGradient(
        xAvatar,
        yAvatar,
        xAvatar + avatarSize + borderWidth,
        yAvatar + avatarSize + borderWidth
      );
      const rainbowColors = ["#3B82F6", "#60A5FA", "#93C5FD", "#A5B4FC", "#C4B5FD", "#A5B4FC", "#60A5FA"];
      rainbowColors.forEach((color, index) => {
        gradient.addColorStop(index / (rainbowColors.length - 1), color);
      });

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      ctx.beginPath();
      ctx.arc(xAvatar + avatarSize / 2, yAvatar + avatarSize / 2, avatarSize / 2 + borderWidth, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(xAvatar + avatarSize / 2, yAvatar + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatar, xAvatar, yAvatar, avatarSize, avatarSize);
      ctx.restore();
    } catch (error) {
      console.error("Lỗi load avatar:", error);
      ctx.fillStyle = "#666";
      ctx.beginPath();
      ctx.arc(xAvatar + avatarSize / 2, yAvatar + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.save();
  ctx.font = "bold 36px 'BeVietnamPro'";
  const nameGradient = ctx.createLinearGradient(0, yAvatar + 50, width, yAvatar + 50);
  nameGradient.addColorStop(0, "#00FFFF");
  nameGradient.addColorStop(1, "#FFFF00");
  ctx.fillStyle = nameGradient;
  ctx.textAlign = "left";
  const maxNameWidthAdjusted = width - (xAvatar + avatarSize + 20 + padding);
  const wrappedName = wrapText(ctx, `★ ${groupInfo.name || 'Unnamed Group'}`, maxNameWidthAdjusted);
  wrappedName.forEach((line, index) => {
    ctx.fillText(line, xAvatar + avatarSize + 20, yAvatar + 50 + (index * 40));
  });
  ctx.restore();

  ctx.font = "24px 'BeVietnamPro'";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(`Trưởng Nhóm: ${owner.name || 'N/A'}`, xAvatar + avatarSize + 20, yAvatar + 90 + (wrappedName.length - 1) * 40);

  const boxY = headerH + (wrappedName.length - 1) * 40;
  const leftX = padding;

  // Vẽ "Group Info" nếu bật
  let currentBoxY = boxY;
  if (showGroupInfo) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, leftX, currentBoxY, width - padding * 2, infoH, 12, true, false);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    roundRect(ctx, leftX, currentBoxY, width - padding * 2, infoH, 12, false, true);

    ctx.save();
    ctx.font = "bold 26px 'BeVietnamPro'";
    const infoGradient = ctx.createLinearGradient(0, currentBoxY, width, currentBoxY);
    infoGradient.addColorStop(0, "#00FFFF");
    infoGradient.addColorStop(1, "#FFFF00");
    ctx.fillStyle = infoGradient;
    ctx.textAlign = "center";
    ctx.fillText("Group Info", leftX + (width - padding * 2) / 2, currentBoxY + 30);
    ctx.restore();

    ctx.textAlign = "left";
    ctx.font = "20px 'BeVietnamPro'";
    let y = currentBoxY + 60;
    const adminCount = (groupInfo.adminIds || []).length + ((groupInfo.adminIds || []).includes(groupInfo.creatorId) ? 0 : 1);
    const groupType = groupInfo.groupType === 2 ? "Cộng Đồng" : "Nhóm";
    const infoFields = [
      `🆔 ID: ${groupInfo.groupId || 'N/A'}`,
      `👥 Thành viên: ${groupInfo.memberCount || 0}`,
      `📅 Ngày tạo: ${groupInfo.createdTime || 'N/A'}`,
      `🏷️ Loại: ${groupType}`,
      `👑 Quản trị: ${adminCount}`,
    ];
    infoFields.forEach((field) => {
      const fieldGradient = ctx.createLinearGradient(0, y, width, y);
      fieldGradient.addColorStop(0, "#FFFFFF");
      fieldGradient.addColorStop(1, "#FFFFFF");
      ctx.fillStyle = fieldGradient;
      ctx.fillText(field, leftX + 20, y);
      y += lineH;
    });
    currentBoxY += infoH + gapBetweenBoxes;
  }

  // Vẽ "Cài đặt nhóm" nếu bật
  if (showSettings) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, leftX, currentBoxY, width - padding * 2, settingsH, 12, true, false);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    roundRect(ctx, leftX, currentBoxY, width - padding * 2, settingsH, 12, false, true);

    ctx.save();
    ctx.font = "bold 26px 'BeVietnamPro'";
    const settingsGradient = ctx.createLinearGradient(0, currentBoxY, width, currentBoxY);
    settingsGradient.addColorStop(0, "#00FFFF");
    settingsGradient.addColorStop(1, "#FFFF00");
    ctx.fillStyle = settingsGradient;
    ctx.textAlign = "center";
    ctx.fillText("Cài đặt nhóm", leftX + (width - padding * 2) / 2, currentBoxY + 30);
    ctx.restore();

    ctx.textAlign = "left";
    ctx.font = "20px 'BeVietnamPro'";
    let y = currentBoxY + 60;
    settingsList.forEach((setting) => {
      const settingGradient = ctx.createLinearGradient(0, y, width, y);
      settingGradient.addColorStop(0, "#FFFFFF");
      settingGradient.addColorStop(1, "#FFFFFF");
      ctx.fillStyle = settingGradient;
      ctx.fillText(setting.label, leftX + 20, y);
      const val = groupInfo.setting ? groupInfo.setting[setting.key] || 0 : 0;
      const isEnabled = setting.inverted ? val === 0 : val === 1;
      ctx.fillStyle = isEnabled ? "#34D399" : "#EF4444";
      ctx.fillText(isEnabled ? "✓ Bật" : "✗ Tắt", leftX + 20 + ctx.measureText(setting.label).width + 10, y);
      y += lineH;
    });
    currentBoxY += settingsH + gapBetweenBoxes;
  }

  // Vẽ "Mô tả nhóm" nếu bật và có mô tả
  if (showDescription && hasDescription) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, leftX, currentBoxY, width - padding * 2, descH, 12, true, false);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    roundRect(ctx, leftX, currentBoxY, width - padding * 2, descH, 12, false, true);

    ctx.save();
    ctx.font = "bold 26px 'BeVietnamPro'";
    const descGradient = ctx.createLinearGradient(0, currentBoxY, width, currentBoxY);
    descGradient.addColorStop(0, "#00FFFF");
    descGradient.addColorStop(1, "#FFFF00");
    ctx.fillStyle = descGradient;
    ctx.textAlign = "center";
    ctx.fillText("Mô tả nhóm", leftX + (width - padding * 2) / 2, currentBoxY + 30);
    ctx.restore();

    ctx.textAlign = "left";
    ctx.font = "20px 'BeVietnamPro'";
    let y = currentBoxY + 60;
    bioLinesArray.forEach((line) => {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(line, leftX + 20, y);
      y += lineH;
    });
  }

  // Thêm đường viền hoặc đường kẻ để kiểm tra khoảng cách dưới cùng (tùy chọn)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.beginPath();
  ctx.moveTo(0, height - extraBottomPadding);
  ctx.lineTo(width, height - extraBottomPadding);
  ctx.stroke();

  const filePath = path.resolve(`./assets/temp/group_info_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", (err) => {
      console.error("Error writing PNG file:", err);
      reject(err);
    });
  });
}
function roundRect(ctx, x, y, w, h, r, fill = false, stroke = false) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}