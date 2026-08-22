import { createCanvas, loadImage } from "canvas";
import fs from "fs/promises";
import path from "path";

const CFG = { W: 1100, M: 24, HEAD: 118, COL_HEAD: 54, PAD: 16, CARD: 76, GAP: 12 };

const rr = (ctx, x, y, w, h, r = 12) => {
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

const txt = (ctx, s, x, y, opt = {}) => {
  const { align = "left", base = "alphabetic", fill = "#fff", font = "16px Arial" } = opt;
  ctx.font = font; ctx.fillStyle = fill; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(s ?? "", x, y);
};

const ell = (ctx, s, maxW) => {
  if (!s) return "";
  if (ctx.measureText(s).width <= maxW) return s;
  const e = "…";
  while (s.length && ctx.measureText(s + e).width > maxW) s = s.slice(0, -1);
  return s + e;
};

const safeImg = async (src) => {
  if (!src) return null;
  try { return await loadImage(src); } catch { return null; }
};

const normList = (list = []) =>
  list.map((a, i) => ({
    id: a.id ?? String(i + 1),
    name: a.name ?? a.zaloName ?? `#${i + 1}`,
    role: a.role ?? "",
    avatar: a.avatar ?? a.photo ?? a.image ?? null,
  }));

const colHeight = (n) => n > 0
  ? CFG.COL_HEAD + CFG.PAD + n * CFG.CARD + (n - 1) * CFG.GAP + CFG.PAD
  : CFG.COL_HEAD + CFG.PAD + 120 + CFG.PAD;

const drawMainHeader = (ctx, W) => {
  const g = ctx.createLinearGradient(0, 0, 0, CFG.HEAD);
  g.addColorStop(0, "rgba(102,126,234,1)");
  g.addColorStop(1, "rgba(118,75,162,1)");
  ctx.fillStyle = g;
  rr(ctx, 24, 24, W - 48, CFG.HEAD - 36, 20); ctx.fill();
  txt(ctx, "Danh Sách Quản Trị Viên", W / 2, 24 + (CFG.HEAD - 36) / 2 - 12, { align: "center", base: "middle", font: "bold 34px Arial" });
  txt(ctx, "Bot Management System", W / 2, 24 + (CFG.HEAD - 36) / 2 + 16, { align: "center", base: "middle", font: "500 18px Arial", fill: "rgba(255,255,255,0.95)" });
};

const drawColHeader = (ctx, x, y, w, color, title) => {
  ctx.fillStyle = color; ctx.fillRect(x, y, w, CFG.COL_HEAD);
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x + 20, y + CFG.COL_HEAD / 2, 10, 0, Math.PI * 2); ctx.fill();
  txt(ctx, title, x + 46, y + CFG.COL_HEAD / 2, { base: "middle", font: "600 20px Arial" });
};

const drawEmpty = (ctx, x, y, w, h, msg) => {
  ctx.fillStyle = "rgba(255,255,255,0.04)"; rr(ctx, x, y, w, h, 12); ctx.fill();
  txt(ctx, msg, x + w / 2, y + h / 2, { align: "center", base: "middle", font: "500 16px Arial", fill: "rgba(255,255,255,0.8)" });
};

const drawCard = (ctx, x, y, w, h, i, color, img, name, role) => {
  rr(ctx, x, y, w, h, 12); ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fill();
  const move = 30, box = 32, numX = x + 10 + move, numY = y + (h - box) / 2;
  rr(ctx, numX, numY, box, box, 8); ctx.fillStyle = color; ctx.fill();
  txt(ctx, String(i + 1), numX + box / 2, numY + box / 2, { align: "center", base: "middle", font: "bold 18px Arial" });

  const A = 54, ax = numX + box + 14, ay = y + (h - A) / 2;
  ctx.save(); ctx.beginPath(); ctx.arc(ax + A / 2, ay + A / 2, A / 2, 0, Math.PI * 2); ctx.clip();
  if (img) ctx.drawImage(img, ax, ay, A, A); else { ctx.fillStyle = "#555"; ctx.fillRect(ax, ay, A, A); }
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ax + A / 2, ay + A / 2, A / 2, 0, Math.PI * 2); ctx.stroke();

  const textX = ax + A + 16, maxW = w - (textX - x) - 40;
  ctx.font = "bold 20px Arial"; ctx.fillStyle = "#fff";
  txt(ctx, ell(ctx, name, maxW), textX, y + h / 2 - 10, { base: "middle" });
  ctx.font = "16px Arial"; ctx.fillStyle = "#ccc";
  txt(ctx, ell(ctx, role, maxW), textX, y + h / 2 + 16, { base: "middle" });

  ctx.fillStyle = "#34d399"; ctx.beginPath(); ctx.arc(x + w - 16, y + h / 2, 6, 0, Math.PI * 2); ctx.fill();
};

