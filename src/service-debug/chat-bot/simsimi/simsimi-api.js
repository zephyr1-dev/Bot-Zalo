import axios from "axios";
import { getGlobalPrefix } from "../../service.js";
import { getContent } from "../../../utils/format-util.js";

const SIMSIMI_API_KEY = "GZyOSYF-1Pr5bDnMZ-ng2bNQVbkvtH1OeJyNBjoi";
const SIMSIMI_API_URL = "https://wsapi.simsimi.com/190410/talk";

export async function chatWithSimsimi(api, message) {
  let content = getContent(message);
  const prefix = getGlobalPrefix();
  
  const chatMessage = content.replace(`${prefix}chat`, "").trim();

  if (!chatMessage) {
    await api.sendMessage(
      { msg: "Vui lòng nhập nội dung để trò chuyện. Ví dụ: !chat Xin chào", quote: message },
      message.threadId,
      message.type
    );
    return;
  }

  try {
    const simsimiReply = await getSimsimiReply(chatMessage);
    await sendSimsimiReply(api, message, message.threadId, simsimiReply);
  } catch (error) {
    console.error("Lỗi khi gọi API Simsimi:", error.response ? error.response.data : error.message);
    await sendErrorMessage(api, message, message.threadId);
  }
}

async function getSimsimiReply(chatMessage) {
  const response = await axios.post(
    SIMSIMI_API_URL,
    {
      utext: chatMessage,
      lang: "vn",
      atext_bad_prob_max: 0.7,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SIMSIMI_API_KEY,
      },
    }
  );

  const simsimiReply = response.data.atext;

  if (!simsimiReply) {
    throw new Error("Không nhận được phản hồi từ Simsimi");
  }

  return simsimiReply;
}

async function sendSimsimiReply(api, message, threadId, simsimiReply) {
  let simReply = `Sim: ${simsimiReply}`;
  await api.sendMessage({ msg: simReply, quote: message, ttl: 180000}, threadId, message.type);
}

async function sendErrorMessage(api, message, threadId) {
  await api.sendMessage(
    { msg: "Xin lỗi, tôi Không thể trả lời lúc này. Vui lòng thử lại sau.", quote: message },
    threadId,
    message.type
  );
}
