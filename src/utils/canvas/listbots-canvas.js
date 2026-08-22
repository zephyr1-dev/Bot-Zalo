import { createCanvas, loadImage } from "canvas";
import fs from "fs/promises";
import path from "path";
import { createWriteStream } from "fs";

const CFG = {
  W: 900,
  M: 30,
  HEAD: 140,
  COL_HEAD: 60,
  PAD: 20,
  CARD: 120,
  GAP: 16,
  TEXT_LINE_HEIGHT: 22,
  MIN_HEIGHT: 400,
};

// Hàm định dạng ngày giờ
const formatDateTime = (date) => {
  if (!date || isNaN(date)) return "Không xác định";
  return date.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

// Hàm lấy avatar của người dùng đăng nhập từ Zalo API
async function getLoggedInUserAvatar(api, retries = 3) {
  const userId = process.env.ZALO_USER_ID;
  if (!userId) {

    return null;
  }


  for (let i = 0; i < retries; i++) {
    try {
      const response = await api.getUserInfo([userId]);
      const avatarUrl = response.unchanged_profiles?.[userId]?.avatar || response.changed_profiles?.[userId]?.avatar;
      if (!avatarUrl) {
        throw new Error("Không tìm thấy avatar trong response");
      }
      return avatarUrl;
    } catch (err) {
      console.warn(`Thử ${i + 1}/${retries} thất bại khi lấy avatar người dùng đăng nhập: ${err.message}`);
      if (i === retries - 1) {
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Hàm lấy avatar từ API
async function fetchBotAvatar(api, botId, retries = 3) {
  if (!botId) {
    return null;
  }

  for (let i = 0; i < retries; i++) {
    try {
      const response = await api.getUserInfo([botId]);
      const avatarUrl = response.unchanged_profiles?.[botId]?.avatar || response.changed_profiles?.[botId]?.avatar;
      if (!avatarUrl) {
        throw new Error("Không tìm thấy avatar trong response");
      }
      return avatarUrl;
    } catch (err) {
      if (i === retries - 1) {
        console.error("Hết số lần thử, không lấy được avatar bot");
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Hàm vẽ hình chữ nhật bo góc
const rr = (ctx, x, y, w, h, r = 16) => {
  r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
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
};

// Hàm vẽ văn bản
const txt = (ctx, s, x, y, opt = {}) => {
  const { align = "left", base = "alphabetic", fill = "#fff", font = "12px BeVietnamPro" } = opt;
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillText(s ?? "", x, y);
};

// Hàm cắt ngắn văn bản nếu quá dài
const ell = (ctx, s, maxW) => {
  if (!s) return "";
  if (ctx.measureText(s).width <= maxW) return s;
  const e = "…";
  while (s.length && ctx.measureText(s + e).width > maxW) s = s.slice(0, -1);
  return s + e;
};

// Hàm tải ảnh an toàn
const safeImg = async (src, api, botId) => {
  let avatarSrc = src;
  if (!avatarSrc && api && botId) {
    avatarSrc = await fetchBotAvatar(api, botId);
  }
  if (!avatarSrc && api) {
    avatarSrc = await getLoggedInUserAvatar(api);
  }
  if (!avatarSrc) {
    return null;
  }
  try {
    const img = await loadImage(avatarSrc);
    return img;
  } catch (err) {
    return null;
  }
};

// Chuẩn hóa danh sách bot
const normList = (list = []) => {
  if (!Array.isArray(list)) {
    console.warn("Danh sách bot không phải là mảng, trả về mảng rỗng");
    return [];
  }
  return list.map((bot, i) => ({
    id: bot.name ?? String(i + 1),
    name: bot.name ?? String(i + 1),
    displayName: bot.displayName ?? bot.name ?? `#${i + 1}`,
    status: bot.status ?? "unknown",
    createdBy: bot.createdBy ?? "Unknown",
    avatar: bot.avatar ?? null,
    createdAt: bot.createdAt ?? null,
    expiryAt: bot.expiryAt ?? null,
    description: typeof bot.description === "string" ? bot.description : null,
  }));
};

// Tính chiều cao cột
const colHeight = (n) =>
  n > 0
    ? CFG.COL_HEAD + CFG.PAD + n * CFG.CARD + (n - 1) * CFG.GAP + CFG.PAD
    : CFG.COL_HEAD + CFG.PAD + 140 + CFG.PAD;

// Hàm điều chỉnh độ sáng màu
const adjustBrightness = (hex, factor) => {
  hex = hex.replace("#", "");
  const r = Math.min(255, Math.round(parseInt(hex.slice(0, 2), 16) * factor));
  const g = Math.min(255, Math.round(parseInt(hex.slice(2, 4), 16) * factor));
  const b = Math.min(255, Math.round(parseInt(hex.slice(4, 6), 16) * factor));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

// Hàm tạo gradient ngẫu nhiên
const getRandomGradient = (ctx, width, height) => {
  const colors = [
    "rgba(94, 114, 228, 0.6)",
    "rgba(130, 94, 192, 0.6)",
    "rgba(255, 107, 107, 0.6)",
    "rgba(52, 211, 153, 0.6)",
    "rgba(236, 72, 153, 0.6)",
  ];
  const g = ctx.createLinearGradient(
    Math.random() * width,
    0,
    Math.random() * width,
    height
  );
  g.addColorStop(0, colors[Math.floor(Math.random() * colors.length)]);
  g.addColorStop(1, colors[Math.floor(Math.random() * colors.length)]);
  return g;
};

// Vẽ tiêu đề chính
const drawMainHeader = (ctx, W) => {
  const g = ctx.createLinearGradient(0, 0, 0, CFG.HEAD);
  g.addColorStop(0, "rgba(94, 114, 228, 1)");
  g.addColorStop(1, "rgba(130, 94, 192, 1)");
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 20;
  rr(ctx, 30, 30, W - 60, CFG.HEAD - 40, 24);
  ctx.fill();
  ctx.shadowBlur = 0;
  txt(ctx, "Danh Sách Bot Con", W / 2, 30 + (CFG.HEAD - 40) / 2 - 16, {
    align: "center",
    base: "middle",
    font: "bold 36px BeVietnamPro",
    fill: "#f8f8f8",
  });
  txt(ctx, "Bot Management System", W / 2, 30 + (CFG.HEAD - 40) / 2 + 20, {
    align: "center",
    base: "middle",
    font: "500 20px BeVietnamPro",
    fill: "rgba(255,255,255,0.9)",
  });
};

// Vẽ tiêu đề cột
const drawColHeader = (ctx, x, y, w, color, title) => {
  const g = ctx.createLinearGradient(x, y, x, y + CFG.COL_HEAD);
  g.addColorStop(0, color);
  g.addColorStop(1, adjustBrightness(color, 0.8));
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 10;
  ctx.fillRect(x, y, w, CFG.COL_HEAD);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x + 24, y + CFG.COL_HEAD / 2, 12, 0, Math.PI * 2);
  ctx.fill();
  txt(ctx, title, x + 50, y + CFG.COL_HEAD / 2, {
    base: "middle",
    font: "600 22px BeVietnamPro",
  });
};

// Vẽ khi cột trống
const drawEmpty = (ctx, x, y, w, h, msg) => {
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
  ctx.shadowBlur = 10;
  rr(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.shadowBlur = 0;
  txt(ctx, msg, x + w / 2, y + h / 2, {
    align: "center",
    base: "middle",
    font: "500 18px BeVietnamPro",
    fill: "rgba(255,255,255,0.7)",
  });
};

// Vẽ thẻ bot với thông tin chi tiết
const drawCard = (ctx, x, y, w, h, index, color, img, bot) => {
  const statusIcons = {
    running: "✅",
    stopped: "⏹️",
    trialExpired: "⏰",
    expired: "❌",
    stopping: "🔧",
    pending: "⌛",
    rejected: "🚫",
  };
  const statusIcon = statusIcons[bot.status] || "❓";
  const botName = bot.displayName || bot.name || "Không có tên";
  const createdAt = formatDateTime(new Date(bot.createdAt));
  const expiryAt = bot.expiryAt ? formatDateTime(new Date(bot.expiryAt)) : "Không xác định";

  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "rgba(255,255,255,0.08)");
  g.addColorStop(1, "rgba(255,255,255,0.12)");
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 12;
  rr(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.shadowBlur = 0;

  const move = 36,
    box = 38,
    numX = x + 12 + move,
    numY = y + (h - box) / 2;
  rr(ctx, numX, numY, box, box, 10);
  ctx.fillStyle = color;
  ctx.fill();
  txt(ctx, String(index + 1), numX + box / 2, numY + box / 2, {
    align: "center",
    base: "middle",
    font: "bold 20px BeVietnamPro",
  });

  const A = 70,
    ax = numX + box + 16,
    ay = y + (h - A) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax + A / 2, ay + A / 2, A / 2, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    ctx.drawImage(img, ax, ay, A, A);
  } else {
    ctx.fillStyle = "#4b5563";
    ctx.fillRect(ax, ay, A, A);
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ax + A / 2, ay + A / 2, A / 2, 0, Math.PI * 2);
  ctx.stroke();

  // Thêm thông tin chi tiết cạnh avatar
  const textX = ax + A + 10,
    maxW = w - (textX - x) - 48,
    textY = y + h / 2 - CFG.TEXT_LINE_HEIGHT * 2;
  ctx.font = "12px BeVietnamPro";
  ctx.fillStyle = "#f8f8f8";
  txt(ctx, `${index + 1}. 🤖 ${ell(ctx, botName, maxW)}`, textX, textY, { base: "middle" });
  txt(ctx, `🆔 Bot ID: ${ell(ctx, bot.name, maxW)}`, textX, textY + CFG.TEXT_LINE_HEIGHT, { base: "middle" });
  txt(ctx, `📅 Ngày tạo: ${ell(ctx, createdAt, maxW)}`, textX, textY + CFG.TEXT_LINE_HEIGHT * 2, { base: "middle" });
  txt(ctx, `⏰ Hết hạn: ${ell(ctx, expiryAt, maxW)}`, textX, textY + CFG.TEXT_LINE_HEIGHT * 3, { base: "middle" });
  txt(ctx, `📊 Trạng thái: ${statusIcon} ${ell(ctx, bot.status, maxW)}`, textX, textY + CFG.TEXT_LINE_HEIGHT * 4, { base: "middle" });

  ctx.fillStyle = "#10b981";
  ctx.beginPath();
  ctx.arc(x + w - 20, y + h / 2, 8, 0, Math.PI * 2);
  ctx.fill();
};

// Vẽ cột
const drawColumn = async (ctx, x, y, w, color, title, data, api) => {
  drawColHeader(ctx, x, y, w, color, title);
  const bodyY = y + CFG.COL_HEAD + CFG.PAD;
  if (!data.length) {
    drawEmpty(
      ctx,
      x + CFG.PAD,
      bodyY,
      w - CFG.PAD * 2,
      140,
      "Không có bot con nào được tạo"
    );
    return;
  }
  const imgs = await Promise.all(data.map((d) => safeImg(d.avatar, api, d.id)));
  let cy = bodyY;
  for (let i = 0; i < data.length; i++) {
    drawCard(
      ctx,
      x + CFG.PAD,
      cy,
      w - CFG.PAD * 2,
      CFG.CARD,
      i,
      color,
      imgs[i],
      data[i]
    );
    cy += CFG.CARD + CFG.GAP;
  }
};

// Hàm xuất canvas
export async function createBotListImage(bots, api) {
  try {
    const botList = normList(bots).slice(0, 50);
    const bodyH = colHeight(botList.length);
    const H = CFG.M + CFG.HEAD + 20 + bodyH + CFG.M;

    if (!Number.isFinite(H)) {

      throw new Error("Không thể tạo canvas với chiều cao không hợp lệ");
    }

    const canvas = createCanvas(CFG.W, H);
    const ctx = canvas.getContext("2d");

    // Vẽ nền gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "rgba(17, 24, 39, 0.9)");
    bg.addColorStop(1, "rgba(31, 41, 55, 0.95)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CFG.W, H);

    // Vẽ các icon nổi làm nền
    const icons = [
  "⭐", "⚡", "🔥", "💎", "✨", "🌙", "🎵", 
  "🌟", "🎶", "❤️", "💖", "💫", "🌈", "☀️", 
  "🌸", "🍀", "🌹", "🎇", "🎉", "🎁", "🪐"
];
    for (let i = 0; i < 30; i++) {
      const icon = icons[Math.floor(Math.random() * icons.length)];
      const fontSize = Math.floor(Math.random() * 50) + 30;
      ctx.font = `${fontSize}px Tahoma`;
      ctx.fillStyle = getRandomGradient(ctx, CFG.W, H);
      ctx.globalAlpha = 0.4;
      ctx.shadowColor = "rgba(255,255,255,0.6)";
      ctx.shadowBlur = 12;
      ctx.fillText(icon, Math.random() * CFG.W, Math.random() * H);
      ctx.globalAlpha = 1.0; // Đặt lại alpha
      ctx.shadowBlur = 0; // Đặt lại shadow
    }

    drawMainHeader(ctx, CFG.W);

    const colW = CFG.W - CFG.M * 2,
      Y = CFG.M + CFG.HEAD + 20,
      X = CFG.M;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    rr(ctx, X, Y, colW, bodyH, 20);
    ctx.fill();

    await drawColumn(ctx, X, Y, colW, "#3b82f6", "Danh Sách Bot Con", botList, api);

    const tempDir = path.resolve("./assets/temp");
    const filePath = path.join(tempDir, `bot_list_${Date.now()}.png`);

    try {
      await fs.mkdir(tempDir, { recursive: true });
   
      try {
        const buffer = canvas.toBuffer("image/png");
        await fs.writeFile(filePath, buffer);
      } catch (bufferError) {
    
        const stream = canvas.createPNGStream();
        const out = createWriteStream(filePath);
        stream.pipe(out);
        await new Promise((resolve, reject) => {
          out.on("finish", resolve);
          out.on("error", (err) => reject(new Error(`Stream save failed: ${err.message}`)));
        });
      }


      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error("File canvas không được tạo đúng cách");
      }
      return filePath;
    } catch (error) {
 
      throw new Error(`Không thể lưu file canvas: ${error.message}`);
    }
  } catch (error) {

    throw error;
  }
}