import { BrowserQRCodeReader } from '@zxing/library';
import jsQR from 'jsqr';
import QrCode from 'qrcode-reader';
import fetch from 'node-fetch';
import { createCanvas, loadImage } from 'canvas';
import sharp from 'sharp';
import { imageBufferCache } from "../../utils/image-buffer-cache.js";
import { getGlobalPrefix } from "../service.js";
import { removeMention } from "../../utils/format-util.js";
import { checkExstentionFileRemote, checkLinkIsValid } from "../../utils/util.js";
import { sendMessageCompleteRequest, sendMessageWarningRequest } from "../chat-zalo/chat-style/chat-style.js";

const TIME_SHOW_SCAN_QR = 600000;

async function fetchImageBuffer(url) {
  try {
    const response = await fetch(url, { timeout: 20000 });
    if (!response.ok) {
      throw new Error();
    }
    return await response.buffer();
  } catch (error) {
    throw error;
  }
}

async function preprocessImage(buffer, options = { contrast: 1.3, sharpen: true, threshold: true }) {
  try {
    let image = sharp(buffer);
    if (options.contrast) {
      image = image.linear(options.contrast, 0);
    }
    if (options.sharpen) {
      image = image.sharpen({ sigma: 2, m1: 0, m2: 3 });
    }
    if (options.threshold) {
      image = image.threshold(128);
    }
    image = image.greyscale();
    return await image.toBuffer();
  } catch (error) {
    throw error;
  }
}

