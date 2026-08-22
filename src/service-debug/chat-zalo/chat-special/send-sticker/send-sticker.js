import axios from "axios";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { getGlobalPrefix } from "../../../service.js";
import { checkExstentionFileRemote, deleteFile, downloadFileFake, execAsync } from "../../../../utils/util.js";
import { MessageMention, MessageType } from "../../../../api-zalo/index.js";
import { tempDir } from "../../../../utils/io-json.js";
import { removeMention } from "../../../../utils/format-util.js";
import { getVideoMetadata } from "../../../../api-zalo/utils.js";
import { isAdmin } from "../../../../index.js";
import { convertToWebp } from "./create-webp.js";
import { removeBackground } from "../../../utilities/remove-background.js";
import { appContext } from "../../../../api-zalo/context.js";
import { sendMessageComplete, sendMessageProcessingRequest, sendMessageWarning, sendMessageFailed } from "../../chat-style/chat-style.js";
/**
 * Kiểm tra URL có phải là media hợp lệ Không
 */
async function isValidMediaUrl(url) {
  try {
    const ext = await checkExstentionFileRemote(url);
    if (!ext) {
      return {
        isValid: false,
        isVideo: false,
      };
    }
    if (ext === "mp4" || ext === "mov" || ext === "webm") {
      return {
        isValid: true,
        isVideo: true,
      };
    } else if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "gif" || ext === "webp" || ext === "jxl"){
      return {
        isValid: true,
        isVideo: false,
      };
    } else {
      return {
        isValid: false,
        isVideo: false,
      };
    }
  } catch (error) {
    console.error("Lỗi khi kiểm tra URL:", error);
    return {
      isValid: false,
      isVideo: false,
    };
  }
}
// Thêm hàm kiểm tra tệp hợp lệ
async function isFileValid(path) {
  try {
    const stats = await fs.promises.stat(path);
    return stats.size > 0;
  } catch {
    return false;
  }
}

/**
 * Xử lý tạo và gửi sticker từ URL hoặc đường dẫn cục bộ
 */
async function processAndSendSticker(api, message, mediaSource, isVideo) {  // <-- Thêm tham số isVideo
  const senderName = message.data.dName;
  const senderId = message.data.uidFrom;
  let pathSticker = path.join(tempDir, `sticker_${Date.now()}.templink`);
  let pathWebp = path.join(tempDir, `sticker_${Date.now()}.webp`);
  let isLocalFile = false;

  try {
    try {
      await fs.promises.access(mediaSource);
      isLocalFile = true;
    } catch {
      isLocalFile = false;
    }

    if (!isLocalFile) {
      const ext = await checkExstentionFileRemote(mediaSource);
      pathSticker = path.join(tempDir, `sticker_${Date.now()}.${ext}`);
      await downloadFileFake(mediaSource, pathSticker);
    } else {
      pathSticker = mediaSource;
    }

    // Mới: Kiểm tra tệp tải xuống
    if (!await isFileValid(pathSticker)) {
      throw new Error('Tệp tải xuống rỗng hoặc không hợp lệ');
    }

    // Mới: Dùng Sharp cho ảnh, FFmpeg cho video
    if (!isVideo) {
      // Hình ảnh tĩnh: Dùng Sharp để thay đổi kích thước và chuyển sang WebP
      const size = 512;  // Kích thước chuẩn cho sticker
      await sharp(pathSticker)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })  // Nền trong suốt
        .webp({ quality: 60, lossless: false })
        .toFile(pathWebp);
    } else {
      // Video/hoạt hình: Dùng FFmpeg hiện có
      await convertToWebp(pathSticker, pathWebp);
    }

    const linkUploadZalo = await api.uploadAttachment([pathWebp], appContext.send2meId, MessageType.DirectMessage);
    const stickerData = await getVideoMetadata(pathWebp);
    const finalUrl = linkUploadZalo[0].fileUrl + "?createby=Hoang_Bot.Bug" || linkUploadZalo[0].normalUrl + "?createby=Hoang_Bot.Bug";

    await sendMessageComplete(api, message, `Sticker của bạn đây!`, true);

    await api.sendCustomSticker(
      message,
      finalUrl,
      finalUrl,
      stickerData.width,
      stickerData.height,
      3600000
    );

    return true;
  } catch (error) {
    console.error("Lỗi khi xử lý sticker:", error.message);  // Cải thiện log
    throw error;
  } finally {
    await deleteFile(pathSticker);
    await deleteFile(pathWebp);
  }
}

/**
 * Xử lý lệnh tạo sticker
 */
export async function handleStickerCommand(api, message) {
  const quote = message.data.quote;
  const senderName = message.data.dName;
  const senderId = message.data.uidFrom;
  const threadId = message.threadId;
  const isAdminLevelHighest = isAdmin(senderId);
  const isAdminBot = isAdmin(senderId, threadId);
  const content = removeMention(message);
  const prefix = getGlobalPrefix();
  const tempPath = path.join(tempDir, `sticker_${Date.now()}.png`);

  if (!quote) {
    await sendMessageWarning(api, message, `${senderName}, Hãy reply vào tin nhắn chứa ảnh hoặc video cần tạo sticker và dùng lại lệnh ${prefix}sticker.`, true);true
    return;
  }

  const attach = quote.attach;
  if (!attach) {
    await sendMessageWarning(api, message, `${senderName}, Không có đính kèm nào trong nội dung reply của bạn.`, true);true
    return;
  }

  try {
    const attachData = JSON.parse(attach);
    const mediaUrl = attachData.hdUrl || attachData.href;

    if (!mediaUrl) {
      await sendMessageWarning(api, message, `${senderName}, Không tìm thấy URL trong đính kèm của tin nhắn bạn đã reply.`, true);true
      return;
    }

    const decodedUrl = decodeURIComponent(mediaUrl.replace(/\\\//g, "/"));

    const mediaCheck = await isValidMediaUrl(decodedUrl);
    if (!mediaCheck.isValid) {
      await sendMessageWarning(api, message, `${senderName}, URL không hợp lệ hoặc không phải là ảnh, GIF hoặc video được hỗ trợ: ${decodedUrl}`, true);true
      return;
    }

    const isVideo = mediaCheck.isVideo;
    const isXoaPhong = content.includes("xp");

    if (isXoaPhong && isVideo) {
      await sendMessageWarning(api, message, `${senderName} Chưa hỗ trợ xóa phông cho sticker video!`, true);true
      return;
    }

    if (!isAdminBot && mediaCheck.isVideo) {
      await sendMessageWarning(api, message, `${senderName}, Đại ca tao không cho phép thành viên tạo sticker video.`, true);true
      return;
    }

    await sendMessageProcessingRequest(api, message, { caption: `${senderName} Ok, đang tạo sticker, chờ một chút!` }, 6000);

    if (isXoaPhong) {
      const imageData = await removeBackground(decodedUrl);
      if (!imageData) {
        await sendMessageFailed(api, message, `${senderName}, Ựa, xóa phông lỗi hoặc hết cụ mịa ròi.`, true);true
        return;
      }
      fs.writeFileSync(tempPath, imageData);
      await processAndSendSticker(api, message, tempPath, false);
    } else {
      await processAndSendSticker(api, message, decodedUrl, isVideo);
    }
  } catch (error) {
    console.error("Lỗi khi xử lý lệnh sticker:", error);
    await sendMessageFailed(api, message, `${senderName} Lỗi khi xử lý lệnh sticker: ${error.message}`, true);true
  } finally {
    await deleteFile(tempPath);
  }
}
