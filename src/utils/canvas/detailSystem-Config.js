import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";
import * as cv from "./index.js";
import os from "os";
import fsPromises from "fs/promises";
import { networkInterfaces } from "os";
import si from "systeminformation";
import disk from "diskusage";

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

function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  seconds %= 24 * 60 * 60;
  const hours = Math.floor(seconds / (60 * 60));
  seconds %= 60 * 60;
  const minutes = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days} ngày`);
  if (hours > 0) parts.push(`${hours} giờ`);
  if (minutes > 0) parts.push(`${minutes} phút`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} giây`);
  
  return parts.join(", ");
}

// Windows-compatible functions for system metrics
async function getWindowsVersion() {
  try {
    const osInfo = await si.osInfo();
    return `${osInfo.distro} ${osInfo.release}`; // e.g., "Microsoft Windows 10 Pro 10.0.19045"
  } catch {
    return os.release(); // Fallback to basic version info
  }
}

async function getCpuTemp() {
  try {
    const temps = await si.cpuTemperature();
    return temps.main ? `${temps.main.toFixed(1)}°C` : "N/A";
  } catch {
    return "N/A"; // CPU temp may require external tools on Windows
  }
}

async function getDiskUsage() {
  try {
    const path = os.platform() === "win32" ? "C:" : "/";
    const diskData = await disk.check(path);
    return `${((diskData.total - diskData.available) / (1024 * 1024 * 1024)).toFixed(1)} GB / ${(diskData.total / (1024 * 1024 * 1024)).toFixed(1)} GB (Free ${(diskData.available / (1024 * 1024 * 1024)).toFixed(1)} GB)`;
  } catch {
    return "N/A";
  }
}

async function getDiskTotal() {
  try {
    const disks = await si.fsSize();
    const mainDisk = disks.find(d => d.mount === "C:" || d.mount === "/") || disks[0];
    return mainDisk ? `${(mainDisk.size / (1024 * 1024 * 1024)).toFixed(1)} GB` : "N/A";
  } catch {
    return "N/A";
  }
}

async function getNetworkUsage() {
  try {
    if (os.platform() === "win32") {
      const stats = await si.networkStats();
      const totalRx = stats.reduce((sum, iface) => sum + iface.rx_bytes, 0) / (1024 * 1024); // MB
      const totalTx = stats.reduce((sum, iface) => sum + iface.tx_bytes, 0) / (1024 * 1024); // MB
      return `Rx: ${totalRx.toFixed(2)} MB, Tx: ${totalTx.toFixed(2)} MB`;
    } else {
      const data = await fsPromises.readFile("/proc/net/dev", "utf8");
      const lines = data.split("\n").slice(2);
      let rxBytes = 0;
      let txBytes = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("lo:")) continue;
        const parts = trimmed.split(/\s+/);
        if (parts.length < 10) continue;
        rxBytes += parseInt(parts[1], 10);
        txBytes += parseInt(parts[9], 10);
      }
      const rxMB = (rxBytes / (1024 * 1024)).toFixed(2);
      const txMB = (txBytes / (1024 * 1024)).toFixed(2);
      return `Rx: ${rxMB} MB, Tx: ${txMB} MB`;
    }
  } catch {
    return "N/A";
  }
}

async function getLoadAverage() {
  try {
    if (os.platform() === "win32") {
      const load = await si.currentLoad();
      return load.currentLoad.toFixed(2); 
    } else {
      return os.loadavg().map(l => l.toFixed(2)).join(", ");
    }
  } catch {
    return "N/A";
  }
}

async function getRunningProcesses() {
  try {
    const processes = await si.processes();
    return processes.all.toString();
  } catch {
    if (os.platform() !== "win32") {
      try {
        return (await fsPromises.readdir("/proc")).filter(dir => /^\d+$/.test(dir)).length.toString();
      } catch {
        return "N/A";
      }
    }
    return "N/A";
  }
}

async function getTerminal() {
  try {
    if (os.platform() === "win32") {
      return process.env.ComSpec || "cmd.exe"; 
    } else {
      return process.env.SHELL || "Unknown";
    }
  } catch {
    return "N/A";
  }
}

