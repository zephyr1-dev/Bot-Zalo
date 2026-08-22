import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import { MessageType, MessageMention } from "zlbotdqt";
import { getGlobalPrefix } from "../../../service.js";
import { sendMessageWarningRequest, sendMessageProcessingRequest } from "../../chat-style/chat-style.js";
import { dataGifPath } from '../../../../utils/io-json.js';
import { deleteFile } from '../../../../utils/util.js';
import { downloadMedia } from './downloadMedia.js';
import { appContext } from '../../../../api-zalo/context.js';


export async function handleCutVideoCommand(api, message) {
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();
  const isGroup = message.type === MessageType.GroupMessage;
  const msgType = isGroup ? MessageType.GroupMessage : MessageType.PersonalMessage;
  let mediaPath = null;
  let outputVideoPath = null;

  // Khai báo senderName và senderId ngoài khối try
  const senderName = message.data.dName || "Người dùng";
  const senderId = message.data.uidFrom;

  try {
    const quote = message.data.quote;

    // Validate quoted message with attachment
    if (!quote || !quote.attach) {
      await sendMessageWarningRequest(api, message, {
        caption: `${senderName}, Vui lòng reply một tin nhắn chứa video hoặc ảnh! Ví dụ: ${prefix}cutvideo (kèm video hoặc ảnh).`
      }, 30000);
      return;
    }

    // Parse and validate attachment data
    let attachData;
    try {
      attachData = JSON.parse(quote.attach);
    } catch (error) {
      await sendMessageWarningRequest(api, message, {
        caption: `${senderName}, Dữ liệu không hợp lệ. Vui lòng thử lại với video hoặc ảnh khác.`,
      }, 30000);
      return;
    }

    const mediaUrl = attachData.hdUrl || attachData.href;
    if (!mediaUrl) {
      await sendMessageWarningRequest(api, message, {
        caption: `${senderName}, Không tìm thấy URL media trong tin nhắn bạn reply.`,
      }, 30000);
      return;
    }

    // Validate media URL format
    const decodedUrl = decodeURIComponent(mediaUrl.replace(/\\\//g, "/"));
    const isImage = decodedUrl.match(/\.(jpg|jpeg|png|gif)$/i);

    // Notify user of processing
    await sendMessageProcessingRequest(api, message, {
      caption: `${senderName}, Đang xử lý media, vui lòng chờ...`,
    }, 60000);

    // Sử dụng thư mục video thay vì gif
    const videoDir = path.resolve(dataGifPath, '../video');
    //console.log(`Thư mục video (tuyệt đối): ${videoDir}`);
    await fs.mkdir(videoDir, { recursive: true });
    const dirStats = await fs.stat(videoDir);
    if (!dirStats.isDirectory()) {
      throw new Error(`Thư mục ${videoDir} không hợp lệ hoặc không tồn tại.`);
    }

    // Download media
    const fileExtension = isImage ? '.jpg' : '.mp4';
    mediaPath = path.resolve(videoDir, `temp_media_${Date.now()}${fileExtension}`);
    //console.log(`Đường dẫn file đầu vào: ${mediaPath}`);
    await downloadMediaWithRetry(decodedUrl, mediaPath, 5, 10000);

    // Verify downloaded file
    const mediaStats = await fs.stat(mediaPath);
    //console.log(`File đầu vào: ${mediaPath}, kích thước: ${mediaStats.size} bytes`);
    if (mediaStats.size === 0) {
      throw new Error('File đầu vào rỗng hoặc không hợp lệ.');
    }

    // Handle image or video
    outputVideoPath = path.resolve(videoDir, `output_video_${Date.now()}.mp4`);
    //console.log(`Đường dẫn file đầu ra: ${outputVideoPath}`);
    if (isImage) {
      await imageToVideo(mediaPath, outputVideoPath);
    } else {
      await cutVideoToTenSeconds(mediaPath, outputVideoPath);
    }

    // Verify output video file
    const outputStats = await fs.stat(outputVideoPath);
    //console.log(`File đầu ra: ${outputVideoPath}, kích thước: ${outputStats.size} bytes`);
    if (outputStats.size === 0) {
      throw new Error(`File đầu ra ${outputVideoPath} rỗng hoặc không được tạo.`);
    }

    // Kiểm tra file có thể đọc được không
    try {
      await fs.readFile(outputVideoPath);
      //console.log(`File đầu ra ${outputVideoPath} có thể đọc được.`);
    } catch (error) {
      throw new Error(`Không thể đọc file đầu ra ${outputVideoPath}: ${error.message}`);
    }

    // Tải video lên Zalo và lấy URL
    const linkUploadZalo = await api.uploadAttachment([outputVideoPath], appContext.send2meId, MessageType.DirectMessage);
    const videoUrl = (linkUploadZalo[0].fileUrl || linkUploadZalo[0].normalUrl) + "?CreatedBy=HàHuyHoàng.BOT";
    //console.log(`Gửi video với URL: ${videoUrl}`);
    await api.sendVideo({
      videoUrl,
      threadId: message.threadId,
      threadType: message.type,
      message: {
        text: `[ ${senderName} ]`,
        mentions: [MessageMention(senderId, senderName.length, 2, false)],
      },
      ttl: 3600000,
    });

  } catch (error) {
    console.error("Chi tiết lỗi:", error);
    let errorMessage = `${senderName}, Lỗi khi xử lý hoặc gửi media: ${error.message}. Vui lòng thử lại sau.`;
    if (error.message.includes("429")) {
      errorMessage = `${senderName}, Máy chủ đang bận, vui lòng thử lại sau vài phút.`;
    } else if (error.message.includes("No such file or directory")) {
      errorMessage = `${senderName}, File video không tồn tại hoặc bị xóa. Vui lòng thử lại hoặc liên hệ quản trị viên.`;
    } else if (error.message.includes("ffprobe") || error.message.includes("ffmpeg")) {
      errorMessage = `${senderName}, Lỗi xử lý media (FFmpeg): ${error.message}. Vui lòng kiểm tra file đầu vào hoặc liên hệ quản trị viên.`;
    } else if (error.code === 'ENOENT') {
      errorMessage = `${senderName}, Lỗi hệ thống tệp: Không tìm thấy tệp. Vui lòng thử lại hoặc liên hệ quản trị viên.`;
    } else if (error.code === 'ERR_INVALID_ARG_TYPE') {
      errorMessage = `${senderName}, Lỗi định dạng tệp khi gửi media. Vui lòng thử lại hoặc liên hệ quản trị viên.`;
    }

    await api.sendMessage(
      {
        msg: errorMessage,
        quote: message,
      },
      threadId,
      msgType
    );
  } finally {
    // Clean up files
    if (mediaPath) {
      await deleteFile(mediaPath).catch(err => console.error(`Không thể xóa ${mediaPath}: ${err.message}`));
    }
    if (outputVideoPath) {
      await deleteFile(outputVideoPath).catch(err => console.error(`Không thể xóa ${outputVideoPath}: ${err.message}`));
    }
  }
}

// Helper function to download file with retry logic
async function downloadMediaWithRetry(url, destination, maxRetries = 5, initialDelay = 10000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await downloadMedia(url, destination);
      const stats = await fs.stat(destination);
      if (stats.size === 0) {
        throw new Error('File tải xuống rỗng.');
      }
      //console.log(`Tải xuống thành công: ${destination}`);
      return;
    } catch (error) {
      if (error.message.includes("429") && attempt < maxRetries) {
        const retryAfter = error.response?.headers?.['retry-after'] ? parseInt(error.response.headers['retry-after']) * 1000 : initialDelay;
        //console.log(`Thử lại sau ${retryAfter}ms (lần ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        initialDelay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}

// Helper function to cut video to 10 seconds
async function cutVideoToTenSeconds(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(0)
      .setDuration(10)
      .outputOptions(['-c:v libx264', '-c:a aac', '-strict -2'])
      .toFormat('mp4')
      .on('start', (commandLine) => {
        //console.log(`Chạy lệnh FFmpeg: ${commandLine}`);
      })
      .on('stderr', (stderr) => {
        //console.log(`FFmpeg stderr: ${stderr}`);
      })
      .on('end', () => {
        //console.log(`Video cắt thành công: ${outputPath}`);
        resolve();
      })
      .on('error', (err) => {
        reject(new Error(`Lỗi khi cắt video: ${err.message}`));
      })
      .save(outputPath);
  });
}

// Helper function to convert image to 10-second video
async function imageToVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .loop(10)
      .outputOptions(['-c:v libx264', '-t 10', '-pix_fmt yuv420p', '-vf scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2'])
      .toFormat('mp4')
      .on('start', (commandLine) => {
        //console.log(`Chạy lệnh FFmpeg: ${commandLine}`);
      })
      .on('stderr', (stderr) => {
        //console.log(`FFmpeg stderr: ${stderr}`);
      })
      .on('end', () => {
        //console.log(`Chuyển đổi ảnh thành video thành công: ${outputPath}`);
        resolve();
      })
      .on('error', (err) => {
        reject(new Error(`Lỗi khi chuyển đổi ảnh thành video: ${err.message}`));
      })
      .save(outputPath);
  });
}