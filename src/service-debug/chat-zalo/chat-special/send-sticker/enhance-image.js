import axios from "axios";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { getGlobalPrefix } from "../../../service.js";
import { MessageMention, MessageType } from "../../../../api-zalo/index.js";
import { sendMessageProcessingRequest, sendMessageWarningRequest } from "../../../chat-zalo/chat-style/chat-style.js";
import { deleteFile } from "../../../../utils/util.js";
import { removeMention } from "../../../../utils/format-util.js";
import { tempDir } from "../../../../utils/io-json.js";
import { appContext } from "../../../../api-zalo/context.js";

export const API_KEY_HOANGDEV = process.env.HOANGDEV_API_KEY || "hoangdev.debug";
export const API_URL_ENHANCE = "https://hoangdev.io.vn/media/lamnet";

/**
 * Kiểm tra URL có phải là ảnh hợp lệ không
 */
async function isValidImageUrl(url) {
  try {
    const response = await axios.head(url, { timeout: 10000 });
    const contentType = response.headers["content-type"]?.toLowerCase();
    return contentType && ["image/png", "image/jpeg", "image/webp"].includes(contentType);
  } catch (error) {
    throw error;
  }
}

/**
 * Kiểm tra định dạng file ảnh bằng sharp
 */
async function isValidImageFile(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();
    return !!metadata.format;
  } catch (error) {
    return false;
  }
}

/**
 * Tải ảnh với timeout
 */
async function downloadMediaWithTimeout(url, filepath, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Download timeout"));
    }, timeout);

    const response = axios({
      url,
      method: "GET",
      responseType: "stream",
      timeout: timeout,
    });

    response.then((res) => {
      const writer = fs.createWriteStream(filepath);
      res.data.pipe(writer);

      writer.on("finish", () => {
        clearTimeout(timeoutId);
        resolve(filepath);
      });

      writer.on("error", (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    }).catch((error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

/**
 * Gọi API làm nét ảnh
 */
async function enhanceImage(mediaSource) {
  const pathEnhanced = path.join(tempDir, `enhanced_image_${Date.now()}.png`);

  try {
    // Gọi API làm nét
    const response = await axios.get(API_URL_ENHANCE, {
      params: {
        apikey: API_KEY_HOANGDEV,
        input_url: mediaSource,
      },
      responseType: "json",
      timeout: 30000,
    });

    // Kiểm tra phản hồi API
    if (!response.data || !response.data.success || !response.data.url) {
      throw new Error(`API trả về dữ liệu không hợp lệ: ${JSON.stringify(response.data)}`);
    }

    const imageUrl = response.data.url;

    // Kiểm tra Content-Type của URL ảnh
    if (!(await isValidImageUrl(imageUrl))) {
      throw new Error("URL ảnh trả về từ API không phải định dạng hợp lệ (PNG, JPG, WEBP)");
    }

    // Tải ảnh từ URL
    await downloadMediaWithTimeout(imageUrl, pathEnhanced, 30000);

    // Kiểm tra định dạng file ảnh
    if (!(await isValidImageFile(pathEnhanced))) {
      throw new Error("File ảnh tải về từ API có định dạng không được hỗ trợ");
    }

    return pathEnhanced;
  } catch (error) {
    throw error;
  }
}

/**
 * Xử lý và gửi ảnh đã làm nét
 */
async function processAndSendEnhancedImage(api, message, mediaSource, senderName, senderId) {
  let pathEnhanced = null;

  try {
    // Thông báo đang xử lý
    const objectProcessing = {
      caption: `Chờ bé làm nét ảnh một chút, xong bé gửi ngay!`,
    };
    await sendMessageProcessingRequest(api, message, objectProcessing, 10000);

    // Làm nét ảnh
    pathEnhanced = await enhanceImage(mediaSource);

    // Tải ảnh lên Zalo
    const uploadResult = await api.uploadAttachment([pathEnhanced], appContext.send2meId, MessageType.DirectMessage);
    const imageUrl = uploadResult[0].fileUrl || uploadResult[0].normalUrl;

    // Gửi tin nhắn kèm ảnh đã làm nét
    await api.sendMessage(
      {
        msg: `[ ${senderName} ]\n\n🖼️ Ảnh đã được làm nét!`,
        attachments: [pathEnhanced],
        mentions: [MessageMention(senderId, senderName.length, 2, false)],
        ttl: 3600000,
      },
      message.threadId,
      message.type
    );

    return true;
  } catch (error) {
    const objectError = {
      caption: `Không thể làm nét ảnh: ${error.message}`,
    };
    await sendMessageWarningRequest(api, message, objectError, 30000);
    return false;
  } finally {
    if (pathEnhanced) {
      await deleteFile(pathEnhanced);
    }
  }
}

/**
 * Xử lý lệnh làm nét ảnh
 */
export async function handleEnhanceImageCommand(api, message) {
  const quote = message.data.quote;
  const senderName = message.data.dName;
  const senderId = message.data.uidFrom;
  const threadId = message.threadId;
  const content = removeMention(message);
  const prefix = getGlobalPrefix();

  if (!quote) {
    const object = {
      caption: `Vui lòng reply vào tin nhắn chứa ảnh cần làm nét và dùng lại lệnh ${prefix}enhance.`,
    };
    await sendMessageWarningRequest(api, message, object, 30000);
    return;
  }

  const attach = quote.attach;
  if (!attach) {
    const object = {
      caption: `Không có đính kèm nào trong nội dung reply của bạn.`,
    };
    await sendMessageWarningRequest(api, message, object, 30000);
    return;
  }

  try {
    const attachData = JSON.parse(attach);
    const mediaUrl = attachData.hdUrl || attachData.href;

    if (!mediaUrl) {
      const object = {
        caption: `Không tìm thấy URL trong đính kèm của tin nhắn bạn đã reply.`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return;
    }

    const decodedUrl = decodeURIComponent(mediaUrl.replace(/\\\//g, "/"));

    // Kiểm tra xem URL có phải là ảnh hợp lệ
    if (!(await isValidImageUrl(decodedUrl))) {
      const object = {
        caption: `URL trong tin nhắn bạn reply không phải là ảnh hợp lệ (PNG, JPG, WEBP).`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return;
    }

    await processAndSendEnhancedImage(api, message, decodedUrl, senderName, senderId);
  } catch (error) {
    const object = {
      caption: `Đã xảy ra lỗi khi xử lý lệnh làm nét ảnh: ${error.message}`,
    };
    await sendMessageWarningRequest(api, message, object, 30000);
  }
}