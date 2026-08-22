import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';
import fetch from 'node-fetch';
import { sendMessageFactory } from  '../../../api-zalo/apis/sendMessage.js';
import { getGlobalPrefix } from '../../../service-debug/service.js';
import { nameServer } from '../../../database/index.js';

const cacheDir = path.resolve('assets', 'resources', 'ghepDoi');
const bgPath = path.resolve(cacheDir, 'ghepdoi.jpg');
const weddingPath = path.resolve(cacheDir, 'giaykethon.jpg');
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

export const des = {
  name: 'ghepdoi',
  type: 1,
  permission: 'all',
  countdown: 10,
  active: true,
};

// Hàm ghép dòng tag + tên server
const getCleanNameServer = () => {
  const lines = nameServer
    .split('\n')
    .map(line => line.trim())
    .filter(line => line);

  const tagLine = lines.find(line => line.startsWith('@'));
  const boldLine = lines.find(line => /\*\*(.*?)\*\*/.test(line) || /__(.*?)__/.test(line));

  return [tagLine, boldLine].filter(Boolean).join(' ');
};

// Hàm tải ảnh về máy
async function downloadImage(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Không thể tải ảnh!');
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
}

// Hàm resize và cắt ảnh thành hình tròn
async function resizeAndCropCircle(image, size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, 0, 0, size, size);
  return canvas;
}

// Hàm ghép ảnh avatar
async function combineAvatars(avatarPaths, outputPath) {
  if (!fs.existsSync(bgPath)) {
    throw new Error('Tệp nền ghepdoi.jpg không tồn tại trong thư mục Data/Cache/GhepDoi.');
  }
  const images = await Promise.all(avatarPaths.map(p => loadImage(p)));
  const resized = await Promise.all(images.map(img => resizeAndCropCircle(img, 50)));
  const canvas = createCanvas(500, 500);
  const ctx = canvas.getContext('2d');
  const bg = await loadImage(bgPath);
  ctx.drawImage(bg, 0, 0, 500, 500);
  ctx.drawImage(resized[0], 175, 150);
  ctx.drawImage(resized[1], 315, 80);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
}

