import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { getGlobalPrefix } from '../../../service-debug/service.js';
import { sendMessageStateQuote, sendMessageFailed } from '../../../service-debug/chat-zalo/chat-style/chat-style.js';
import { nameServer } from '../../../database/index.js';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Đối tượng mô tả lệnh mail10p
export const des = {
  name: 'mail10p',
  type: 1,
  permission: 'all',
  countdown: 5,
  active: true,
};

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

// Hàm xử lý lệnh mail10p
export async function handleMail10pCommand(api, message) {
  const threadId = message.threadId;
  const authorId = message.data.uidFrom;
  const content = message.data.content.trim();
  const userName = `UID: ${authorId}`; // Bỏ getUserNameById, dùng UID trực tiếp
  const prefix = await getGlobalPrefix(); // Lấy tiền tố lệnh toàn cục
  const serverName = getCleanNameServer();

  // Xác định xem threadId là nhóm hay cá nhân
  let isGroup = threadId !== authorId;
  if (typeof message.isGroup !== 'undefined') {
    isGroup = message.isGroup;
    console.warn('Using message.isGroup:', message.isGroup, 'threadId !== authorId:', threadId !== authorId);
  }

  // Log để debug
  console.log('Received message:', { threadId, authorId, content, isGroup });
  console.log('Current Prefix:', prefix);

  // Kiểm tra lệnh hợp lệ
  const commandPrefix = content.split(/\s+/)[0].toLowerCase();
  if (!content.startsWith(`${prefix}mail10p`) && !content.startsWith(`${prefix}10minutemail`)) {
    const helpText = `📌 Lệnh 10MinuteMail:\n\n` +
                     ` \ ${prefix}mail10p new\ hoặc \ ${prefix}more\  → Tạo mail mới\n\n` +
                     ` \ ${prefix}mail10p get\ → Lấy thông tin mail hiện tại\n\n` +
                     ` \ ${prefix}mail10p check\ → Kiểm tra thư đến gần nhất\n\n` +                 
                     `[Người yêu cầu: ${userName}]`;
    return sendMessageStateQuote(api, message, `${serverName}${helpText}`, true, 60000, isGroup);
  }

  const args = content.split(/\s+/);
  if (args.length < 2) {
    const helpText = `📌 Lệnh 10MinuteMail:\n\n` +
                     ` \ ${prefix}mail10p new\ hoặc \ ${prefix}more\  → Tạo mail mới\n\n` +
                     ` \ ${prefix}mail10p get\ → Lấy thông tin mail hiện tại\n\n` +
                     ` \ ${prefix}mail10p check\ → Kiểm tra thư đến gần nhất\n\n` +
                     `[Người yêu cầu: ${userName}]`;
    return sendMessageStateQuote(api, message, `${serverName}${helpText}`, true, 60000, isGroup);
  }

  const command = args[1].toLowerCase();

  try {
    // Xử lý lệnh 'new' hoặc 'more'
    if (['new', 'more'].includes(command)) {
      const response = await axios.get('https://10minutemail.net/address.api.php?more=1', { timeout: 10000 });
      const data = response.data;

      const email = data.mail_get_mail || 'Không xác định';
      const key = data.mail_get_key || 'Không xác định';
      const timeLeft = data.mail_left_time || '?';
      const mailList = data.mail_list || [];

      const mail = mailList[0] || {};
      const mailId = mail.mail_id || '??';
      const subject = mail.subject || 'Không có tiêu đề';
      const date = mail.datetime2 || 'Chưa rõ';

      const msg = `📨 Tạo Email 10 Phút Thành Công!\n\n` +
                  `📧 Email: \`${email}\`\n` +
                  `🔑 Key: \`${key}\`\n` +
                  `⏳ Thời gian còn lại: ${timeLeft}s\n\n` +
                  `📬 Mail ID: ${mailId}\n` +
                  `📝 Tiêu đề: ${subject}\n` +
                  `🕒 Nhận lúc: ${date}\n\n` +
                  `[Người yêu cầu: ${userName}]`;
      return sendMessageStateQuote(api, message, `${serverName}${msg}`, true, 60000, isGroup);
    }

    // Xử lý lệnh 'get'
    if (command === 'get') {
      const response = await axios.get('https://10minutemail.net/address.api.php', { timeout: 10000 });
      const data = response.data;

      const email = data.mail_get_mail || 'Không xác định';
      const sessionId = data.session_id || '?';
      const permalink = data.permalink || {};
      const key = permalink.key || '?';
      const url = (permalink.url || '?').replace(/\./g, ' . ');

      const msg = `📧 Thông Tin Email Hiện Tại:\n\n` +
                  `✉️ Email: \`${email.replace(/\./g, ' . ')}\`\n` +
                  `🆔 Session ID: ${sessionId}\n` +
                  `🔑 Key: \`${key}\`\n` +
                  `🔗 Link: ${url}\n\n` +
                  `[Người yêu cầu: ${userName}]`;
      return sendMessageStateQuote(api, message, `${serverName}${msg}`, true, 60000, isGroup);
    }

    // Xử lý lệnh 'check'
    if (command === 'check') {
      const response = await axios.get('https://10minutemail.net/address.api.php', { timeout: 10000 });
      const data = response.data;

      const mailList = data.mail_list || [];
      const email = data.mail_get_mail || 'Không rõ';

      if (mailList.length === 0) {
        const msg = `📭 Hộp thư của \`${email}\` hiện không có email nào!\n\n[Người yêu cầu: ${userName}]`;
        return sendMessageStateQuote(api, message, `${serverName}${msg}`, true, 60000, isGroup);
      }

      const mail = mailList[0];
      const fromAddr = (mail.from || 'Không rõ').replace(/\./g, ' . ');
      const subject = mail.subject || 'Không có tiêu đề';
      const timeRecv = mail.datetime2 || '?';
      const mailId = mail.mail_id || '?';

      const msg = `📬 Kiểm Tra Thư Mới\n\n` +
                  `📧 Email: \`${email.replace(/\./g, ' . ')}\`\n` +
                  `📨 Từ: \`${fromAddr}\`\n` +
                  `🆔 Mail ID: ${mailId}\n` +
                  `📝 Chủ đề: ${subject}\n` +
                  `🕒 Thời gian: ${timeRecv}\n\n` +
                  `[Người yêu cầu: ${userName}]`;
      return sendMessageStateQuote(api, message, `${serverName}${msg}`, true, 60000, isGroup);
    }

    // Xử lý lệnh 'list'
    if (command === 'list') {
      const response = await axios.get('https://www.phamvandienofficial.xyz/mail10p/domain', { timeout: 10000 });
      const domainList = response.data.trim();

      const msg = `📜 Danh sách domain email tạm thời:\n\n${domainList}\n\n[Người yêu cầu: ${userName}]`;
      return sendMessageStateQuote(api, message, `${serverName}${msg}`, true, 60000, isGroup);
    }

    // Lệnh không hợp lệ
    const errorMsg = `⚠️ Lệnh không hợp lệ. Nhập \`${prefix}mail10p\` để xem hướng dẫn.`;
    return sendMessageStateQuote(api, message, `${serverName}${errorMsg}`, true, 60000, isGroup);
  } catch (error) {
    const errorMsg = `⚠️ Lỗi xảy ra: ${error.message}\n\n[Người yêu cầu: ${userName}]`;
    return sendMessageFailed(api, message, `${serverName}${errorMsg}`, isGroup);
  }
}