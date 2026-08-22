import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { MessageType, MessageMention } from "zlbotdqt";
import { createTextScrollingGif } from './create-gif.js';
import { getGlobalPrefix } from "../../../service.js";
import { removeMention } from "../../../../utils/format-util.js";
import { sendMessageWarningRequest, sendMessageProcessingRequest } from "../../chat-style/chat-style.js";
import { dataGifPath } from '../../../../utils/io-json.js';
import { deleteFile, downloadFile, checkExstentionFileRemote } from '../../../../utils/util.js';
import axios from 'axios';

// Hard-code API Key
const apikey = "AIzaSyACyC8fxJfIm6yiM1TG0B-gBNXnM2iATFw";
const clientkey = "my_bot_app";

export async function handleTenorGifCommand(api, message) {
  const content = removeMention(message);
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();
  const isGroup = message.type === MessageType.GroupMessage;
  const msgType = isGroup ? MessageType.GroupMessage : MessageType.PersonalMessage;
  let gifPath = null;

  const senderName = message.data.dName || "Người dùng";
  const senderId = message.data.uidFrom;

  try {
    const commandRegex = new RegExp(`^${prefix}gifmeme\\s+(.+)$`, 'i');
    const match = content.match(commandRegex);
    let searchTerm = match ? match[1].trim() : null;

    if (searchTerm && searchTerm.startsWith('<')) {
      searchTerm = searchTerm.replace(/^<.*?\s*/, '').trim();
    }

    if (!searchTerm) {
      const objectData = {
        caption: `${senderName}, Vui lòng nhập từ khóa để tìm GIF! Ví dụ: ${prefix}gifmeme cười`
      };
      await sendMessageWarningRequest(api, message, objectData, 30000);
      return;
    }

    const objectDataProcessing = {
      caption: `${senderName}, Đang tìm kiếm GIF với từ khóa "${searchTerm}", vui lòng chờ...`
    };
    await sendMessageProcessingRequest(api, message, objectDataProcessing, 60000);

    if (!apikey || apikey === "API_KEY") {
      throw new Error("API Key không được cấu hình. Vui lòng cập nhật key trong mã nguồn.");
    }

    const lmt = 8;
    const searchUrl = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(searchTerm)}&key=${apikey}&client_key=${clientkey}&limit=${lmt}`;
    let response;
    try {
      response = await axios.get(searchUrl, {
        timeout: 10000,
        headers: { 'User-Agent': 'HHH_MYBOT/1.0 (Node.js)' }
      });
    } catch (error) {
      throw new Error(`Lỗi khi gọi API Tenor: ${error.message}`);
    }

    const gifs = response.data.results;
    if (!gifs || !Array.isArray(gifs) || gifs.length === 0) {
      await api.sendMessage(
        {
          msg: `${senderName}, Không tìm thấy GIF nào với từ khóa "${searchTerm}". Vui lòng thử từ khóa khác.`,
          quote: message,
          ttl: 60000
        },
        threadId,
        msgType
      );
      return;
    }

    const validGifs = gifs.filter(gif => {
      if (!gif || !gif.media_formats || typeof gif.media_formats !== 'object') {
        return false;
      }
      const formats = gif.media_formats;
      return (
        (formats.mediumgif && formats.mediumgif.url && formats.mediumgif.url.trim()) ||
        (formats.nanogif && formats.nanogif.url && formats.nanogif.url.trim()) ||
        (formats.gif && formats.gif.url && formats.gif.url.trim()) ||
        (formats.mp4 && formats.mp4.url && formats.mp4.url.trim()) ||
        (formats.webp && formats.webp.url && formats.webp.url.trim())
      );
    });

    if (validGifs.length === 0) {
      throw new Error("GIF được chọn không có dữ liệu media hợp lệ.");
    }

    const selectedGif = validGifs[Math.floor(Math.random() * validGifs.length)];

    let mediaUrl;
    let mediaExtension = '.gif';
    const mediaFormats = selectedGif.media_formats;

    if (mediaFormats.mediumgif && mediaFormats.mediumgif.url && mediaFormats.mediumgif.url.trim()) {
      mediaUrl = mediaFormats.mediumgif.url;
    } else if (mediaFormats.nanogif && mediaFormats.nanogif.url && mediaFormats.nanogif.url.trim()) {
      mediaUrl = mediaFormats.nanogif.url;
    } else if (mediaFormats.gif && mediaFormats.gif.url && formats.gif.url.trim()) {
      mediaUrl = mediaFormats.gif.url;
    } else if (mediaFormats.mp4 && mediaFormats.mp4.url && mediaFormats.mp4.url.trim()) {
      mediaUrl = mediaFormats.mp4.url;
      mediaExtension = '.mp4';
    } else if (mediaFormats.webp && mediaFormats.webp.url && mediaFormats.webp.url.trim()) {
      mediaUrl = mediaFormats.webp.url;
      mediaExtension = '.webp';
    } else {
      throw new Error("GIF được chọn không có dữ liệu media hợp lệ.");
    }

    const gifId = selectedGif.id || 'unknown';

    try {
      fs.accessSync(dataGifPath, fs.constants.W_OK);
    } catch (error) {
      throw new Error(`Không có quyền ghi vào thư mục ${dataGifPath}: ${error.message}`);
    }

    gifPath = path.join(dataGifPath, `tenor_media_${Date.now()}${mediaExtension}`);
    try {
      await downloadFileWithRetry(mediaUrl, gifPath, 3, 5000);
      const stats = fs.statSync(gifPath);
      if (stats.size === 0) {
        throw new Error(`File tải xuống tại ${gifPath} rỗng`);
      }
    } catch (error) {
      throw new Error(`Lỗi tải file từ ${mediaUrl}: ${error.message}`);
    }

    if (!gifPath.endsWith('.gif')) {
      const tempGifPath = path.join(dataGifPath, `converted_gif_${Date.now()}.gif`);
      try {
        await convertVideoToGif(gifPath, tempGifPath);
        await deleteFile(gifPath);
        gifPath = tempGifPath;
      } catch (error) {
        throw new Error(`Lỗi chuyển đổi file sang GIF: ${error.message}`);
      }
    }

    try {
      await api.sendMessage(
        {
          msg: `${senderName}, Đây là GIF của bạn!`,
          attachments: [gifPath],
          mentions: [MessageMention(senderId, senderName.length, 0)],
          ttl: 3600000
        },
        threadId,
        msgType
      );
    } catch (error) {
      throw new Error(`Lỗi khi gửi GIF qua API chat: ${error.message}`);
    }

    const shareUrl = `https://tenor.googleapis.com/v2/registershare?id=${gifId}&key=${apikey}&q=${encodeURIComponent(searchTerm)}&client_key=${clientkey}`;
    try {
      await axios.get(shareUrl, {
        timeout: 5000,
        headers: { 'User-Agent': 'HHH_MYBOT/1.0 (Node.js)' }
      });
    } catch (error) {
      // Silent catch for share request
    }

  } catch (error) {
    let errorMessage = `${senderName}, Lỗi khi tìm kiếm GIF. Vui lòng thử lại sau.`;
    if (error.message.includes("429")) {
      errorMessage = `${senderName}, Máy chủ Tenor đang bận, vui lòng thử lại sau vài phút.`;
    } else if (error.message.includes("401") || error.message.includes("403")) {
      errorMessage = `${senderName}, Lỗi xác thực API Tenor. API key có thể không hợp lệ hoặc bị giới hạn. Vui lòng liên hệ quản trị viên hoặc kiểm tra Google Cloud Console.`;
    } else if (error.message.includes("tải file")) {
      errorMessage = `${senderName}, Không thể tải file từ Tenor. Vui lòng thử lại.`;
    } else if (error.message.includes("gửi GIF")) {
      errorMessage = `${senderName}, Không thể gửi GIF qua chat. Vui lòng thử lại.`;
    } else if (error.message.includes("quyền ghi")) {
      errorMessage = `${senderName}, Lỗi hệ thống tệp. Vui lòng liên hệ quản trị viên.`;
    } else if (error.message.includes("API Key không được cấu hình")) {
      errorMessage = `${senderName}, Lỗi cấu hình API key. Vui lòng kiểm tra mã nguồn hoặc liên hệ quản trị viên.`;
    } else if (error.message.includes("GIF được chọn không có dữ liệu media hợp lệ")) {
      errorMessage = `${senderName}, Dữ liệu GIF từ Tenor không hợp lệ. Vui lòng thử từ khóa khác hoặc liên hệ quản trị viên.`;
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
    if (gifPath && fs.existsSync(gifPath)) {
      await deleteFile(gifPath).catch(() => {});
    }
  }
}