// Hàm điền thông tin vào giấy kết hôn
async function fillWeddingCertificate(profile1, profile2) {
  if (!fs.existsSync(weddingPath)) {
    throw new Error('Tệp giaykethon.jpg không tồn tại trong thư mục Data/Cache/GhepDoi.');
  }
  const outputPath = path.resolve(cacheDir, `giaykethon_filled_${Date.now()}.jpg`);
  const canvas = createCanvas(640, 525);
  const ctx = canvas.getContext('2d');
  const img = await loadImage(weddingPath);
  ctx.drawImage(img, 0, 0, 640, 525);

  ctx.font = '14px Arial';
  ctx.fillStyle = 'black';

  const name1 = profile1.displayName || profile1.zaloName || profile1.username || 'Zalo';
  const name2 = profile2.displayName || profile2.zaloName || profile2.username || 'Zalo';

  ctx.fillText(name1, 190, 190); // Họ và tên chồng
  ctx.fillText('30/11/2000', 190, 210); // Ngày, tháng, năm sinh chồng
  ctx.fillText('Kinh', 130, 230); // Dân tộc chồng
  ctx.fillText('Việt Nam', 230, 225); // Quốc tịch chồng
  ctx.fillText('Zalo', 190, 245); // Nơi thường trú/tạm trú chồng
  ctx.fillText('88888888', 190, 285); // Số Giấy CMND/Hộ chiếu chồng
  ctx.fillText(name1, 190, 350); // Chữ ký của chồng

  ctx.fillText(name2, 470, 190); // Họ và tên vợ
  ctx.fillText('30/11/2000', 470, 210); // Ngày, tháng, năm sinh vợ
  ctx.fillText('Kinh', 400, 230); // Dân tộc vợ
  ctx.fillText('Việt Nam', 520, 225); // Quốc tịch vợ
  ctx.fillText('Zalo', 470, 245); // Nơi thường trú/tạm trú vợ
  ctx.fillText('88888888', 470, 285); // Số Giấy CMND/Hộ chiếu vợ
  ctx.fillText(name2, 460, 350); // Chữ ký của vợ

  const today = new Date();
  ctx.fillText(today.getDate().toString().padStart(2, '0'), 430, 395); // Ngày đăng ký
  ctx.fillText((today.getMonth() + 1).toString().padStart(2, '0'), 490, 395); // Tháng đăng ký
  ctx.fillText(today.getFullYear().toString(), 540, 395); // Năm đăng ký

  ctx.fillText('Aimi', 150, 490); // Cán bộ Tư pháp hộ tịch
  ctx.fillText('Bui Quang Dung', 450, 490); // Chủ tịch

  const buffer = canvas.toBuffer('image/jpeg');
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

// Hàm trả về thông điệp tình yêu dựa trên tỷ lệ
function getLoveMessage(percent) {
  if (percent >= 90) return 'Hai bạn là cặp đôi hoàn hảo, định mệnh sắp gọi tên!';
  if (percent >= 80) return 'Tình yêu này đẹp như mơ, hãy nắm lấy nhé!';
  if (percent >= 70) return 'Có sự kết nối mạnh mẽ, hãy thử tìm hiểu nhau!';
  if (percent >= 60) return 'Một chút duyên, một chút nợ – đủ để bắt đầu!';
  if (percent >= 50) return 'Có thể chỉ là một cái duyên nhỏ, nhưng biết đâu đó là khởi đầu?';
  if (percent >= 40) return 'Tình yêu cần thời gian, hãy cho nhau cơ hội!';
  if (percent >= 30) return 'Chưa chắc hợp, nhưng biết đâu bất ngờ!';
  if (percent >= 20) return 'Còn xa vời, nhưng không gì là không thể!';
  if (percent >= 10) return 'Tình duyên mong manh như sương sớm!';
  return 'Có lẽ bạn nên thử... người khác 😅';
}

export async function handleGhepdoiCommand(api, message) {
  const threadId = message.threadId;
  const uid = message.data.uidFrom;
  const sendMessage = sendMessageFactory(api);
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();
  const mentions = message.data.mentions || [];

  let isGroup = threadId !== uid;
  if (typeof message.isGroup !== 'undefined') isGroup = message.isGroup;

  if (!content.startsWith(`${currentPrefix}ghepdoi`)) {
    return sendMessage(
      {
        msg: `${getCleanNameServer()}❌ Lệnh không hợp lệ! Dùng: ${currentPrefix}ghepdoi <@tag> 🚨`,
        ttl: 60000
      },
      threadId,
      isGroup ? 1 : 0
    );
  }

  const args = content.slice(currentPrefix.length + 7).trim().split(/\s+/);
  let user1Uid = uid;
  let user2Uid;

  try {
    if (mentions.length === 0) {
      return sendMessage(
        {
          msg: `${getCleanNameServer()}❌ Vui lòng @tag một người để ghép đôi. Ví dụ: ${currentPrefix}ghepdoi @nguoi_khac`,
          ttl: 60000
        },
        threadId,
        isGroup ? 1 : 0
      );
    }

    user2Uid = mentions[0].uid;
    if (user2Uid === user1Uid) {
      return sendMessage(
        {
          msg: `${getCleanNameServer()}❌ Không thể ghép đôi với chính mình! Hãy @tag một người khác.`,
          ttl: 60000
        },
        threadId,
        isGroup ? 1 : 0
      );
    }

    const info = await api.getUserInfo([user1Uid, user2Uid]);
    const changedProfiles = info.changed_profiles || {};
    let profile1 = null, profile2 = null;
    for (const [key, value] of Object.entries(changedProfiles)) {
      const uid = key.split('_')[0];
      if (uid === user1Uid) profile1 = value;
      if (uid === user2Uid) profile2 = value;
    }

    if (!profile1 || !profile2) {
      return sendMessage(
        {
          msg: `${getCleanNameServer()}❌ Không thể lấy thông tin người dùng.`,
          ttl: 60000
        },
        threadId,
        isGroup ? 1 : 0
      );
    }

    const avatar1Path = path.join(cacheDir, `${user1Uid}_avatar.png`);
    const avatar2Path = path.join(cacheDir, `${user2Uid}_avatar.png`);
    await Promise.all([
      downloadImage(profile1.avatar, avatar1Path),
      downloadImage(profile2.avatar, avatar2Path)
    ]);

    const resultPath = path.join(cacheDir, `result_${Date.now()}.png`);
    await combineAvatars([avatar1Path, avatar2Path], resultPath);

    const compatibility = Math.floor(Math.random() * 101);
    const messageText = getLoveMessage(compatibility);
    const name1 = profile1.displayName || profile1.zaloName || profile1.username || 'Bạn';
    const name2 = profile2.displayName || profile2.zaloName || profile2.username || 'Người ấy';

    await sendMessage(
      {
        msg: `${getCleanNameServer()}💞 Tỉ lệ tình duyên giữa ${name1} và ${name2} là: ${compatibility}%\n📝 ${messageText}`,
        mentions: [
          { tag: name1, uid: user1Uid },
          { tag: name2, uid: user2Uid }
        ],
        attachments: [resultPath],
        ttl: 3600000
      },
      threadId,
      isGroup ? 1 : 0
    );

    if (compatibility > 50) {
      try {
        const filledWeddingPath = await fillWeddingCertificate(profile1, profile2);
        await sendMessage(
          {
            msg: `${getCleanNameServer()}🎉 Đây là giấy kết hôn của ${name1} và ${name2}!`,
            attachments: [filledWeddingPath],
            ttl: 3600000
          },
          threadId,
          isGroup ? 1 : 0
        );
        await fsp.unlink(filledWeddingPath).catch(() => {});
      } catch (err) {
        console.error('❌ Ghepdoi Wedding Error:', err);
        await sendMessage(
          {
            msg: `${getCleanNameServer()}🎉 Chúc mừng! ${name1} và ${name2} có tỉ lệ tình duyên cao (${compatibility}%)! Có thể sẽ có kết quả tốt đẹp trong tương lai! 💕`,
            ttl: 3600000
          },
          threadId,
          isGroup ? 1 : 0
        );
      }
    } else {
      await sendMessage(
        {
          msg: `${getCleanNameServer()}💔 ${name1} và ${name2} có tỉ lệ tình duyên thấp (${compatibility}%). Nhưng đừng buồn, tình yêu đích thực không phụ thuộc vào con số! Hãy cố gắng và tin tưởng vào tình cảm của mình! 💪❤️`,
          ttl: 3600000
        },
        threadId,
        isGroup ? 1 : 0
      );
    }

    await Promise.all([
      fsp.unlink(avatar1Path).catch(() => {}),
      fsp.unlink(avatar2Path).catch(() => {}),
      fsp.unlink(resultPath).catch(() => {})
    ]);

  } catch (err) {
    console.error('❌ Ghepdoi Error:', err);
    await sendMessage(
      {
        msg: `${getCleanNameServer()}❌ Lỗi: ${err.message}`,
        ttl: 60000
      },
      threadId,
      isGroup ? 1 : 0
    );
  }
}