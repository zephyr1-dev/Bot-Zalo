import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import GIFEncoder from 'gifencoder';
import os from 'os';
import { sendMessageFactory } from '../../../api-zalo/apis/sendMessage.js';
import { MessageType } from '../../../api-zalo/models/Message.js';

export const des = {
  name: 'giftxt',
  type: 1,
  permission: 'all',
  countdown: 5,
  active: true,
  alias: ['giftxt'],
};

// ------------------- HIỆU ỨNG -------------------

// Tia sét
function drawLightning(ctx, width, height) {
  ctx.strokeStyle = 'rgba(173, 216, 230, 0.9)';
  ctx.shadowColor = 'rgba(248, 246, 124, 0.8)';
  ctx.shadowBlur = 15;
  ctx.lineWidth = 2.5;

  const startX = Math.random() * width;
  let x = startX;
  let y = 0;

  for (let i = 0; i < 2; i++) {
    ctx.globalAlpha = 0.6 + Math.random() * 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y);

    while (y < height) {
      x += (Math.random() - 0.5) * 50;
      y += Math.random() * 15 + 8;
      ctx.lineWidth = 2.5 - (y / height) * 1;
      ctx.lineTo(x, y);
      x = Math.max(0, Math.min(x, width));
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

// Trái tim
function drawHeart(ctx, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(0, -3, -3, -3, -3, 0);
  ctx.bezierCurveTo(-3, 3, 0, 5, 0, 7);
  ctx.bezierCurveTo(0, 5, 3, 3, 3, 0);
  ctx.bezierCurveTo(3, -3, 0, -3, 0, 0);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// Giọt nước
function drawRaindrop(ctx, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.bezierCurveTo(3, -2, 3, 2, 0, 5);
  ctx.bezierCurveTo(-3, 2, -3, -2, 0, -5);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// ------------------- COMMAND -------------------

export async function handleGiftext(api, message) {
  const threadId = message.threadId;
  const content = message.data.content.trim();
  const messageId = message.messageId;
  const sendMessage = sendMessageFactory(api);

  const parts = content.split(/\s+/);
  if (parts.length < 2) {
    return sendMessage({
      msg: `❌ Sai định dạng!\nDùng: /giftxt <chữ muốn tạo GIF>`,
      ttl: 60000,
      replyTo: messageId
    }, threadId, MessageType.GroupMessage);
  }

  const text = parts.slice(1).join(' ');
  const width = 350;
  const height = 80;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const encoder = new GIFEncoder(width, height);
  const gifPath = path.join(os.tmpdir(), `giftext_${Date.now()}.gif`);
  const stream = fs.createWriteStream(gifPath);

  encoder.createReadStream().pipe(stream);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(50);
  encoder.setQuality(10);

  // Matrix config
  const fontSize = 16;
  const columns = Math.floor(width / fontSize);
  const drops = Array(columns).fill(0);

  // Hearts config
  const hearts = Array.from({ length: 12 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: Math.random() * 0.4 + 0.2,
    speed: Math.random() * 2 + 1,
    color: `hsl(${Math.random() * 360}, 100%, 60%)`
  }));

  // Raindrops config
  const raindrops = Array.from({ length: 15 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: Math.random() * 0.3 + 0.2,
    speed: Math.random() * 3 + 2,
    color: 'rgba(135,206,250,0.8)'
  }));

  // Icons nền
  const icons = ["🔥", "❤️", "⚡", "✨", "🌈", "💎", "🌟"];
  const bgIcons = Array.from({ length: 10 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: Math.random() * 18 + 13,
    speed: Math.random() * 2 + 1,
    icon: icons[Math.floor(Math.random() * icons.length)],
    color: `hsl(${Math.random() * 360}, 100%, 60%)`
  }));

  // Text chính
  const mainFontSize = 28;
  ctx.font = `${mainFontSize}px sans-serif`;
  const textWidth = ctx.measureText(text).width;
  const totalFrames = Math.ceil((textWidth + width) / 4);

  for (let i = 0; i < totalFrames; i++) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // matrix
    ctx.font = `${fontSize}px monospace`;
    for (let x = 0; x < drops.length; x++) {
      const char = String.fromCharCode(0x30A0 + Math.random() * 96);
      const hue = (x * 20 + drops[x] * 10 + i * 5) % 360;
      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
      ctx.shadowBlur = 8;
      ctx.fillText(char, x * fontSize, drops[x] * fontSize);

      if (drops[x] * fontSize > height && Math.random() > 0.975) drops[x] = 0;
      drops[x]++;
    }

    // sét ngẫu nhiên
    if (Math.random() > 0.85) drawLightning(ctx, width, height);

    // mưa trái tim
    hearts.forEach(h => {
      drawHeart(ctx, h.x, h.y, h.size * 3, h.color);
      h.y += h.speed;
      if (h.y > height + 10) {
        h.y = -10;
        h.x = Math.random() * width;
        h.size = Math.random() * 0.4 + 0.2;
        h.color = `hsl(${Math.random() * 360}, 100%, 60%)`;
      }
    });

    // mưa giọt nước
    raindrops.forEach(r => {
      drawRaindrop(ctx, r.x, r.y, r.size * 3, r.color);
      r.y += r.speed;
      if (r.y > height + 10) {
        r.y = -10;
        r.x = Math.random() * width;
        r.size = Math.random() * 0.3 + 0.2;
      }
    });

    // icon nền
    bgIcons.forEach(ic => {
      ctx.font = `${ic.size}px sans-serif`;
      ctx.fillStyle = ic.color;
      ctx.shadowColor = ic.color;
      ctx.shadowBlur = 12;
      ctx.fillText(ic.icon, ic.x, ic.y);

      ic.y += ic.speed;
      if (ic.y > height + 20) {
        ic.y = -10;
        ic.x = Math.random() * width;
        ic.size = Math.random() * 20 + 15;
        ic.icon = icons[Math.floor(Math.random() * icons.length)];
        ic.color = `hsl(${Math.random() * 360}, 100%, 60%)`;
      }
    });
    ctx.shadowBlur = 0;

    // chữ chính 7 màu
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'red');
    gradient.addColorStop(0.16, 'orange');
    gradient.addColorStop(0.33, 'yellow');
    gradient.addColorStop(0.5, 'green');
    gradient.addColorStop(0.66, 'blue');
    gradient.addColorStop(0.83, 'indigo');
    gradient.addColorStop(1, 'violet');

    ctx.fillStyle = gradient;
    ctx.shadowColor = 'white';
    ctx.shadowBlur = 20;
    ctx.font = `${mainFontSize}px sans-serif`;
    ctx.fillText(text, width - i * 4, height / 2 + mainFontSize / 3);
    ctx.shadowBlur = 0;

    encoder.addFrame(ctx);
  }

  encoder.finish();

  stream.on('finish', () => {
    sendMessage({
      msg: '',
      attachments: [gifPath],
      ttl: 6000000,
      replyTo: messageId
    }, threadId, MessageType.GroupMessage)
      .then(() => {
        fs.unlink(gifPath, (err) => {
          if (err) console.error('Lỗi khi xóa file GIF:', err);
        });
      })
      .catch((err) => {
        console.error('Lỗi gửi GIF:', err);
        sendMessage({
          msg: `❌ Lỗi khi gửi ảnh GIF!`,
          ttl: 60000,
          replyTo: messageId,
        }, threadId, MessageType.GroupMessage);
      });
  });

  stream.on('error', (err) => {
    console.error('Lỗi tạo GIF:', err);
    sendMessage({
      msg: `❌ Lỗi khi tạo ảnh GIF!`,
      ttl: 60000,
      replyTo: messageId,
    }, threadId, MessageType.GroupMessage);
  });
}
