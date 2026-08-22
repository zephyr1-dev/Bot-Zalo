import { sendMessageFactory } from '../../../api-zalo/apis/sendMessage.js';
import { sendMessageStateQuote } from '../../../service-debug/chat-zalo/chat-style/chat-style.js';
import { getGlobalPrefix } from '../../../service-debug/service.js';

// Đối tượng mô tả lệnh les
export const des = {
  name: 'les',
  version: '1.0.0',
  credits: 'HÀ HUY HOÀNG',
  description: 'Check tỉ lệ đồng tính của nữ',
  countdown: 5,
  active: true,
};

// Hàm lấy tên người dùng từ input hoặc mentions
function getUserName(content, mentions, userId) {
  try {
    // Ưu tiên lấy tên từ mentions nếu có
    const mention = mentions.find(m => m.uid === userId);
    if (mention && mention.name) {
      return mention.name;
    }
    if (mention && mention.displayName) {
      return mention.displayName;
    }

    // Lấy tên từ content (sau @, hỗ trợ tên có khoảng trắng)
    const match = content.match(/@(.+)/);
    if (match && match[1]) {
      return match[1].trim();
    }

    // Fallback to UID
    return `UID: ${userId}`;
  } catch (error) {
    console.error('Error in getUserName:', error.message);
    return `UID: ${userId}`;
  }
}

// Hàm áp dụng style cho tin nhắn (tương tự gemini.js)
function applyMessageStyle(text) {
  const COLORS = ["#f30505ff", "#15a85f", "#f27806", "#f7b503"];
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  return {
    text,
    style: {
      color,
      fontSize: 16,
      bold: true,
    },
  };
}

// Hàm xử lý lệnh les
export async function handleLesCommand(api, message) {
  const threadId = message.threadId;
  const uid = message.data.uidFrom;
  const content = message.data.content.trim();
  const currentPrefix = await getGlobalPrefix();
  const sendMessage = sendMessageFactory(api);

  // Xác định xem threadId là nhóm hay cá nhân
  let isGroup = threadId !== uid;
  if (typeof message.isGroup !== 'undefined') {
    isGroup = message.isGroup;
  }

  // Kiểm tra lệnh hợp lệ
  if (!content.startsWith(`${currentPrefix}les`)) {
    return sendMessage(
      { msg: `❌ Lệnh không hợp lệ! Dùng: ${currentPrefix}les @<tên người dùng> 🚨`, ttl: 60000 },
      threadId,
      isGroup ? 1 : 0
    );
  }

  // Kiểm tra mentions
  const mentions = message.data.mentions || [];
  if (!mentions.length) {
    return sendMessage(
      { msg: '❌ Vui lòng đề cập đến một người dùng bằng @<tên người dùng>! 🚨', ttl: 60000 },
      threadId,
      isGroup ? 1 : 0
    );
  }

  // Lấy user_id từ mention đầu tiên
  const userId = mentions[0].uid;

  // Lấy tên người được mention từ content
  const name = getUserName(content, mentions, userId);

  // Tạo tỉ lệ ngẫu nhiên
  const probability = Math.floor(Math.random() * 101); // 0-100%
  const response = `🏳️‍🌈 Con được bạn tag có độ les là ${probability}%! 🏳️‍🌈`;

  // Thử gửi với style và mention
  try {
    const styledMessage = applyMessageStyle(response);
    // Thêm mention parameter
    const mentionsParam = [{
      uid: userId,
      length: name.length,
      offset: response.indexOf(name)
    }];
    await sendMessageStateQuote(
      api,
      message,
      styledMessage.text,
      isGroup,
      60000,
      false,
      styledMessage.style,
      mentionsParam
    );
  } catch (error) {
    console.error('Failed to send message with sendMessageStateQuote:', error.message);
    // Fallback: Gửi tin nhắn bằng sendMessageFactory
    await sendMessage(
      { msg: response, ttl: 60000 },
      threadId,
      isGroup ? 1 : 0
    );
  }
}