export async function createBotInfoImage(botInfo, uptime, botStats, onConfigs, offConfigs) {
  let width = 1400;
  let height = 0;

  // Fetch system metrics
  const loadAverage = await getLoadAverage();
  const runningProcesses = await getRunningProcesses();
  const kernelVersion = os.release();
  const hostname = os.hostname();
  const terminal = await getTerminal();

  const interfaces = networkInterfaces();
  let ipv4 = "Unknown";
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    const addr = iface.find(a => a.family === "IPv4" && !a.internal);
    if (addr) {
      ipv4 = addr.address;
      break;
    }
  }

  const osVersion = await getWindowsVersion();
  const totalMemory = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  const freeMemory = (os.freemem() / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  const diskTotal = await getDiskTotal();
  const networkUsage = await getNetworkUsage();

  const systemFields = [
    { label: "🔢 Phiên bản:", value: botStats.version || "Unknown" },
    { label: "💾 Bộ nhớ bot:", value: botStats.memoryUsage || "Unknown" },
    { label: "💻 Hệ điều hành:", value: botStats.os || os.type() },
    { label: "📀 OS Version:", value: osVersion },
    { label: "🖥️ CPU Model:", value: botStats.cpuModel || os.cpus()[0]?.model || "Unknown" },
    { label: "🔢 CPU Count:", value: os.cpus().length.toString() },
    { label: "⚡ CPU Usage:", value: botStats.cpu || (await si.currentLoad()).currentLoad.toFixed(1) + "%" },
    { label: "🔢 Up Time OS:", value: botStats.uptimeOS || formatUptime(os.uptime()) },
    { label: "💿 Total Memory:", value: totalMemory },
  ];

  const resourceFields = [
    { label: "🌡️ CPU Temp:", value: botStats.cpuTemp || "36°C" || (await getCpuTemp()) },
    { label: "📈 RAM Usage:", value: botStats.ram || `${((os.totalmem() - os.freemem()) / (1024 * 1024 * 1024)).toFixed(2)} GB / ${(os.totalmem() / (1024 * 1024 * 1024)).toFixed(2)} GB` },
    { label: "💿 Free Memory:", value: freeMemory },
    { label: "💽 Disk Usage:", value: botStats.disk || (await getDiskUsage()) },
    { label: "💽 Disk Total:", value: diskTotal },
    { label: "🌐 Network:", value: botStats.network || networkUsage },
    { label: "📊 Load Average:", value: loadAverage },
  ];

  const networkFields = [
    { label: "🔄 Processes:", value: runningProcesses },
    { label: "🏠 Hostname:", value: hostname },
    { label: "🛠️ Kernel:", value: kernelVersion },
    { label: "🖴 Terminal:", value: terminal }
  ];

  const tempCanvas = createCanvas(1, 1);
  const tempCtx = tempCanvas.getContext("2d");

  let maxLeftWidth = 0;
  [systemFields, resourceFields, networkFields].forEach(fields => {
    fields.forEach(f => {
      const textWidth = measureTextWidth(tempCtx, `${f.label} ${f.value}`, "bold 28px BeVietnamPro");
      maxLeftWidth = Math.max(maxLeftWidth, textWidth);
    });
  });

  const leftColumnWidth = Math.max(500, maxLeftWidth + 120);

  let maxConfigWidth = 0;
  let configItemsForMeasure = onConfigs.length > 0 && offConfigs.length > 0 ? [...onConfigs, ...offConfigs] : onConfigs.length > 0 ? onConfigs : offConfigs;
  configItemsForMeasure.forEach(line => {
    const textWidth = measureTextWidth(tempCtx, `${line}: ✅`, "bold 22px BeVietnamPro");
    maxConfigWidth = Math.max(maxConfigWidth, textWidth);
  });

  const rightColumnWidth = onConfigs.length > 0 && offConfigs.length > 0 ? Math.max(650, maxConfigWidth * 2 + 180) : Math.max(450, maxConfigWidth + 120);
  width = leftColumnWidth + rightColumnWidth + 120;

  const headerH = 220;
  const headerY = 30;
  const sysBoxHeight = systemFields.length * 50 + 100;
  const resBoxHeight = resourceFields.length * 50 + 100;
  const netBoxHeight = networkFields.length * 50 + 100;

  const maxConfigItems = onConfigs.length > 0 && offConfigs.length > 0 ? Math.max(onConfigs.length, offConfigs.length) : onConfigs.length > 0 ? onConfigs.length : offConfigs.length;
  const cfgBoxHeight = onConfigs.length > 0 && offConfigs.length > 0 ? maxConfigItems * 40 + 130 : maxConfigItems * 55 + 140;

  const leftColumnHeight = sysBoxHeight + resBoxHeight + netBoxHeight + 90;
  const rightColumnHeight = cfgBoxHeight + 60;
  height = Math.max(headerY + headerH + 30 + leftColumnHeight, headerY + headerH + 30 + rightColumnHeight) + 90;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (botInfo && cv.isValidUrl(botInfo.avatar)) {
    try {
      const avatar = await loadImage(botInfo.avatar);
      ctx.globalAlpha = 0.7;
      ctx.drawImage(avatar, 0, 0, width, height);
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, width, height);
    } catch {
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#0F2027");
      bg.addColorStop(0.5, "#203A43");
      bg.addColorStop(1, "#2C5364");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0F2027");
    bg.addColorStop(0.5, "#203A43");
    bg.addColorStop(1, "#2C5364");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }

  const metallicGradient = ctx.createLinearGradient(0, 0, width, height);
  metallicGradient.addColorStop(0, "rgba(255,255,255,0.05)");
  metallicGradient.addColorStop(0.5, "rgba(255,255,255,0.1)");
  metallicGradient.addColorStop(1, "rgba(255,255,255,0.05)");
  ctx.fillStyle = metallicGradient;
  ctx.fillRect(0, 0, width, height);

  drawBox(ctx, 60, headerY, width - 120, headerH, "Bot Overview");

  if (botInfo && cv.isValidUrl(botInfo.avatar)) {
    try {
      const avatar = await loadImage(botInfo.avatar);
      const size = 140;
      const cx = 150;
      const cy = headerY + headerH / 2;
      const grad = ctx.createLinearGradient(cx - size/2, cy - size/2, cx + size/2, cy + size/2);
      grad.addColorStop(0, "#4ECB71");
      grad.addColorStop(1, "#1E90FF");
      ctx.beginPath();
      ctx.arc(cx, cy, size/2 + 8, 0, Math.PI*2);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, size/2, 0, Math.PI*2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, cx - size/2, cy - size/2, size, size);
      ctx.restore();
    } catch {}
  }

  ctx.textAlign = "left";
  ctx.fillStyle = cv.getRandomGradient ? cv.getRandomGradient(ctx, leftColumnWidth) : "#ffffff";
  ctx.font = "bold 48px BeVietnamPro";
  ctx.fillText(botInfo.name, 300, headerY + 100);
  ctx.font = "bold 28px BeVietnamPro";
  ctx.fillText("Developer: </>Hà Huy Hoàng", 300, headerY + 140);
  ctx.fillStyle = cv.getRandomGradient ? cv.getRandomGradient(ctx, leftColumnWidth) : "#ffffff";
  ctx.fillText("Thời gian hoạt động: " + uptime, 300, headerY + 180);

  const leftColumnX = 60;

  const sysBoxY = headerY + headerH + 30;
  drawBox(ctx, leftColumnX, sysBoxY, leftColumnWidth, sysBoxHeight, "System Info");
  let ySys = sysBoxY + 100;
  const lineHeight = 50;
  systemFields.forEach(f => {
    ctx.textAlign = "left";
    ctx.fillStyle = cv.getRandomGradient ? cv.getRandomGradient(ctx, leftColumnWidth) : "#ffffff";
    ctx.font = "bold 28px BeVietnamPro";
    ctx.fillText(f.label, leftColumnX + 40, ySys);
    ctx.textAlign = "right";
    ctx.fillText(f.value, leftColumnX + leftColumnWidth - 40, ySys);
    ySys += lineHeight;
  });

  const resBoxY = sysBoxY + sysBoxHeight + 30;
  drawBox(ctx, leftColumnX, resBoxY, leftColumnWidth, resBoxHeight, "Resource Usage");
  let yRes = resBoxY + 60;
  resourceFields.forEach(f => {
    ctx.textAlign = "left";
    ctx.font = "bold 28px BeVietnamPro";
    ctx.fillStyle = cv.getRandomGradient ? cv.getRandomGradient(ctx, leftColumnWidth) : "#ffffff";
    ctx.fillText(f.label, leftColumnX + 40, yRes);
    ctx.textAlign = "right";
    ctx.fillText(f.value, leftColumnX + leftColumnWidth - 40, yRes);
    let percent = null;
    if (f.label.includes("CPU") && f.value.includes("%")) {
      percent = parseFloat(f.value.replace("%", "").trim());
    } else if (f.label.includes("RAM") && f.value.match(/(\d+(\.\d+)?)/g)) {
      const nums = f.value.match(/(\d+(\.\d+)?)/g).map(Number);
      if (nums.length >= 2) percent = (nums[0] / nums[1]) * 100;
    } else if (f.label.includes("Disk") && f.value.match(/(\d+(\.\d+)?)/g)) {
      const nums = f.value.match(/(\d+(\.\d+)?)/g).map(Number);
      if (nums.length >= 2) percent = (nums[0] / nums[1]) * 100;
    }

    if (percent !== null && !isNaN(percent)) {
      const barX = leftColumnX + 40;
      const barY = yRes + 10;
      const barW = leftColumnWidth - 80;
      const barH = 16;
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(barX, barY, barW, barH);
      const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
      grad.addColorStop(0, "#4ECB71");
      grad.addColorStop(1, "#1E90FF");
      ctx.fillStyle = grad;
      ctx.fillRect(barX, barY, (percent / 100) * barW, barH);

      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barW, barH);

      yRes += 30;
    }

    yRes += lineHeight;
  });

  const netBoxY = resBoxY + resBoxHeight + 30;
  drawBox(ctx, leftColumnX, netBoxY, leftColumnWidth, netBoxHeight, "Network Info");
  let yNet = netBoxY + 100;
  networkFields.forEach(f => {
    ctx.textAlign = "left";
    ctx.fillStyle = cv.getRandomGradient ? cv.getRandomGradient(ctx, leftColumnWidth) : "#ffffff";
    ctx.font = "bold 28px BeVietnamPro";
    ctx.fillText(f.label, leftColumnX + 40, yNet);
    ctx.textAlign = "right";
    ctx.fillText(f.value, leftColumnX + leftColumnWidth - 40, yNet);
    yNet += lineHeight;
  });

  const rightColumnX = leftColumnX + leftColumnWidth + 30;
  const configY = sysBoxY;
  if (onConfigs.length > 0 || offConfigs.length > 0) {
    drawBox(ctx, rightColumnX, configY, rightColumnWidth, cfgBoxHeight, "Group Configs");

    const leftColX = rightColumnX + 40;
    const rightColX = rightColumnX + rightColumnWidth / 2 + 40;
    if (onConfigs.length > 0 && offConfigs.length > 0) {
      const dividerX = rightColumnX + rightColumnWidth / 2;
      drawVerticalDivider(ctx, dividerX, configY, cfgBoxHeight);
    }

    let yOff = configY + 80;
    if (offConfigs.length > 0) {
      ctx.fillStyle = "#FF6B6B";
      ctx.font = onConfigs.length === 0 ? "bold 30px BeVietnamPro" : "bold 26px BeVietnamPro";
      ctx.textAlign = "left";
      ctx.fillText("Đang tắt:", leftColX, yOff);
      yOff += 40;
      ctx.font = onConfigs.length === 0 ? "bold 26px BeVietnamPro" : "bold 22px BeVietnamPro";
      offConfigs.forEach(line => {
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`${line}`, leftColX, yOff);
        yOff += 40;
      });
    }

    let yOn = configY + 80;
    if (onConfigs.length > 0) {
      ctx.fillStyle = "#4ECB71";
      ctx.font = "bold 26px BeVietnamPro";
      ctx.textAlign = "left";
      const titleX = offConfigs.length === 0 ? rightColumnX + rightColumnWidth / 2 : rightColX;
      ctx.fillText("Đang bật:", titleX, yOn);
      yOn += 40;
      ctx.font = "bold 22px BeVietnamPro";
      onConfigs.forEach(line => {
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`${line}`, titleX, yOn);
        yOn += 40;
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

export async function clearImagePath(pathFile) {
  try {
    await fsPromises.unlink(pathFile);
  } catch (error) {
    console.error("Error deleting file:", error);
  }
}