async function downloadFileWithRetry(url, destination, maxRetries = 3, delay = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await downloadFile(url, destination);
      const stats = fs.statSync(destination);
      if (stats.size === 0) {
        throw new Error(`File tải xuống tại ${destination} rỗng`);
      }
      return;
    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
}

export async function handleGifTextCommand(api, message) {
  const content = removeMention(message);
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();
  const isGroup = message.type === MessageType.GroupMessage;
  const msgType = isGroup ? MessageType.GroupMessage : MessageType.PersonalMessage;

  const senderName = message.data.dName || "Người dùng";
  const senderId = message.data.uidFrom;

  const text = content.replace(`${prefix}giftext`, "").trim();

  if (!text) {
    await sendGifTextInstructions(api, message, threadId, msgType, senderName);
    return;
  }

  await createAndSendTextGif(api, message, threadId, text, msgType, senderName, senderId);
}

async function sendGifTextInstructions(api, message, threadId, msgType, senderName) {
  try {
    const prefix = getGlobalPrefix();
    const objectData = {
      caption: `${senderName}, Vui lòng nhập văn bản để tạo GIF! Ví dụ: ${prefix}giftext Hello World`
    };
    await sendMessageWarningRequest(api, message, objectData, 30000);
  } catch (error) {
    await api.sendMessage(
      { msg: `${senderName}, Lỗi khi hiển thị hướng dẫn sử dụng lệnh giftext. Vui lòng thử lại.`, quote: message },
      threadId,
      msgType
    );
  }
}

