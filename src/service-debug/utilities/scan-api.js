import fs from "fs";
import path from "path";
import axios from "axios";

// Cấu hình chung
const CONFIG = {
  maxAttempts: 3, // Số lần thử tối đa cho mỗi URL
  requestTimeout: 5000, // Thời gian chờ timeout cho mỗi request (ms)
  concurrentRequests: 10, // Số request đồng thời tối đa
  userAgents: [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  ]
};

/**
 * Lấy random User-Agent từ danh sách
 * @returns {string} - Random User-Agent
 */
function getRandomUserAgent() {
  const index = Math.floor(Math.random() * CONFIG.userAgents.length);
  return CONFIG.userAgents[index];
}

/**
 * Kiểm tra xem một URL có hoạt động không
 * @param {string} url - URL cần kiểm tra
 * @returns {Promise<boolean>} - True nếu URL hoạt động, False nếu không
 */
async function checkUrlStatus(url) {
  try {
    // Tạo header tùy chỉnh để tránh bị chặn
    const headers = {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    };

    // Kiểm tra nếu là URL imgur, thêm header đặc biệt
    if (url.includes('imgur.com')) {
      headers['Referer'] = 'https://imgur.com/';
    }

    const response = await axios({
      url,
      method: "HEAD", // Sử dụng phương thức HEAD để tiết kiệm băng thông
      timeout: CONFIG.requestTimeout,
      headers: headers,
      validateStatus: function (status) {
        return status >= 200 && status < 400; // Chấp nhận mã trạng thái 2xx và 3xx
      },
    });
    return true;
  } catch (error) {
    // Thử lại với GET nếu HEAD không thành công (một số CDN chặn HEAD)
    try {
      const response = await axios({
        url,
        method: "GET",
        timeout: CONFIG.requestTimeout,
        headers: {
          'User-Agent': getRandomUserAgent(),
        },
        validateStatus: function (status) {
          return status >= 200 && status < 400;
        },
        responseType: 'stream', // Chỉ lấy stream để tiết kiệm băng thông
        maxContentLength: 1024, // Chỉ lấy header và một phần nhỏ nội dung
      });
      
      // Hủy request ngay sau khi nhận được phản hồi
      response.data.destroy();
      return true;
    } catch (getError) {
      console.error(`Lỗi khi kiểm tra URL ${url}: ${error.message}`);
      return false;
    }
  }
}

/**
 * Đọc danh sách URL từ file
 * @param {string} filePath - Đường dẫn đến file chứa danh sách URL
 * @returns {string[]} - Mảng các URL
 */
function readUrlsFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`File không tồn tại: ${filePath}`);
      return [];
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return content.split("\n").filter(Boolean);
  } catch (error) {
    console.error(`Lỗi khi đọc file ${filePath}: ${error.message}`);
    return [];
  }
}

/**
 * Ghi danh sách URL vào file
 * @param {string} filePath - Đường dẫn đến file cần ghi
 * @param {string[]} urls - Mảng các URL cần ghi
 */
function writeUrlsToFile(filePath, urls) {
  try {
    fs.writeFileSync(filePath, urls.join("\n"));
  } catch (error) {
    console.error(`Lỗi khi ghi file ${filePath}: ${error.message}`);
  }
}

/**
 * Xử lý các URL theo nhóm để giới hạn số lượng request đồng thời
 * @param {string[]} urls - Danh sách URL cần kiểm tra
 * @returns {Promise<{validUrls: string[], invalidUrls: string[]}>} - Kết quả phân loại
 */
async function processUrlsInBatches(urls) {
  const validUrls = [];
  const invalidUrls = [];
  
  // Xử lý theo lô để không quá tải hệ thống
  for (let i = 0; i < urls.length; i += CONFIG.concurrentRequests) {
    const batch = urls.slice(i, i + CONFIG.concurrentRequests);
    
    // Xử lý song song trong mỗi lô
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        let isValid = false;
        let attempts = 0;
        
        // Thử kiểm tra URL nhiều lần nếu cần
        while (attempts < CONFIG.maxAttempts && !isValid) {
          isValid = await checkUrlStatus(url);
          attempts++;
          
          // Thêm độ trễ ngẫu nhiên giữa các lần thử để tránh bị phát hiện là bot
          if (!isValid && attempts < CONFIG.maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
          }
        }
        
        return { url, isValid };
      })
    );
    
    // Phân loại kết quả
    batchResults.forEach(({ url, isValid }) => {
      if (isValid) {
        validUrls.push(url);
      } else {
        invalidUrls.push(url);
      }
    });
  }
  
  return { validUrls, invalidUrls };
}

