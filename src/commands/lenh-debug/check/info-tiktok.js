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
  name: 'i4tiktok',
  type: 1,
  permission: 'all',
  countdown: 5,
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

// Hàm tải avatar về máy
async function downloadImage(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Không thể tải ảnh avatar!');
  const buffer = await res.buffer();
  fs.writeFileSync(filePath, buffer);
}

export async function handleI4tiktokCommand(api, message) {
  const threadId = message.threadId;
  const uid = message.data.uidFrom;
  const sendMessage = sendMessageFactory(api);
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  let isGroup = threadId !== uid;
  if (typeof message.isGroup !== 'undefined') isGroup = message.isGroup;

  if (!content.startsWith(`${currentPrefix}i4tiktok`)) {
    return sendMessage(
      {
        msg: `${getCleanNameServer()}❌ Lệnh không hợp lệ! Dùng: ${currentPrefix}i4tiktok <username> 🚨`,
        ttl: 60000
      },
      threadId,
      isGroup ? 1 : 0
    );
  }

  const args = content.slice(currentPrefix.length + 8).trim().split(/\s+/);
  if (args.length < 1) {
    return sendMessage(
      {
        msg: `${getCleanNameServer()}❌ Thiếu username! Dùng: ${currentPrefix}i4tiktok <username>`,
        ttl: 60000
      },
      threadId,
      isGroup ? 1 : 0
    );
  }

  const tikTokUsername = args[0];
  if (!/^[a-zA-Z0-9._]+$/.test(tikTokUsername)) {
    return sendMessage(
      {
        msg: `${getCleanNameServer()}❌ Username TikTok không hợp lệ!`,
        ttl: 60000
      },
      threadId,
      isGroup ? 1 : 0
    );
  }

  try {
    const apiUrl = `https://api.zeidteam.xyz/tiktok/user-info?username=${encodeURIComponent(tikTokUsername)}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!response.ok || !data.status || !data.data?.user) {
      const errMsg = data?.msg || 'Không thể lấy dữ liệu từ API!';
      throw new Error(`${getCleanNameServer()}❌ ${errMsg}`);
    }

    const user = data.data.user;
    const stats = data.data.stats;

    const msg =
`${getCleanNameServer()}🎥 Thông tin tài khoản TikTok 🎥

🧑 Thông tin cơ bản:
✨ Tên hiển thị: ${user.nickname || 'N/A'}
🆔 Username: @${user.uniqueId || 'N/A'}
🪪 ID: ${user.id || 'N/A'}
📝 Tiểu sử: ${user.signature || 'Không có'}
✅ Xác minh: ${user.verified ? 'Đã xác minh ✅' : 'Chưa xác minh ❌'}
🔒 Tài khoản riêng tư: ${user.privateAccount ? 'Có 🔒' : 'Không 🔓'}

📊 Thống kê:
👥 Follower: ${stats.followerCount}
👣 Đang theo dõi: ${stats.followingCount}
❤️ Lượt thích: ${stats.heartCount}
🎬 Số video: ${stats.videoCount}
👍 Đã thích: ${stats.diggCount}


👤 Founder: HÀ HUY HOÀNG`;

    const tmpDir = path.join(os.tmpdir(), 'tiktok-avatar');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    const avatarPath = path.join(tmpDir, `avatar_${user.uniqueId}.jpg`);
    await downloadImage(user.avatarLarger, avatarPath);

    await sendMessage(
      {
        attachments: [avatarPath], // ✅ Sử dụng đúng chuẩn attachments
        msg: msg,
        ttl: 3600000
      },
      threadId,
      isGroup ? 1 : 0
    );

    fs.unlinkSync(avatarPath); // Xoá file sau khi gửi
  } catch (err) {
    console.error('❌ TikTok Error:', err);
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