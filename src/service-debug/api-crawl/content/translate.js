import { getGlobalPrefix } from "../../service.js";
import { callGPTAPI } from "./gpt.js";
import { getContent } from "../../../utils/format-util.js";

export async function translateCommand(api, message) {
  const content = getContent(message);
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();

  if (content.startsWith(`${prefix}dich`)) {
    const command = content.replace(`${prefix}dich`, "").trim();
    const parts = command.split("&&");
    if (parts.length > 1) {
      const textToTranslate = parts[0];
      const targetLanguage = parts[1];

      try {
        const translatedText = await translateWithGPT(textToTranslate, targetLanguage);
        const responseMessage = `Kết quả dịch cho: ${textToTranslate}\n\nBản dịch (${targetLanguage}): ${translatedText}`;

        await api.sendMessage({ msg: responseMessage, quote: message }, threadId, message.type);
      } catch (error) {
        console.error("Lỗi khi dịch:", error);
        await api.sendMessage(
          {
            msg: "Vì vấn đề nào đó, tôi Không dịch được từ này.",
            quote: message,
          },
          threadId,
          message.type
        );
      }
    } else if (parts.length == 1) {
      const textToTranslate = parts[0];
      const targetLanguage = "vietnamese";
      try {
        const translatedText = await translateWithGPT(textToTranslate, targetLanguage);
        const responseMessage = `Kết quả dịch cho: ${textToTranslate}\n\nBản dịch (${targetLanguage}): ${translatedText}`;

        await api.sendMessage({ msg: responseMessage, quote: message }, threadId, message.type);
      } catch (error) {
        await api.sendMessage(
          {
            msg: "Vì vấn đề nào đó, tôi Không dịch được từ này.",
            quote: message,
          },
          threadId,
          message.type
        );
      }
    } else {
      await api.sendMessage(
        {
          msg: `Sử dụng: ${prefix}dich [nội dung cần dịch]&&(ngôn ngữ dịch)`,
          quote: message,
        },
        threadId,
        message.type
      );
      return;
    }
  }
}

async function translateWithGPT(text, targetLanguage) {
  const prompt = `Dịch giúp tôi cụm từ "${text}" sang ngôn ngữ ${targetLanguage}, chỉ đưa ra kết quả, Không giải thích gì thêm, nếu Không phải lating (tiếng Trung tiếng Hàn) thì thêm chú thích phiên âm`;

  const replyText = await callGPTAPI(prompt);

  return replyText;
}
