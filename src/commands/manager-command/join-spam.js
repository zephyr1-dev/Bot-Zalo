import { isAdmin } from '../../index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(process.env.PROJECT_ROOT || path.join(__dirname, '../..'));

export async function handleJoinSpamCommand(api, message) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const content = message.data.content?.trim() || '';
  
  // Kiểm tra quyền admin
  if (!isAdmin(senderId)) {
    return api.sendMessage('❌ Bạn không có quyền sử dụng lệnh này!', threadId);
  }
  
  const args = content.split(/\s+/);
  
  // Kiểm tra format: +join link spam_times [on|off]
  if (args[0] !== '+join' && !content.startsWith('+join')) {
    return;
  }
  
  // Help message
  if (args.length < 3 || !args[1] || !args[2]) {
    return api.sendMessage(
      '📌 Cách sử dụng lệnh +join:\n\n' +
      '+join <link_nhóm> <số_lần> [on|off]\n\n' +
      '📝 Ví dụ:\n' +
      '+join https://zalo.me/g/abcdef 5 on\n' +
      '+join https://zalo.me/g/xyz123 10 off\n\n' +
      '✅ on - Bật chế độ spam\n' +
      '⛔ off - Tắt chế độ spam\n\n' +
      '🔞 Không có giới hạn số lần spam!',
      threadId,
      message.type
    );
  }
  
  const groupLink = args[1];
  const spamTimes = parseInt(args[2]);
  const spamMode = args[3]?.toLowerCase() === 'on' ? true : (args[3]?.toLowerCase() === 'off' ? false : true);
  
  // Validate
  if (isNaN(spamTimes) || spamTimes < 1) {
    return api.sendMessage('❌ Số lần spam phải là số dương!', threadId, message.type);
  }
  
  if (!groupLink.includes('zalo.me') && !groupLink.includes('http')) {
    return api.sendMessage('❌ Link không hợp lệ! Link phải chứa zalo.me', threadId, message.type);
  }
  
  try {
    // Lưu cấu hình spam
    const config = {
      groupLink,
      spamTimes,
      spamEnabled: spamMode,
      timestamp: Date.now(),
      addedBy: senderId,
      groupName: message.threadName || 'Unknown'
    };
    
    saveSpamConfig(threadId, config);
    
    const statusText = spamMode ? '✅ BẬT' : '⛔ TẮT';
    const confirmMsg = 
      `✔️ Đã cấu hình thành công!\n\n` +
      `📎 Link: ${groupLink}\n` +
      `🔄 Số lần: ${spamTimes}\n` +
      `📊 Trạng thái: ${statusText}`;
    
    return api.sendMessage(confirmMsg, threadId, message.type);
    
  } catch (error) {
    console.error('Error in handleJoinSpamCommand:', error);
    return api.sendMessage(
      `❌ Lỗi: ${error.message}`,
      threadId,
      message.type
    );
  }
}

// Hàm lưu cấu hình spam
function saveSpamConfig(groupID, config) {
  try {
    const configDir = path.join(projectRoot, 'assets', 'json-data');
    const configPath = path.join(configDir, 'spam-join-config.json');
    
    // Tạo thư mục nếu chưa tồn tại
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    let configs = {};
    if (fs.existsSync(configPath)) {
      try {
        configs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e) {
        configs = {};
      }
    }
    
    configs[groupID] = config;
    fs.writeFileSync(configPath, JSON.stringify(configs, null, 2), 'utf8');
    console.log(`[Spam Config] Saved config for group ${groupID}`);
  } catch (e) {
    console.error('[Spam Config] Error saving spam config:', e);
  }
}

// Hàm đọc cấu hình
export function getSpamConfig(groupID) {
  try {
    const configPath = path.join(projectRoot, 'assets', 'json-data', 'spam-join-config.json');
    if (fs.existsSync(configPath)) {
      const configs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return configs[groupID] || null;
    }
    return null;
  } catch (e) {
    console.error('[Spam Config] Error reading spam config:', e);
    return null;
  }
}

// Hàm xóa cấu hình
export function deleteSpamConfig(groupID) {
  try {
    const configPath = path.join(projectRoot, 'assets', 'json-data', 'spam-join-config.json');
    if (fs.existsSync(configPath)) {
      let configs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      delete configs[groupID];
      fs.writeFileSync(configPath, JSON.stringify(configs, null, 2), 'utf8');
      console.log(`[Spam Config] Deleted config for group ${groupID}`);
      return true;
    }
    return false;
  } catch (e) {
    console.error('[Spam Config] Error deleting spam config:', e);
    return false;
  }
}

// Hàm lấy tất cả config
export function getAllSpamConfigs() {
  try {
    const configPath = path.join(projectRoot, 'assets', 'json-data', 'spam-join-config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    return {};
  } catch (e) {
    console.error('[Spam Config] Error reading all configs:', e);
    return {};
  }
}