// ——— PHÂN LOẠI: mặc định là QTV NHÓM; chỉ cho vào CẤP CAO khi role/flag cao cấp ———
const isHigh = (a) => {
  if (a?.isHighLevel === true) return true;
  const r = (a?.role || "").toLowerCase();
  return /(super|head|senior|lead|owner|founder|chief|director|cấp\s*cao|quản\s*trị\s*cấp\s*cao)/.test(r);
};

const drawColumn = async (ctx, x, y, w, color, title, data) => {
  drawColHeader(ctx, x, y, w, color, title);
  const bodyY = y + CFG.COL_HEAD + CFG.PAD;
  if (!data.length) {
    drawEmpty(ctx, x + CFG.PAD, bodyY, w - CFG.PAD * 2, 120,
      color === "#ef4444" ? "Đéo thể lấy thông tin Quản trị Cấp Cao của Bot" : "Đéo có quản trị viên nào được thiết lập cho nhóm này");
    return;
  }
  const imgs = await Promise.all(data.map(d => safeImg(d.avatar)));
  let cy = bodyY;
  for (let i = 0; i < data.length; i++) {
    drawCard(ctx, x + CFG.PAD, cy, w - CFG.PAD * 2, CFG.CARD, i, color, imgs[i], data[i].name, data[i].role);
    cy += CFG.CARD + CFG.GAP;
  }
};

export async function createAdminListImage(admins) {
  let left, right;

  if (Array.isArray(admins)) {
    const high = [], group = [];
    admins.forEach((a, i) => (isHigh(a) ? high : group).push(a));
    left = normList(high).slice(0, 50);     // QTV Cấp Cao
    right = normList(group).slice(0, 50);   // QTV Nhóm
  } else {
    left  = normList(admins?.highLevelAdmins || []).slice(0, 50);
    right = normList(admins?.groupAdmins     || []).slice(0, 50);
  }

  // TÍNH KHUNG VẼ (mỗi cột đánh số i+1 RIÊNG → đã đảm bảo từ 1)
  const bodyH = Math.max(colHeight(left.length), colHeight(right.length));
  const H = CFG.M + CFG.HEAD + 16 + bodyH + CFG.M;

  const canvas = createCanvas(CFG.W, H);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "rgba(0,0,0,0.82)");
  bg.addColorStop(1, "rgba(0,0,0,0.96)");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CFG.W, H);

  drawMainHeader(ctx, CFG.W);

  const gap = 18, colW = (CFG.W - CFG.M * 2 - gap) / 2, Y = CFG.M + CFG.HEAD + 16, X = CFG.M;
  ctx.fillStyle = "#ffffff0A"; rr(ctx, X, Y, colW, bodyH, 16); ctx.fill(); rr(ctx, X + colW + gap, Y, colW, bodyH, 16); ctx.fill();

  // CỘT TRÁI: QTV CẤP CAO | CỘT PHẢI: QTV NHÓM
  await drawColumn(ctx, X, Y, colW, "#ef4444", "Quản Trị Cấp Cao", left);
  await drawColumn(ctx, X + colW + gap, Y, colW, "#3b82f6", "Quản Trị Viên Nhóm", right);

  await fs.mkdir(path.resolve("./assets/temp"), { recursive: true });
  const filePath = path.resolve(`./assets/temp/admin_list_${Date.now()}.png`);
  await fs.writeFile(filePath, canvas.toBuffer("image/png"));
  return filePath;
}