async function createAndSendTextGif(api, message, threadId, text, msgType, senderName, senderId) {
  let gifPath = null;
  try {
    const quote = message.data.quote;

    if (text.length > 1000) {
      const objectData = {
        caption: `${senderName}, Văn bản quá dài! Vui lòng sử dụng văn bản dưới 1000 ký tự.`
      };
      await sendMessageWarningRequest(api, message, objectData, 30000);
      return;
    }

    if (quote) {
      const objectData = {
        caption: `${senderName}, Lệnh giftext không cần reply tin nhắn. Chỉ cần nhập văn bản sau lệnh!`
      };
      await sendMessageWarningRequest(api, message, objectData, 30000);
      return;
    }

    const objectDataProcessing = {
      caption: `${senderName}, Đang tạo GIF văn bản, vui lòng chờ...`
    };
    await sendMessageProcessingRequest(api, message, objectDataProcessing, 60000);

    gifPath = await createTextScrollingGif(text);

    await api.sendMessage(
      {
        msg: '',
        attachments: [gifPath],
        mentions: [MessageMention(senderId, senderName.length, 0)],
        ttl: 3600000
      },
      threadId,
      msgType
    );
  } catch (error) {
    await api.sendMessage(
      {
        msg: `${senderName}, Lỗi khi tạo GIF văn bản. Vui lòng thử lại sau.`,
        quote: message
      },
      threadId,
      msgType
    );
  } finally {
    if (gifPath) await deleteFile(gifPath).catch(() => {});
  }
}

export async function sendGifRemote(api, message) {
  const isGroup = message.type === MessageType.GroupMessage;
  const msgType = isGroup ? MessageType.GroupMessage : MessageType.PersonalMessage;
  const senderName = message.data.dName || "Người dùng";

  try {
    const gifUrl = 'https://fg42.dlfl.me/44014749ffe651b808f7/1046098583450403461';
    await api.sendGif(
      gifUrl,
      message,
      'HA HUY HOANG',
      0
    );
  } catch (error) {
    await api.sendMessage(
      {
        msg: `${senderName}, Đã xảy ra lỗi khi gửi GIF. Vui lòng thử lại sau.`,
        quote: message
      },
      60000,
      message.threadId,
      msgType
    );
  }
}

export async function sendGifLocal(api, message) {
  const isGroup = message.type === MessageType.GroupMessage;
  const msgType = isGroup ? MessageType.GroupMessage : MessageType.PersonalMessage;
  const senderName = message.data.dName || "Người dùng";

  try {
    const gifFiles = fs.readdirSync(dataGifPath).filter(file => file.endsWith('.gif'));

    if (gifFiles.length === 0) {
      throw new Error("Không tìm thấy file GIF nào trong thư mục.");
    }

    const randomGif = gifFiles[Math.floor(Math.random() * gifFiles.length)];
    const gifPath = path.join(dataGifPath, randomGif);

    await api.sendMessage(
      {
        msg: '',
        attachments: [gifPath]
      },
      message.threadId,
      msgType
    );
  } catch (error) {
    await api.sendMessage(
      {
        msg: `${senderName}, Đã xảy ra lỗi khi gửi GIF. Vui lòng thử lại sau.`,
        quote: message
      },
      60000,
      message.threadId,
      msgType
    );
  }
}

