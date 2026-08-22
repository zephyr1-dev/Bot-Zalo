import fetch from 'node-fetch';
import { getGlobalPrefix } from '../../../service-debug/service.js';
import {
  sendMessageStateQuote,
  sendMessageFailed
} from '../../../service-debug/chat-zalo/chat-style/chat-style.js';
import { nameServer } from '../../../database/index.js';

export const des = {
  name: 'checkip',
  type: 1,
  permission: 'all',
  countdown: 5,
  active: true,
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

export async function handleCheckipCommand(api, message) {
  const threadId = message.threadId;
  const uid = message.data.uidFrom;
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();
  if (!content.startsWith(`${currentPrefix}checkip`)) return false;
  const args = content.slice(currentPrefix.length + 7).trim().split(/\s+/);
  if (args.length !== 1) {
    return sendMessageStateQuote(api, message, `${getCleanNameServer()}❌ Sai cú pháp! Dùng: ${currentPrefix}checkip <ip>`, true, 60000, false);
  }
  const ip = args[0];
  const apiUrl = `https://ipinfo.io/${ip}/json`;
  try {
    const res = await fetch(apiUrl);
    const json = await res.json();
    if (!res.ok || !json.ip) {
      return sendMessageStateQuote(api, message, `${getCleanNameServer()}❌ Không tìm thấy thông tin cho IP: ${ip}`, true, 60000, false);
    }
    const [lat, lon] = (json.loc || '').split(',') || ['N/A', 'N/A'];
    const msg = 
`📍 Thông tin IP

🔢 IP: ${json.ip}
🌍 Quốc gia: ${json.country}
📌 Khu vực: ${json.region}
🏙️ Thành phố: ${json.city}
🏢 Nhà mạng: ${json.org}
📮 Mã bưu điện: ${json.postal || 'N/A'}
🕒 Múi giờ: ${json.timezone || 'N/A'}

🧭 Tọa độ:
➤ Vĩ độ: ${lat}
➤ Kinh độ: ${lon}

🛠️ Create By: HÀ HUY HOÀNG`;

    return sendMessageStateQuote(api, message, `${getCleanNameServer()}${msg}`, true, 1800000, false);

  } catch (e) {
    console.error('Lỗi API checkip:', e);
    return sendMessageFailed(api, message, `${getCleanNameServer()}❌ Lỗi khi truy vấn API: ${e.message}`, true);
  }
}