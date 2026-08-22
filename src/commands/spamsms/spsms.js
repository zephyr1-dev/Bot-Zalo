import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { getGlobalPrefix } from '../../service-debug/service.js';
import { sendMessageStateQuote, sendMessageFailed } from '../../service-debug/chat-zalo/chat-style/chat-style.js';
import { nameServer } from '../../database/index.js';

// Gộp tag và chữ đỏ vào 1 dòng duy nhất
const getCleanNameServer = () => {
  const lines = nameServer
    .split('\n')
    .map(line => line.trim())
    .filter(line => line);

  const tagLine = lines.find(line => line.startsWith('@'));
  const boldLine = lines.find(line => /\*\*(.*?)\*\*/.test(line) || /__(.*?)__/.test(line));

  return [tagLine, boldLine].filter(Boolean).join(' ');
};

// Đường dẫn file
const BLACKLIST_PATH = path.join('C:', 'Users', 'Administrator', 'Desktop', 'HHH_MYBOT', 'HHH_MYBOT', 'src', 'commands', 'spamsms', 'blacklist.json');
const ADMIN_PATH = path.join('C:', 'Users', 'Administrator', 'Desktop', 'HHH_MYBOT', 'HHH_MYBOT', 'assets', 'data', 'list_admin.json');

// Kiểm tra quyền admin
async function isAdmin(uid) {
  try {
    const adminData = await fs.readFile(ADMIN_PATH, 'utf-8');
    const adminList = JSON.parse(adminData);
    return adminList.includes(uid.toString());
  } catch (e) {
    console.error('Lỗi đọc file list_admin.json:', e);
    return false;
  }
}

// Đọc blacklist
async function readBlacklist() {
  try {
    const data = await fs.readFile(BLACKLIST_PATH, 'utf-8');
    return JSON.parse(data) || {};
  } catch (e) {
    console.error('Lỗi đọc file blacklist.json:', e);
    return {};
  }
}

// Ghi blacklist
async function writeBlacklist(blacklist) {
  try {
    await fs.writeFile(BLACKLIST_PATH, JSON.stringify(blacklist, null, 2));
    return true;
  } catch (e) {
    console.error('Lỗi ghi file blacklist.json:', e);
    return false;
  }
}

export const des = {
  name: 'spamsms',
  type: 1,
  permission: 'all',
  countdown: 5,
  active: true,
};