/**
 * Quét và lọc các URL không hoạt động
 * @param {string} api - API 
 * @param {object} message - Đối tượng tin nhắn
 * @param {string} type - Loại tin nhắn
 */
export async function scanApi(api, message, aliasCommand) {
  // Lấy tên file từ nội dung tin nhắn (phần tử thứ 2)
  const messageContent = message.data.content.split(" ");
  if (messageContent.length < 2) {
    await api.sendMessage(
      {
        msg: "Vui lòng cung cấp tên file để quét. Ví dụ: scanapi girl",
        quote: message,
        ttl: 30000,
      },
      message.threadId,
      message.type
    );
    return;
  }
  
  const fileName = messageContent[1];
  
  // Thực hiện quá trình quét trong một promise để không chặn luồng chính
  (async () => {
    try {
      // Xác định đường dẫn file dựa vào tên file
      let filePath;
      if (fileName.startsWith("vd")) {
        filePath = path.resolve("src/service-debug/chat-zalo/chat-special/data-send", `${fileName}.txt`);
      } else {
        filePath = path.resolve("src/service-debug/chat-zalo/chat-special/data-send", `${fileName}.txt`);
      }

      // Đọc danh sách URL từ file
      const urls = readUrlsFromFile(filePath);
      if (urls.length === 0) {
        await api.sendMessage(
          {
            msg: `Không tìm thấy URL trong file ${fileName}.txt hoặc file không tồn tại.`,
            quote: message,
            ttl: 30000,
          },
          message.threadId,
          message.type
        );
        return;
      }

      await api.sendMessage(
        {
          msg: `Đang quét ${urls.length} URL từ file ${fileName}.txt. Quá trình này có thể mất vài phút...`,
          quote: message,
          ttl: 30000,
        },
        message.threadId,
        message.type
      );

      // Tạo một bản sao dự phòng của file gốc trước khi sửa đổi
      const backupFilePath = filePath.replace(".txt", "_backup.txt");
      fs.copyFileSync(filePath, backupFilePath);

      // Kiểm tra các URL trong các lô
      const { validUrls, invalidUrls } = await processUrlsInBatches(urls);

      // Lưu các URL hợp lệ vào file gốc
      writeUrlsToFile(filePath, validUrls);
      
      // Lưu các URL không hợp lệ vào file _deleted.txt
      const invalidFilePath = filePath.replace(".txt", "_deleted.txt");
      
      // Thêm các URL không hợp lệ vào file _deleted.txt (nếu file đã tồn tại)
      let existingInvalidUrls = [];
      if (fs.existsSync(invalidFilePath)) {
        existingInvalidUrls = readUrlsFromFile(invalidFilePath);
      }
      
      // Kết hợp và loại bỏ các URL trùng lặp
      const allInvalidUrls = [...new Set([...existingInvalidUrls, ...invalidUrls])];
      writeUrlsToFile(invalidFilePath, allInvalidUrls);

      // Gửi thông báo kết quả
      await api.sendMessage(
        {
          msg: `✅ Đã quét xong file ${fileName}.txt\n` +
               `- Tổng số URL ban đầu: ${urls.length}\n` +
               `- URL hợp lệ: ${validUrls.length}\n` +
               `- URL không hợp lệ: ${invalidUrls.length}\n\n` +
               `Các URL không hợp lệ đã được lưu vào ${fileName}_deleted.txt\n` +
               `Bản sao dự phòng đã được lưu vào ${fileName}_backup.txt`,
          quote: message,
          ttl: 600000,
        },
        message.threadId,
        message.type
      );

    } catch (error) {
      console.error(`Lỗi khi quét API: ${error.message}`);
      await api.sendMessage(
        {
          msg: `❌ Đã xảy ra lỗi khi quét file ${fileName}.txt: ${error.message}`,
          quote: message,
          ttl: 30000,
        },
        message.threadId,
        message.type
      );
    }
  })();
}

// Ví dụ cách sử dụng:
// scanApi(api, message, type);
// Khi gọi lệnh "scanapi girl" hoặc "scanapi vdanime" trong message