async function bufferToImageData(buffer, width, height) {
  try {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const image = await loadImage(buffer);
    ctx.drawImage(image, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
  } catch (error) {
    throw error;
  }
}

async function resizeImageData(buffer, maxSize) {
  try {
    const image = await loadImage(buffer);
    let { width, height } = image;
    if (width > maxSize || height > maxSize) {
      const ratio = Math.min(maxSize / width, maxSize / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    return await bufferToImageData(buffer, width, height);
  } catch (error) {
    throw error;
  }
}

export async function scanQRCode(imageUrl) {
  try {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return { success: false, error: 'URL ảnh không hợp lệ' };
    }

    let buffer = await imageBufferCache.getBuffer(imageUrl).catch(() => fetchImageBuffer(imageUrl));

    const metadata = await sharp(buffer).metadata().catch(() => null);
    if (!metadata || !['jpeg', 'png'].includes(metadata.format)) {
      return { success: false, error: 'Định dạng ảnh không được hỗ trợ' };
    }

    const preprocessOptions = [
      { contrast: 1.3, sharpen: true, threshold: true },
      { contrast: 1.5, sharpen: false, threshold: false },
      { contrast: 1.0, sharpen: true, threshold: true },
      { contrast: 0, sharpen: false, threshold: false }
    ];

    let imageData;
    for (let i = 0; i < preprocessOptions.length; i++) {
      const options = preprocessOptions[i];
      buffer = await preprocessImage(buffer, options).catch(() => buffer);
      const image = await loadImage(buffer);
      imageData = await bufferToImageData(buffer, image.width, image.height);

      let jsqrResult = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (jsqrResult) {
        return { success: true, data: parseQRContent(jsqrResult.data) };
      }

      const codeReader = new BrowserQRCodeReader();
      let zxingResult = await codeReader.decodeFromImageData(imageData).catch(() => null);

      if (zxingResult) {
        return { success: true, data: parseQRContent(zxingResult.getText()) };
      }

      const qr = new QrCode();
      let qrCodeResult = await new Promise((resolve) => {
        qr.callback = (err, value) => resolve(err ? null : value);
        qr.decode(imageData);
      });

      if (qrCodeResult) {
        return { success: true, data: parseQRContent(qrCodeResult.result) };
      }
    }

    const sizes = [1024, 512, 256];
    for (const maxSize of sizes) {
      imageData = await resizeImageData(buffer, maxSize);

      let jsqrResult = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (jsqrResult) {
        return { success: true, data: parseQRContent(jsqrResult.data) };
      }

      const codeReader = new BrowserQRCodeReader();
      let zxingResult = await codeReader.decodeFromImageData(imageData).catch(() => null);

      if (zxingResult) {
        return { success: true, data: parseQRContent(zxingResult.getText()) };
      }

      const qr = new QrCode();
      let qrCodeResult = await new Promise((resolve) => {
        qr.callback = (err, value) => resolve(err ? null : value);
        qr.decode(imageData);
      });

      if (qrCodeResult) {
        return { success: true, data: parseQRContent(qrCodeResult.result) };
      }
    }

    return { success: false, error: 'Không tìm thấy mã QR' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function parseQRContent(content) {
  try {
    if (content.includes("bankid=")) {
      const params = new URLSearchParams(content);
      return {
        type: "bank_transfer",
        bankId: params.get("bankid"),
        accountNumber: params.get("account"),
        accountName: params.get("name")
      };
    }

    return {
      type: "text",
      content: content
    };
  } catch (error) {
    return {
      type: "unknown",
      content: content
    };
  }
}

export async function handleScanQRCommand(api, message, aliasCommand) {
  const prefix = getGlobalPrefix();
  const content = removeMention(message);
  let text = content.replace(`${prefix}${aliasCommand}`, "").trim();

  const quote = message.data?.quote;
  if (quote) {
    try {
      const parseMessage = JSON.parse(quote.attach);
      const href = parseMessage?.href;
      if (href) {
        text = href;
      }
    } catch (error) {
    }
  }

  if (!text) {
    const object = {
      caption: `Vui lòng reply tin nhắn chứa nội dung hoặc link QRCode cần quét!`,
    };
    await sendMessageWarningRequest(api, message, object, 30000);
    return;
  }

  const ext = await checkExstentionFileRemote(text);
  if (ext !== "png" && ext !== "jpg" && ext !== "jpeg") {
    const object = {
      caption: `Link hoặc định dạng file Không phải là QRCode!`,
    };
    await sendMessageWarningRequest(api, message, object, 30000);
    return;
  }

  const result = await scanQRCode(text);
  if (!result.success) {
    const object = {
      caption: `Không tìm thấy QRCode trong ảnh!`,
    };
    await sendMessageCompleteRequest(api, message, object, 30000);
    return;
  }

  if (checkLinkIsValid(result.data.content)) {
    const ext = await checkExstentionFileRemote(result.data.content);
    if (ext === "png" || ext === "jpg" || ext === "jpeg") {
      await sendMessageCompleteRequest(api, message, { caption: "Quét Ảnh Từ QRCode Thành Công!" }, TIME_SHOW_SCAN_QR);
      await api.sendImage(result.data.content,
        message,
        "",
        TIME_SHOW_SCAN_QR
      );
    } else if (ext === "mp4") {
      await sendMessageCompleteRequest(api, message, { caption: "Quét Video Từ QRCode Thành Công!" }, TIME_SHOW_SCAN_QR);
      await api.sendVideo({
        videoUrl: result.data.content,
        thumbnail: "",
        threadId: message.threadId,
        threadType: message.type,
        message: { text: "" },
        ttl: TIME_SHOW_SCAN_QR,
      });
    } else if (ext === "gif") {
      await sendMessageCompleteRequest(api, message, { caption: "Quét Gif Từ QRCode Thành Công!" }, TIME_SHOW_SCAN_QR);
      await api.sendGif(result.data.content,
        message,
        "",
        TIME_SHOW_SCAN_QR);
    } else if (ext === "webp") {
      await sendMessageCompleteRequest(api, message, { caption: "Quét Sticker Từ QRCode Thành Công!" }, TIME_SHOW_SCAN_QR);
      await api.sendCustomSticker(
        message,
        result.data.content,
        result.data.content,
        null,
        null,
        TIME_SHOW_SCAN_QR
      );
    } else if (ext === "aac" || ext === "mp3" || ext === "m4a") {
      await sendMessageCompleteRequest(api, message, { caption: "Quét Voice Từ QRCode Thành Công!" }, TIME_SHOW_SCAN_QR);
      await api.sendVoice(
        { threadId: message.threadId, type: message.type },
        result.data.content,
        TIME_SHOW_SCAN_QR
      );
    } else if (ext === "apk" || ext === "ipa" || ext === "zip" || ext === "rar" || ext === "7z" || ext === "tar" || ext === "gz" || ext === "bz2" || ext === "xz") {
      await sendMessageCompleteRequest(api, message, { caption: "Quét File Từ QRCode Thành Công!" }, TIME_SHOW_SCAN_QR);
      await api.sendFile(message, result.data.content, TIME_SHOW_SCAN_QR, result.data.content, null, ext, null);
    } else {
      await sendMessageCompleteRequest(api, message, { caption: `Quét QRCode Hoàn Tất, Nội Dung:\n${result.data.content}` }, TIME_SHOW_SCAN_QR);
    }
  } else {
    await sendMessageCompleteRequest(api, message, { caption: `Quét QRCode Hoàn Tất, Nội Dung:\n${result.data.content}` }, TIME_SHOW_SCAN_QR);
  }
}