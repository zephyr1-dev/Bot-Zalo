import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { MessageType, MessageMention } from "zlbotdqt";
import { getGlobalPrefix } from "../../../service.js";
import { sendMessageWarningRequest, sendMessageProcessingRequest } from "../../chat-style/chat-style.js";
import { dataGifPath } from '../../../../utils/io-json.js';
import { deleteFile } from '../../../../utils/util.js';
import { downloadMedia } from './downloadMedia.js';

export async function handleVideoToGifCommand(api, message) {
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();
  const isGroup = message.type === MessageType.GroupMessage;
  const msgType = isGroup ? MessageType.GroupMessage : MessageType.PersonalMessage;
  let videoPath = null;
  let outputGifPath = null;

  try {
    // Đảm bảo thư mục dataGifPath tồn tại
    if (!fs.existsSync(dataGifPath)) {
      fs.mkdirSync(dataGifPath, { recursive: true });
    }

    // Define senderName and senderId
    const senderName = message.data.dName || "Người dùng";
    const senderId = message.data.uidFrom;
    const quote = message.data.quote;

    // Validate quoted message with video attachment
    if (!quote || !quote.attach) {
      await sendMessageWarningRequest(api, message, {
        caption: `${senderName}, Vui lòng reply một tin nhắn chứa video! Ví dụ: ${prefix}gifvd (kèm video).`
      }, 30000);
      return;
    }

    // Parse and validate attachment data
    let attachData;
    try {
      attachData = JSON.parse(quote.attach);
    } catch (error) {
      await sendMessageWarningRequest(api, message, {
        caption: `${senderName}, Dữ liệu video không hợp lệ. Vui lòng thử video khác.`
      }, 30000);
      return;
    }

    const videoUrl = attachData.hdUrl || attachData.href;
    if (!videoUrl) {
      await sendMessageWarningRequest(api, message, {
        caption: `${senderName}, Không tìm thấy URL video trong tin nhắn bạn reply.`
      }, 30000);
      return;
    }

    // Decode URL
    const decodedUrl = decodeURIComponent(videoUrl.replace(/\\\//g, "/"));

    // Notify user of processing
    await sendMessageProcessingRequest(api, message, {
      caption: `${senderName}, Đang chuyển video thành GIF, vui lòng chờ...`
    }, 60000);

    // Download video with retry logic
    videoPath = path.join(dataGifPath, `temp_video_${Date.now()}.mp4`);
    await downloadMediaWithRetry(decodedUrl, videoPath, 5, 10000);

    // Convert video to GIF (max 10 seconds, optimized)
    outputGifPath = path.join(dataGifPath, `output_gif_${Date.now()}.gif`);
    await convertVideoToGif(videoPath, outputGifPath, 10);

    // Check if GIF file exists and is within size limit (10MB for Zalo compatibility)
    if (!fs.existsSync(outputGifPath)) {
      throw new Error(`File GIF không tồn tại tại: ${outputGifPath}`);
    }
    const fileStats = fs.statSync(outputGifPath);
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (fileStats.size > maxSize) {
      throw new Error(`File GIF quá lớn (${(fileStats.size / 1024 / 1024).toFixed(2)}MB). Giới hạn là 10MB.`);
    }
    if (fileStats.size === 0) {
      throw new Error("File GIF rỗng hoặc không hợp lệ.");
    }

    // Send GIF to user with retry logic
    await sendMessageWithRetry(
      api,
      {
        msg: `${senderName}, Đây là GIF từ video của bạn!`,
        attachments: [outputGifPath],
        mentions: [MessageMention(senderId, senderName.length, 0)],
        ttl: 3600000
      },
      threadId,
      msgType,
      3, // maxRetries
      5000 // initialDelay
    );
  } catch (error) {
    console.error("Lỗi khi chuyển video thành GIF:", error.message, error.stack, error.response?.data);
    let errorMessage = `${senderName}, Lỗi khi chuyển video thành GIF. Vui lòng thử lại sau.`;
    if (error.message.includes("429")) {
      errorMessage = `${senderName}, Máy chủ đang bận, vui lòng thử lại sau vài phút.`;
    } else if (error.message.includes("Invalid data found") || error.message.includes("Stream")) {
      errorMessage = `${senderName}, Video không hợp lệ hoặc bị hỏng. Vui lòng thử video khác.`;
    } else if (error.code === 'ENOENT') {
      errorMessage = `${senderName}, Lỗi hệ thống tệp. Vui lòng kiểm tra quyền truy cập thư mục.`;
    } else if (error.message.includes("ffprobe") || error.message.includes("ffmpeg")) {
      errorMessage = `${senderName}, Lỗi xử lý video (FFmpeg). Vui lòng thử lại hoặc liên hệ quản trị viên.`;
    } else if (error.message.includes("File GIF không tồn tại")) {
      errorMessage = `${senderName}, Không thể tạo file GIF. Vui lòng thử lại.`;
    } else if (error.message.includes("File GIF quá lớn")) {
      errorMessage = `${senderName}, ${error.message}`;
    } else if (error.code === 115) {
      errorMessage = `${senderName}, Không thể tải file GIF lên Zalo. Vui lòng thử lại sau.`;
    }

    await api.sendMessage(
      {
        msg: errorMessage,
        quote: message
      },
      threadId,
      msgType
    );
  } finally {
    // Clean up temporary files
    if (videoPath) {
      await deleteFile(videoPath).catch(() => {});
    }
    if (outputGifPath) {
      await deleteFile(outputGifPath).catch(() => {});
    }
  }
}

// Helper function to download file with retry logic
async function downloadMediaWithRetry(url, destination, maxRetries = 5, initialDelay = 10000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await downloadMedia(url, destination);
      return;
    } catch (error) {
      if (error.message.includes("429") && attempt < maxRetries) {
        const retryAfter = error.response?.headers?.['retry-after'] ? parseInt(error.response.headers['retry-after']) * 1000 : initialDelay;
        await new Promise(resolve => setTimeout(resolve, retryAfter || initialDelay));
        initialDelay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}

// Helper function to convert video to GIF (max 10 seconds, optimized)
async function convertVideoToGif(inputPath, outputPath, fps = 25) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setDuration(10) // Đặt thời lượng về 10 giây
      .outputOptions([
        `-vf`, `fps=${fps},scale=160:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse`, // Tăng FPS và tối ưu palette
        '-c:v', 'gif',
        '-loop', '0',
        '-b:v', '500k' // Giới hạn bitrate
      ])
      .toFormat('gif')
      .on('end', resolve)
      .on('error', (err, stdout, stderr) => {
        console.error("Chi tiết lỗi FFmpeg:", stderr);
        reject(new Error(`Lỗi khi chuyển video thành GIF: ${err.message}`));
      })
      .save(outputPath);
  });
}

// Helper function to send message with retry logic
async function sendMessageWithRetry(api, message, threadId, msgType, maxRetries = 3, initialDelay = 5000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await api.sendMessage(message, threadId, msgType);
      return;
    } catch (error) {
      if (error.code === 115 && attempt < maxRetries) {
        console.warn(`Thử lại gửi tin nhắn (lần ${attempt}/${maxRetries}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, initialDelay));
        initialDelay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}