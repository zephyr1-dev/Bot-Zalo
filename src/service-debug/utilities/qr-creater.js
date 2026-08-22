import QRCode from 'qrcode';
import path from 'path';
import { sendMessageCompleteRequest, sendMessageWarningRequest } from '../chat-zalo/chat-style/chat-style.js';
import { tempDir } from '../../utils/io-json.js';
import { getGlobalPrefix } from '../service.js';
import { removeMention } from '../../utils/format-util.js';
import { deleteFile } from '../../utils/util.js';

/**
 * Tạo QR code từ text
 * @param {string} text Nội dung cần tạo QR
 * @returns {Promise<string>} Đường dẫn đến file QR được tạo
 */
async function generateQRCode(text) {
  const qrPath = path.join(tempDir, `qr_${Date.now()}.png`);
  
  const options = {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    quality: 0.92,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  };

  return new Promise((resolve, reject) => {
    QRCode.toFile(qrPath, text, options, (err) => {
      if (err) reject(err);
      else resolve(qrPath);
    });
  });
}

/**
 * Xử lý lệnh tạo QR code
 */
export async function handleCreateQRCommand(api, message, aliasCommand) {
  const prefix = getGlobalPrefix();
  const content = removeMention(message);
  let text = content.replace(`${prefix}${aliasCommand}`, "").trim();
  let qrPath = null;

  try {
    const quote = message.data?.quote;
    if (quote) {
      if (!text) {
        try {
          const parseMessage = JSON.parse(quote.attach);
          text = parseMessage.href || parseMessage.title || quote.msg || null;
        } catch (error) {
          text = quote.msg || null;
        }
      }
    }

    if (!text) {
      const object = {
        caption: `Vui lòng nhập nội dung cần tạo QR code hoặc reply tin nhắn chứa nội dung hợp lệ hoặc link.\nVí dụ: ${prefix}${aliasCommand} Nội dung cần tạo QR`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return;
    }

    qrPath = await generateQRCode(text);

    const object = {
      caption: `Đây là mã QR được tạo từ nội dung bạn yêu cầu!`,
      imagePath: qrPath,
    };

    await sendMessageCompleteRequest(api, message, object, 600000);

  } catch (error) {
    console.error("Lỗi khi tạo QR code:", error);
    const object = {
      caption: "Đã xảy ra lỗi khi tạo mã QR, vui lòng thử lại sau.",
    };
    await sendMessageWarningRequest(api, message, object, 30000);
  } finally {
    if (qrPath) await deleteFile(qrPath);
  }
}
