import { getGlobalPrefix } from "../../service-debug/service.js";
import { removeMention } from "../../utils/format-util.js";

const stageOneState = new Map();
const LINK_RE = /^https?:\/\/(?:zalo\.me|zaloapp\.com\/qr)\/[^\s]+$/i;

// STG 1 is deliberately bounded to one join -> leave cycle.
export async function handleStageOneCommand(api, message) {
  const prefix = getGlobalPrefix();
  const content = removeMention(message);
  const parts = content.slice(prefix.length).trim().split(/\s+/);
  const args = parts.slice(1);

  if (args[0]?.toLowerCase() !== "stg" || args[1] !== "1") {
    await api.sendMessage({ msg: `Cú pháp:\n${prefix}t stg 1 on <link nhóm>\n${prefix}t stg 1 off\n${prefix}t stg 1 status\n\nSTG 1 chỉ thực hiện tối đa 1 chu kỳ join → leave để kiểm thử.`, quote: message }, message.threadId, message.type);
    return;
  }

  const action = args[2]?.toLowerCase();
  const key = String(message.data?.uidFrom || message.threadId);

  if (action === "off") {
    stageOneState.delete(key);
    await api.sendMessage({ msg: "✅ STG 1 đã tắt.", quote: message }, message.threadId, message.type);
    return;
  }

  if (action === "status") {
    await api.sendMessage({ msg: `STG 1 hiện đang ${stageOneState.has(key) ? "BẬT" : "TẮT"}.`, quote: message }, message.threadId, message.type);
    return;
  }

  if (action !== "on") {
    await api.sendMessage({ msg: "⚠️ Chỉ hỗ trợ on/off/status.", quote: message }, message.threadId, message.type);
    return;
  }

  const link = args[3];
  if (!link || !LINK_RE.test(link)) {
    await api.sendMessage({ msg: `⚠️ Link không hợp lệ.\nDùng: ${prefix}t stg 1 on <link nhóm>`, quote: message }, message.threadId, message.type);
    return;
  }

  if (stageOneState.has(key)) {
    await api.sendMessage({ msg: "⚠️ STG 1 đang chạy.", quote: message }, message.threadId, message.type);
    return;
  }

  stageOneState.set(key, true);
  try {
    const info = await api.getGroupInfoByLink(link);
    if (!info?.groupId) throw new Error("Không lấy được groupId.");
    await api.joinGroup(link);
    await api.leaveGroup(info.groupId);
    await api.sendMessage({ msg: "✅ STG 1 hoàn tất 1 chu kỳ join → leave.", quote: message }, message.threadId, message.type);
  } catch (error) {
    await api.sendMessage({ msg: `❌ STG 1 lỗi: ${error?.message || "không xác định"}`, quote: message }, message.threadId, message.type);
  } finally {
    stageOneState.delete(key);
  }
}