export async function handleSpamSmsCommand(api, message) {
  const threadId = message.threadId;
  const uid = message.data.uidFrom;
  const content = message.data.content.trim();
  const prefix = getGlobalPrefix();
  const args = content.slice(prefix.length).trim().split(/\s+/);
  const isGroup = typeof message.isGroup !== 'undefined' ? message.isGroup : threadId !== uid;

  if (args.length < 2 || args[0].toLowerCase() !== 'spamsms') {
    return sendMessageStateQuote(api, message, `${getCleanNameServer()}❌ Vui lòng dùng đúng cú pháp:\n➤ ${prefix}spamsms <sdt> <số lần>`, true, 60000, false);
  }

  // Xử lý lệnh addblacklist
  if (args[1].toLowerCase() === 'addblacklist' && args.length === 3) {
    if (!(await isAdmin(uid))) {
      return sendMessageStateQuote(api, message, `${getCleanNameServer()}❌ Chỉ admin mới có thể thêm số vào blacklist!`, true, 60000, false);
    }

    const sdt = args[2];
    if (sdt.length !== 10 || !/^\d+$/.test(sdt) || !sdt.startsWith('0')) {
      return sendMessageStateQuote(api, message, `${getCleanNameServer()}❌ Số điện thoại phải là 10 số và bắt đầu bằng 0!`, true, 60000, false);
    }

    const blacklist = await readBlacklist();
    if (blacklist[sdt]) {
      return sendMessageStateQuote(api, message, `${getCleanNameServer()}❌ Số ${sdt} đã có trong blacklist!`, true, 60000, false);
    }

    blacklist[sdt] = true;
    const success = await writeBlacklist(blacklist);
    if (success) {
      return sendMessageStateQuote(api, message, `${getCleanNameServer()}✅ Đã thêm số ${sdt} vào blacklist.`, true, 60000, false);
    } else {
      return sendMessageStateQuote(api, message, `${getCleanNameServer()}❌ Lỗi khi thêm số ${sdt} vào blacklist!`, true, 60000, false);
    }
  }

  // Xử lý lệnh removeblacklist
  if (args[1].toLowerCase() === 'removeblacklist' && args.length === 3) {
    if (!(await isAdmin(uid))) {
      return sendMessageStateQuote(api, message, `${getCleanNameServer()}❌ Chỉ admin mới có thể xóa số khỏi blacklist!`, true, 60000, false);
    }

    const sdt = args[2];
    if (sdt.length !== 10 || !/^\d+$/.test(sdt) || !sdt.startsWith('0')) {
      return sendMessageStateQuote(api, message, `${getCleanNameServer()}❌ Số điện thoại phải là 10 số và bắt đầu bằng 0!`, true, 60000, false);
    }

    const blacklist = await readBlacklist();
    if (!blacklist[sdt]) {
      return sendMessageStateQuote(api, message, `${getCleanNameServer()}❌ Số ${sdt} không có trong blacklist!`, true, 60000, false);
    }

    delete blacklist[sdt];
    const success = await writeBlacklist(blacklist);
    if (success) {
      return sendMessageStateQuote(api, message, `${getCleanNameServer()}✅ Đã xóa số ${sdt} khỏi blacklist.`, true, 60000, false);
    } else {
      return sendMessageStateQuote(api, message, `${getCleanNameServer()}❌ Lỗi khi xóa số ${sdt} khỏi blacklist!`, true, 60000, false);
    }
  }

  // Xử lý lệnh show
  if (args[1].toLowerCase() === 'show' && args.length === 2) {
    if (!(await isAdmin(uid))) {
      return sendMessageStateQuote(api, message, `${getCleanNameServer()}❌ Chỉ admin mới có thể xem danh sách blacklist!`, true, 60000, false);
    }

    const blacklist = await readBlacklist();
    const numbers = Object.keys(blacklist);
    if (numbers.length === 0) {
      return sendMessageStateQuote(api, message, `${getCleanNameServer()}📋 Danh sách blacklist trống.`, true, 60000, false);
    }

    const msg = `${getCleanNameServer()}📋 Danh sách blacklist:\n${numbers.map((num, index) => `${index + 1}. ${num}`).join('\n')}`;
    return sendMessageStateQuote(api, message, msg, true, 60000, false);
  }

  // Xử lý spam
  if (args.length !== 3) {
    return sendMessageStateQuote(api, message, `${getCleanNameServer()}❌ Vui lòng nhập sdt và số lần vào sau lệnh ${prefix}spamsms\nVí dụ: ${prefix}spamsms 090***567 10`, true, 60000, false);
  }

  const sdt = args[1];
  const count = parseInt(args[2]);
  const isAdminUser = await isAdmin(uid);

  const blacklist = await readBlacklist();
  if (blacklist[sdt]) {
    await api.deleteMessage(message, false).catch((err) => console.error(`Lỗi xóa tin nhắn của ${uid}:`, err));
    return sendMessageStateQuote(api, message, `${getCleanNameServer()}❌ Số ${sdt.slice(0, 5)}xxxxx nằm trong blacklist, không thể spam!`, true, 60000, false);
  }

  if (sdt.length < 10 || sdt.length > 10 || !sdt.startsWith('0') || !/^\d+$/.test(sdt)) {
    return sendMessageStateQuote(api, message, `${getCleanNameServer()}❌ Số điện thoại không hợp lệ. Phải có đúng 10 chữ số và bắt đầu bằng 0!`, true, 60000, false);
  }

  if (!isAdminUser && (isNaN(count) || count <= 0 || count > 30)) {
    return sendMessageStateQuote(api, message, `${getCleanNameServer()}❌ Số lần spam phải là số dương từ 1 đến 30 thôi, mày spam lắm làm cái đéo gì?`, true, 60000, false);
  }

  if (isNaN(count) || count <= 0) {
    return sendMessageStateQuote(api, message, `${getCleanNameServer()}❌ Số lần spam phải là số dương!`, true, 60000, false);
  }

  await sendMessageStateQuote(api, message, `${getCleanNameServer()}Đang tiến hành spam\nSDT: ${sdt}\nSố Lần: ${count}\nCreate By: HÀ HUY HOÀNG`, true, 60000, false);

  // ✅ Đổi sang file spamsms.py
  const pythonScriptPath = path.join('C:', 'Users', 'Administrator', 'Desktop', 'HHH_MYBOT', 'HHH_MYBOT', 'src', 'commands', 'spamsms', 'dec.py');

  return new Promise((resolve) => { 
    let success = 0;
    let fail = 0;
    let output = '';

    const pythonProcess = spawn('py', [pythonScriptPath, sdt, count]);

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
      if (data.toString().includes('Spam thành công lần')) {
        success++;
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      output += data.toString();
      fail++;
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        fail = count;
      } else {
        fail = count - success;
      }

      sendMessageStateQuote(api, message, `${getCleanNameServer()}📲 Đã gửi xong ${count} request spam SMS`, true, 60000, false);
      resolve();
    });
  });
}