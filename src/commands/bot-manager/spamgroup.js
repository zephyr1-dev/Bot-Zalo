import { getGlobalPrefix } from "../../service-debug/service.js";
import { removeMention } from "../../utils/format-util.js";
import { MessageType } from "../../api-zalo/models/Message.js"; 

const spamSessions = new Map(); // Lưu session spam theo threadId

export async function spamgroup(api, message) {
  const prefix = getGlobalPrefix();
  const threadId = message.threadId;
  const content = removeMention(message); // giống scold-user.js

  const sendSyntaxError = () => api.sendMessage(
    {
      msg:
        `⚠️ Cú pháp sai. Dùng:\n` +
        `- ${prefix}spamgroup <nội dung>|<delay (ms)>\n` +
        `- ${prefix}spamgroup delay|<giá trị mới>\n` +
        `- ${prefix}spamgroup set|<ttl (ms)>\n` +
        `- ${prefix}spamgroup stop`,
      quote: message,
    },
    threadId,
    message.type,
    60000
  );

  // Nếu chỉ gõ mỗi lệnh
  if (content.toLowerCase() === `${prefix}spamgroup`) {
    return sendSyntaxError();
  }

  const args = content.slice(`${prefix}spamgroup`.length).trim();

  // Lấy session của threadId hiện tại
  let session = spamSessions.get(threadId);
  if (!session) {
    session = {
      isSpamming: false,
      text: "",
      delay: 1000,
      ttl: 10000, // TTL mặc định 10s
      interval: null
    };
    spamSessions.set(threadId, session);
  }

  // STOP
  if (args.toLowerCase() === "stop") {
    if (session.isSpamming) {
      clearInterval(session.interval);
      session.isSpamming = false;
      return api.sendMessage(
        { msg: "✅ Đã dừng spam.", quote: message },
        threadId,
        message.type
      );
    }
    return api.sendMessage(
      { msg: "⚠️ Không có spam nào đang chạy.", quote: message },
      threadId,
      message.type
    );
  }

  // Đổi DELAY
  if (args.toLowerCase().startsWith("delay|")) {
    const newDelay = parseInt(args.split("|")[1]);
    if (isNaN(newDelay) || newDelay < 1) {
      return api.sendMessage(
        { msg: "⚠️ Delay không hợp lệ.", quote: message },
        threadId,
        message.type
      );
    }
    session.delay = newDelay;
    if (session.isSpamming) {
      clearInterval(session.interval);
      session.interval = setInterval(() => {
        sendSpam(api, threadId, session.text, session.ttl);
      }, session.delay);
    }
    return api.sendMessage(
      { msg: `✅ Đã đổi delay thành ${session.delay}ms.`, quote: message },
      threadId,
      message.type
    );
  }

  // Đổi TTL
  if (args.toLowerCase().startsWith("set|")) {
    const newTTL = parseInt(args.split("|")[1]);
    if (isNaN(newTTL) || newTTL < 0) {
      return api.sendMessage(
        { msg: "⚠️ TTL không hợp lệ.", quote: message },
        threadId,
        message.type
      );
    }
    session.ttl = newTTL;
    return api.sendMessage(
      { msg: `✅ TTL đã đặt thành ${session.ttl}ms.`, quote: message },
      threadId,
      message.type
    );
  }

  // BẮT ĐẦU SPAM
  if (args.includes("|")) {
    const [msgContent, delayStr] = args.split("|");
    const delay = parseInt(delayStr);
    if (!msgContent.trim() || isNaN(delay) || delay < 1) {
      return sendSyntaxError();
    }

    session.text = msgContent.trim();
    session.delay = delay;

    if (session.isSpamming) clearInterval(session.interval);

    session.isSpamming = true;
    session.interval = setInterval(() => {
      sendSpam(api, threadId, session.text, session.ttl);
    }, session.delay);

    return api.sendMessage(
      {
        msg: `✅ Bắt đầu spam:\n"${session.text}"\n⏱ Delay: ${session.delay}ms\n🕒 TTL: ${session.ttl}ms`,
        quote: message,
      },
      threadId,
      message.type
    );
  }

  // Không khớp cú pháp
  return sendSyntaxError();
}

function sendSpam(api, threadId, text, ttl) {
  if (!text) return;
  api.sendMessage(
    { msg: text, ttl: ttl },
    threadId,
    MessageType.GroupMessage // đảm bảo gửi đúng loại tin nhắn nhóm
  );
}