import fetch from 'node-fetch';
import { sendMessageFactory } from  '../../../api-zalo/apis/sendMessage.js';
import { getGlobalPrefix } from '../../../service-debug/service.js';
import { nameServer } from '../../../database/index.js';

export const des = {
  name: 'quocgia',
  type: 1,
  permission: 'all',
  countdown: 30,
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

export async function handleQuocgiaCommand(api, message) {
  const threadId = message.threadId;
  const uid = message.data.uidFrom;
  const sendMessage = sendMessageFactory(api);
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  let isGroup = threadId !== uid;
  if (typeof message.isGroup !== 'undefined') isGroup = message.isGroup;

  if (!content.startsWith(`${currentPrefix}quocgia`)) {
    return sendMessage(
      {
        msg: `${getCleanNameServer()}❌ Lệnh không hợp lệ! Dùng: ${currentPrefix}quocgia <tên quốc gia> 🚨`,
        ttl: 60000
      },
      threadId,
      isGroup ? 1 : 0
    );
  }

  const args = content.slice(currentPrefix.length + 7).trim().split(/\s+/);
  if (args.length < 1) {
    return sendMessage(
      {
        msg: `${getCleanNameServer()}❌ Thiếu tên quốc gia! Dùng: ${currentPrefix}quocgia <tên quốc gia>`,
        ttl: 60000
      },
      threadId,
      isGroup ? 1 : 0
    );
  }

  const query = args.join(' ').trim();
  const countryName = encodeURIComponent(query);
  const fields = [
    'name',
    'capital',
    'region',
    'population',
    'languages',
    'timezones',
    'continents',
    'maps',
    'flags'
  ].join(',');
  const url = `https://restcountries.com/v3.1/name/${countryName}?fields=${fields}`;

  try {
    const response = await fetch(url, { timeout: 15000 });
    const data = await response.json();

    if (!response.ok || !Array.isArray(data) || data.length === 0) {
      return sendMessage(
        {
          msg: `${getCleanNameServer()}❌ Không tìm thấy thông tin cho quốc gia "${query}".`,
          ttl: 60000
        },
        threadId,
        isGroup ? 1 : 0
      );
    }

    const info = data[0];
    const name = info?.name?.common || query;
    const officialName = info?.name?.official || 'N/A';
    const capital = Array.isArray(info?.capital) && info.capital[0] ? info.capital[0] : 'N/A';
    const region = info?.region || 'N/A';
    const population = typeof info?.population === 'number' ? info.population.toLocaleString('vi-VN') : 'N/A';
    const languages = info?.languages ? Object.values(info.languages).join(', ') : 'N/A';
    const timezones = Array.isArray(info?.timezones) ? info.timezones.join(', ') : 'N/A';
    const continents = Array.isArray(info?.continents) ? info.continents.join(', ') : 'N/A';
    const googleMaps = info?.maps?.googleMaps || 'N/A';
    const openStreetMaps = info?.maps?.openStreetMaps || 'N/A';
    const flagsPNG = info?.flags?.png || null;
    const flagsSVG = info?.flags?.svg || null;

    const msg = `${getCleanNameServer()}🌎 Thông tin quốc gia 🌎

🗺️ Quốc gia: ${name} (${officialName})
🏰 Thủ đô: ${capital}
🌍 Khu vực: ${region}
👥 Dân số: ${population}
🗣️ Ngôn ngữ: ${languages}
⏰ Múi giờ: ${timezones}
🌐 Lục địa: ${continents}
📍 Google Maps: ${googleMaps}
🗾 OpenStreetMap: ${openStreetMaps}
${flagsPNG || flagsSVG ? '\n🔱 Cờ:' : ''}
${flagsPNG ? `📸 [PNG] ${flagsPNG}` : ''}
${flagsSVG ? `🖼️ [SVG] ${flagsSVG}` : ''}

👤 Founder: HÀ HUY HOÀNG`;

    return sendMessage(
      {
        msg: msg,
        ttl: 3600000
      },
      threadId,
      isGroup ? 1 : 0
    );
  } catch (err) {
    console.error('❌ Quocgia Error:', err);
    return sendMessage(
      {
        msg: `${getCleanNameServer()}❌ Lỗi: Đã xảy ra lỗi khi tìm thông tin quốc gia. Vui lòng thử lại sau.`,
        ttl: 60000
      },
      threadId,
      isGroup ? 1 : 0
    );
  }
}