import fs from 'fs';
import path, { dirname } from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { sendMessageFactory } from '../../../api-zalo/apis/sendMessage.js';
import fetch from 'node-fetch';
import { getGlobalPrefix } from '../../../service-debug/service.js';
import { nameServer } from '../../../database/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const des = {
  name: 'ff',
  type: 1,
  permission: 'all',
  countdown: 5,
  active: true,
  aliases: ['freefire', 'thông tin freefire', 'ff info', 'xem ff', 'uid ff']
};

const getCleanNameServer = () => {
  const lines = nameServer
    .split('\n')
    .map(line => line.trim())
    .filter(line => line);

  const tagLine = lines.find(line => line.startsWith('@'));
  const boldLine = lines.find(line => /\*\*(.*?)\*\*/.test(line) || /__(.*?)__/.test(line));

  return [tagLine, boldLine].filter(Boolean).join(' ');
};

async function downloadImage(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Không thể tải ảnh outfit!');
  const buffer = await res.buffer();
  fs.writeFileSync(filePath, buffer);
}

export async function handleFfCommand(api, message) {
  const threadId = message.threadId;
  const uid = message.data.uidFrom;
  const sendMessage = sendMessageFactory(api);
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  let isGroup = threadId !== uid;
  if (typeof message.isGroup !== 'undefined') isGroup = message.isGroup;

  if (!content.startsWith(`${currentPrefix}ff`)) return false;

  const args = content.slice(currentPrefix.length + 2).trim().split(/\s+/);

  if (args.length !== 1) {
    return sendMessage(
      {
        msg: `${getCleanNameServer()}❌ Sai cú pháp! Dùng: ${currentPrefix}ff <uid>`,
        ttl: 60000
      },
      threadId,
      isGroup ? 1 : 0
    );
  }

  const ffUid = args[0];

  if (!/^\d+$/.test(ffUid)) {
    return sendMessage(
      {
        msg: `${getCleanNameServer()}❌ UID phải là số!`,
        ttl: 60000
      },
      threadId,
      isGroup ? 1 : 0
    );
  }

  const region = 'vn';
  const infoUrl = `https://zrojectx-info-free-fire.vercel.app/player-info-zprojectx?uid=${ffUid}&region=${region}`;
  const imageUrl = `https://jnl-outfit-v4.vercel.app/outfit-image?uid=${ffUid}&region=${region}&key=Dev-JNL`;

  try {
    const infoRes = await fetch(infoUrl);
    const infoJson = await infoRes.json();

    if (!infoRes.ok || !infoJson.basicInfo) {
      return sendMessage(
        {
          msg: `${getCleanNameServer()}❌ Không tìm thấy thông tin cho UID ${ffUid} khu vực ${region}.`,
          ttl: 60000
        },
        threadId,
        isGroup ? 1 : 0
      );
    }

    const basicInfo = infoJson.basicInfo || {};
    const petInfo = infoJson.petInfo || {};
    const socialInfo = infoJson.socialInfo || {};

    const name = basicInfo.nickname || 'Không rõ';
    const level = basicInfo.level || 'N/A';
    const exp = basicInfo.exp || 0;
    const likes = basicInfo.liked || 0;
    const rankPoints = basicInfo.rankingPoints || 0;
    const season = basicInfo.seasonId || 'N/A';
    const badge = basicInfo.badgeId || 'N/A';

    let gender = 'Không rõ';
    if (typeof socialInfo.gender === 'string') {
      if (socialInfo.gender.includes('MALE')) gender = 'Nam';
      if (socialInfo.gender.includes('FEMALE')) gender = 'Nữ';
    }

    const petName = petInfo.name || 'Không có';
    const petLevel = petInfo.level || 'N/A';
    const petSkin = petInfo.skinId || 'N/A';

    const msg =
`🎮 THÔNG TIN FREE FIRE

👤 Người Chơi:
➤ Tên: ${name}
➤ UID: ${ffUid}
➤ Khu vực: ${basicInfo.region || 'VN'}
➤ Level: ${level}
➤ EXP: ${exp}
➤ Lượt thích: ${likes}
➤ Điểm Rank: ${rankPoints}
➤ Season: ${season}
➤ Badge ID: ${badge}
➤ Giới tính: ${gender}
➤ Phiên bản: ${basicInfo.releaseVersion || 'N/A'}

🧸 Thú Cưng:
➤ Tên: ${petName}
➤ Level: ${petLevel}
➤ Skin: ${petSkin}

🛠️ Created by: HÀ HUY HOÀNG`;

    const tmpDir = path.join(os.tmpdir(), 'ff-outfit');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    const filePath = path.join(tmpDir, `ff_${ffUid}_${Date.now()}.png`);
    try {
      await downloadImage(imageUrl, filePath);

      await sendMessage(
        {
          attachments: [filePath],
          msg: `${getCleanNameServer()}${msg}`,
          ttl: 3600000
        },
        threadId,
        isGroup ? 1 : 0
      );
    } catch (e) {
      console.error('Lỗi tải ảnh:', e);
      await sendMessage(
        {
          msg: `${getCleanNameServer()}${msg}`,
          ttl: 3600000
        },
        threadId,
        isGroup ? 1 : 0
      );
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

  } catch (e) {
    console.error('Lỗi API FF:', e);
    return sendMessage(
      {
        msg: `${getCleanNameServer()}❌ Lỗi khi truy vấn API: ${e.message}`,
        ttl: 60000
      },
      threadId,
      isGroup ? 1 : 0
    );
  }
}