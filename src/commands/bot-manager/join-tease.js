import { getGlobalPrefix } from "../../service-debug/service.js";
import { removeMention } from "../../utils/format-util.js";
import { MessageType } from "../../api-zalo/models/Message.js";

// Bounded, non-abusive join + playful message helper.
// Session is kept per joined group so it can always be stopped.
const sessions = new Map();
const MAX_COUNT = 10;
const MIN_DELAY = 3000;
const DEFAULT_DELAY = 5000;

const PLAYFUL_MESSAGES = [
  "👋 Xin chào mọi người, bot vừa ghé nhóm!",
  "😄 Bot đã vào tới nơi, chúc mọi người vui vẻ!",
  "🎉 Có khách mới: mình tới đây để góp vui nhé!",
  "🤖 Ping một cái cho mọi người biết bot đã online.",
  "✨ Chúc nhóm hôm nay thật nhiều tương tác!",
  "🙌 Xin phép làm quen với cả nhóm!",
  "😎 Bot đã sẵn sàng, mọi người cứ trò chuyện bình thường nhé!",
  "🎮 Ai muốn chơi game thì gọi bot nha!",
  "📢 Một lời chào thân thiện từ bot!",
  "💬 Chúc mọi người một ngày vui vẻ!",
];

function stopSession(groupId) {
  const session = sessions.get(groupId);
  if (!session) return false;
  if (session.timer) clearInterval(session.timer);
  sessions.delete(groupId);
  return true;
}

async function sendPlayful(api, groupId, session) {
  if (!sessions.has(groupId)) return;
  if (session.sent >= session.count) {
    stopSession(groupId);
    return;
  }

  const text = session.targetLabel
    ? `${session.targetLabel} ${PLAYFUL_MESSAGES[session.sent % PLAYFUL_MESSAGES.length]}`
    : PLAYFUL_MESSAGES[session.sent % PLAYFUL_MESSAGES.length];
  try {
    await api.sendMessage(
      {
        msg: text,
        mentions: session.targetId
          ? [{ pos: 0, uid: session.targetId, len: session.targetLabel.length }]
          : undefined,
      },
      groupId,
      MessageType.GroupMessage
    );
    session.sent += 1;
    if (session.sent >= session.count) stopSession(groupId);
  } catch (error) {
    console.error("[chui] Không thể gửi tin nhắn:", error);
    stopSession(groupId);
  }
}

function getTargetMention(message) {
  const mention = message.data?.mentions?.[0];
  const content = typeof message.data?.content === "string" ? message.data.content : "";
  if (!mention?.uid || !content || !Number.isInteger(mention.pos)) return null;

  const mentionText = content.slice(mention.pos, mention.pos + mention.len);
  if (!mentionText) return null;

  return {
    targetId: mention.uid,
    targetLabel: mentionText.startsWith("@") ? mentionText : `@${mentionText}`,
  };
}

function parseArgs(args) {
  const parts = args
    .split("|")
    .map((v) => v.trim())
    .filter(Boolean);

  const joined = parts.join(" ");
  const link = joined.match(/https?:\/\/zalo(?:\.me|app\.com\/qr)\/[^\s|]+/i)?.[0] || null;
  const state = /\boff\b/i.test(joined) ? "off" : /\bon\b/i.test(joined) ? "on" : null;
  const countMatch = joined.match(/(?:^|\s)(\d{1,3})(?:\s|$)/);
  const count = countMatch ? Number(countMatch[1]) : 2;

  return {
    link,
    state,
    count: Math.max(1, Math.min(MAX_COUNT, count)),
  };
}

export async function handleJoinTease(api, message) {
  const prefix = getGlobalPrefix();
  const content = removeMention(message);
  const args = content.slice(`${prefix}chui`.length).trim();

  if (!args) {
    await api.sendMessage(
      {
        msg:
          `Cú pháp an toàn:\n` +
          `${prefix}chui @user <số lần> | on\n` +
          `${prefix}chui <link nhóm> | <số lần> | on\n` +
          `${prefix}chui off hoặc ${prefix}stop chui off\n\n` +
          `Tối đa ${MAX_COUNT} tin, delay tối thiểu ${MIN_DELAY}ms.`,
        quote: message,
      },
      message.threadId,
      message.type
    );
    return;
  }

  const parsed = parseArgs(args);
  const target = getTargetMention(message);

  // OFF always stops the session for the current group.
  if (parsed.state === "off") {
    const stopped = stopSession(message.threadId);
    await api.sendMessage(
      { msg: stopped ? "✅ Đã dừng chui." : "ℹ️ Không có phiên chui đang chạy.", quote: message },
      message.threadId,
      message.type
    );
    return;
  }

  let groupId = message.threadId;

  // When a link is supplied, resolve it and join first.
  if (parsed.link) {
    try {
      const info = await api.getGroupInfoByLink(parsed.link);
      if (!info?.groupId) throw new Error("Không lấy được groupId từ link");
      await api.joinGroup(parsed.link);
      groupId = info.groupId;
    } catch (error) {
      await api.sendMessage(
        { msg: `❌ Không thể tham gia nhóm: ${error.message || "link không hợp lệ"}`, quote: message },
        message.threadId,
        message.type
      );
      return;
    }
  }

  stopSession(groupId);
  const session = {
    count: parsed.count,
    sent: 0,
    timer: null,
    targetId: target?.targetId || null,
    targetLabel: target?.targetLabel || "",
  };
  sessions.set(groupId, session);

  await api.sendMessage(
    {
      msg: `✅ Đã bật chui vui${target ? ` cho ${target.targetLabel}` : ""}: ${session.count} tin, delay ${DEFAULT_DELAY}ms.\nGõ ${prefix}stop chui off để dừng.`,
      mentions: target
        ? [{ pos: `✅ Đã bật chui vui cho `.length, uid: target.targetId, len: target.targetLabel.length }]
        : undefined,
      quote: message,
    },
    message.threadId,
    message.type
  );

  // Send the first message immediately, then continue at a bounded rate.
  await sendPlayful(api, groupId, session);
  if (sessions.has(groupId)) {
    session.timer = setInterval(() => sendPlayful(api, groupId, session), DEFAULT_DELAY);
  }
}

export function stopJoinTease(groupId) {
  return stopSession(groupId);
}
