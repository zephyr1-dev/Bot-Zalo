import { MessageMention, MessageType } from "zlbotdqt";
import axios from "axios";
import fs from "fs";
import path from "path";
import { getGlobalPrefix } from "../../service.js";
import { tempDir } from "../../../utils/io-json.js";
import { removeMention } from "../../../utils/format-util.js";
import { deleteFile, downloadFile } from "../../../utils/util.js";

// Tách các config thành map riêng
const CONFIG = {
  paths: {
    saveDir: tempDir,
  },
  download: {
    maxAttempts: 3,
    timeout: 10000, // Tăng timeout lên
    minSize: 1024, // 1KB
    defaultImageCount: 5, // Số ảnh mặc định
    maxImageCount: 24, // Giới hạn số ảnh tối đa để tránh spam
  },
  api: {
    pinterestLimit: 50, // Tăng số lượng kết quả để đa dạng hơn
    userAgents: [
      "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15"
    ]
  },
  messages: {
    noQuery: (name, prefix, command) => `${name} Vui lòng nhập từ khóa tìm kiếm và số lượng ảnh. Ví dụ: ${prefix}${command} con mèo 3`,
    searchResult: (name, query, count) => ``,
    downloadFailed: (name, attempts) => `${name} Không thể tải ảnh sau ${attempts} lần thử. Vui lòng thử lại sau.`,
    noResults: (name) => `${name} Không tìm thấy ảnh. Vui lòng thử lại sau.`,
    apiError: (name) => `${name} Gãy mẹ API rồi :(((. Đang thử phương thức dự phòng...`,
    success: (name) => `${name} Đã tìm thấy ảnh thành công!`,
    downloadingImages: (name, count) => `${name} Đang tìm ảnh cho bạn. Vui lòng chờ trong giây lát...`,
  },
};

// Phương thức tạo delay để tránh request liên tục
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Lấy User-Agent ngẫu nhiên
function getRandomUserAgent() {
  const userAgents = CONFIG.api.userAgents;
  const randomIndex = Math.floor(Math.random() * userAgents.length);
  return userAgents[randomIndex];
}

// Phương thức 1: Sử dụng Pinterest API gốc
async function handleAlternativePinterest(query) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://www.pinterest.com/resource/BaseSearchResource/get/`;
    
    // Tạo App version giả ngẫu nhiên để tránh bị chặn
    const appVersion = `1.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 100)}`;
    
    const data = {  
      options: {  
        query: query,  
        scope: "pins",  
        auto_correction_disabled: false,  
        redux_normalize_feed: true,  
        rs: "typed",  
        isPrefetch: false,
        no_fetch_context_on_resource: false,
        applied_unified_filters: null,  
        appliedProductFilters: "---",  
        filters: null,  
        bookmarks: [],  
        field_set_key: "unauth_react",
        page_size: CONFIG.api.pinterestLimit,
        source_url: `/search/pins/?q=${encodedQuery}&rs=typed`  
      },  
      context: {}  
    };
    
    // Thêm đa dạng request headers để tránh bị phát hiện
    const headers = {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': `https://www.pinterest.com/search/pins/?q=${encodedQuery}`,
      'X-Requested-With': 'XMLHttpRequest',
      'X-APP-VERSION': appVersion,
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'Connection': 'keep-alive',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache',
      'Origin': 'https://www.pinterest.com',
      'DNT': '1',
    };

    const response = await axios({  
      method: 'get',  
      url: searchUrl,  
      headers: headers,
      params: {  
        source_url: `/search/pins/?q=${encodedQuery}`,  
        data: JSON.stringify(data),  
        _: Date.now() + Math.floor(Math.random() * 1000)  
      },
      timeout: CONFIG.download.timeout
    });  

    if (response.data && response.data.resource_response && response.data.resource_response.data) {  
      const results = response.data.resource_response.data.results;  
        
      const imageUrls = results  
        .filter(pin => pin.images && (pin.images.orig || pin.images['736x'] || pin.images['474x']))  
        .map(pin => {  
          return (  
            pin.images.orig?.url ||  
            pin.images['736x']?.url ||  
            pin.images['474x']?.url  
          );  
        })  
        .filter(url => url);  

      return imageUrls;  
    }  
    return [];
  } catch (error) {
    console.error('Lỗi Pinterest gốc:', error.message);
    return [];
  }
}

// Phương thức 2: Sử dụng Pinterest API thay thế (v3)
async function handleOriginalPinterest(query) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://www.pinterest.com/resource/SearchResource/get/`;
    
    const data = {
      options: {
        article: null,
        appliedProductFilters: "---",
        auto_correction_disabled: false,
        query: query,
        scope: "pins",
        page_size: CONFIG.api.pinterestLimit,
        source: "typed",
        top_level_source: null,
        filters: null,
        rs: null
      },
      context: {}
    };
    
    const headers = {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Pinterest-AppState': 'active',
      'X-Pinterest-PWS-Handler': 'www/search/SearchResource.get',
      'Referer': `https://www.pinterest.com/search/pins/?q=${encodedQuery}`,
      'Origin': 'https://www.pinterest.com'
    };
    
    const response = await axios({
      method: 'get',
      url: searchUrl,
      headers: headers,
      params: {
        source_url: `/search/pins/?q=${encodedQuery}`,
        data: JSON.stringify(data),
        _: Date.now()
      },
      timeout: CONFIG.download.timeout
    });
    
    if (response.data && response.data.resource_response && response.data.resource_response.data) {
      const results = response.data.resource_response.data;
      
      const imageUrls = [];
      if (results && Array.isArray(results)) {
        results.forEach(item => {
          if (item.images && (item.images.orig || item.images['736x'] || item.images['474x'])) {
            const url = item.images.orig?.url || item.images['736x']?.url || item.images['474x']?.url;
            if (url) imageUrls.push(url);
          }
        });
      }
      
      return imageUrls;
    }
    return [];
  } catch (error) {
    console.error('Lỗi Pinterest thay thế:', error.message);
    return [];
  }
}

// Phương thức 3: Sử dụng Google Image Scraper
async function handleGoogleImageSearch(query) {
  try {
    const encodedQuery = encodeURIComponent(query + " pinterest");
    const searchUrl = `https://www.google.com/search?q=${encodedQuery}&tbm=isch&sclient=img`;
    
    const headers = {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://www.google.com/',
    };
    
    const response = await axios({
      method: 'get',
      url: searchUrl,
      headers: headers,
      timeout: CONFIG.download.timeout,
      responseType: 'text'
    });
    
    // Lấy URL hình ảnh từ HTML response
    const imgRegex = /\["(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp))",\d+,\d+\]/g;
    let match;
    const imageUrls = [];
    
    while ((match = imgRegex.exec(response.data)) !== null) {
      const url = match[1];
      if (url && url.startsWith('https://') && !imageUrls.includes(url)) {
        imageUrls.push(url);
      }
      
      // Giới hạn số lượng kết quả
      if (imageUrls.length >= CONFIG.api.pinterestLimit) {
        break;
      }
    }
    
    return imageUrls;
  } catch (error) {
    console.error('Lỗi Google Image Search:', error.message);
    return [];
  }
}

// Lấy số lượng ảnh từ nội dung tin nhắn
function getImageCountFromMessage(content) {
  // Tìm số nguyên dương cuối cùng trong nội dung
  const numberMatches = content.match(/\d+/g);
  
  if (numberMatches && numberMatches.length > 0) {
    const lastNumber = parseInt(numberMatches[numberMatches.length - 1], 10);
    
    // Kiểm tra nếu số cuối cùng là số nguyên > 1
    if (lastNumber > 1) {
      // Giới hạn số lượng ảnh tối đa
      return Math.min(lastNumber, CONFIG.download.maxImageCount);
    }
  }
  
  // Trả về số ảnh mặc định nếu không tìm thấy số hoặc số không hợp lệ
  return CONFIG.download.defaultImageCount;
}

// Hàm tải xuống nhiều ảnh
async function downloadMultipleImages(imageUrls, count) {
  const downloadedImages = [];
  let usedIndexes = new Set(); // Theo dõi các vị trí đã sử dụng
  
  // Tạo thư mục tạm để lưu ảnh
  const IMAGE_BASE_DIR = path.join(CONFIG.paths.saveDir, "temp_images");
  if (!fs.existsSync(IMAGE_BASE_DIR)) {
    fs.mkdirSync(IMAGE_BASE_DIR, { recursive: true });
  }
  
  for (let i = 0; i < count && usedIndexes.size < imageUrls.length; i++) {
    // Chọn một URL ngẫu nhiên chưa sử dụng
    let randomIndex;
    let attempts = 0;
    const maxAttempts = 3; // Số lần thử tối đa cho mỗi ảnh
    let success = false;
    
    while (attempts < maxAttempts && !success) {
      do {
        randomIndex = Math.floor(Math.random() * imageUrls.length);
      } while (usedIndexes.has(randomIndex) && usedIndexes.size < imageUrls.length);
      
      usedIndexes.add(randomIndex);
      const imageUrl = imageUrls[randomIndex];
      const tempFileName = `search_${Date.now()}_${Math.floor(Math.random() * 1000)}_${i}.jpg`;
      const imagePath = path.join(IMAGE_BASE_DIR, tempFileName);
      
      try {
        await downloadFile(imageUrl, imagePath, { timeout: CONFIG.download.timeout });
        
        // Kiểm tra kích thước file
        const fileExists = fs.existsSync(imagePath);
        if (!fileExists) {
          throw new Error("File không tồn tại sau khi tải");
        }
        
        const stats = fs.statSync(imagePath);
        if (stats.size < CONFIG.download.minSize) {
          throw new Error("Ảnh tải về quá nhỏ");
        }
        
        downloadedImages.push(imagePath);
        success = true;
      } catch (error) {
        console.error(`Ảnh ${i+1}, lần thử ${attempts + 1} thất bại:`, error.message);
        attempts++;
        
        // Xóa file nếu tải thất bại
        try {
          if (fs.existsSync(imagePath)) {
            await deleteFile(imagePath);
          }
        } catch (e) {
          console.error("Lỗi khi xóa file tạm:", e.message);
        }
      }
      
      // Thêm delay giữa các lần thử
      if (!success && attempts < maxAttempts) {
        await delay(500);
      }
    }
  }
  
  return downloadedImages;
}

// Hàm gửi nhiều ảnh
async function sendMultipleImages(api, message, imagePaths, query, imageCount) {
  const { threadId, type } = message;
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  
  try {
    if (imagePaths.length === 0) {
      await api.sendMessage(
        {
          msg: CONFIG.messages.downloadFailed(senderName, CONFIG.download.maxAttempts),
          quote: message,
          mentions: [MessageMention(senderId, senderName.length, 0)],
          ttl: 300000
        },
        threadId,
        type
      );
      return false;
    }
    
    // Gửi nhiều ảnh với một thông báo
    await api.zSendLocalImages(
      imagePaths, 
      threadId, 
      type, 
      800, 
      600, 
      { 
        text: CONFIG.messages.searchResult(senderName, query, imagePaths.length), 
        mention: [MessageMention(senderId, senderName.length, 1)]
      }, 
      60000*60
    );
    api.sendMessage({ msg: `${senderName} Đây là ảnh của bạn.`, quote: message, mentions: [MessageMention(senderId, senderName.length, 0)], ttl: 60000*60 }, threadId, message.type );
    return true;
  } catch (error) {
    console.error("Lỗi khi gửi nhiều ảnh:", error.message);
    await api.sendMessage(
      {
        msg: `${senderName} Có lỗi xảy ra khi gửi ảnh.`,
        quote: message,
        mentions: [MessageMention(senderId, senderName.length, 0)],
      },
      threadId,
      type
    );
    return false;
  } finally {
    // Đảm bảo xóa tất cả các tệp tạm
    for (const imagePath of imagePaths) {
      try {
        if (fs.existsSync(imagePath)) {
          await deleteFile(imagePath);
        }
      } catch (e) {
        console.error("Lỗi khi xóa file tạm (finally):", e.message);
      }
    }
  }
}

// Hàm chính được cải tiến để tải và gửi nhiều ảnh
export async function searchImagePinterest(api, message, command) {
  const content = removeMention(message);
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();

  // Tách query từ nội dung tin nhắn
  const query = content.replace(`${prefix}${command}`, "").trim();

  if (!query) {
    await api.sendMessage(
      {
        msg: CONFIG.messages.noQuery(senderName, prefix, command),
        quote: message,
        mentions: [MessageMention(senderId, senderName.length, 0)],
      },
      threadId,
      message.type
    );
    return;
  }

  // Phân tích số lượng ảnh cần gửi từ nội dung tin nhắn
  const imageCount = getImageCountFromMessage(content);

  // Thông báo đang tải ảnh
  // await api.sendMessage(
    // {
      // msg: CONFIG.messages.downloadingImages(senderName, imageCount),
      // quote: message,
      // mentions: [MessageMention(senderId, senderName.length, 0)],
      // ttl: 30000
    // },
    // threadId,
    // message.type
  // );

  try {
    // Phương pháp 1: Thử phương pháp Pinterest gốc
    let finalImageUrls = await handleOriginalPinterest(query);  

    // Phương pháp 2: Nếu phương pháp 1 thất bại, thử phương pháp Pinterest thay thế
    if (finalImageUrls.length === 0) {
      await api.sendMessage(
        {
          msg: CONFIG.messages.apiError(senderName),
          quote: message,
          mentions: [MessageMention(senderId, senderName.length, 0)],
          ttl: 10000
        },
        threadId,
        message.type
      );
      
      // Thử phương pháp thay thế
      finalImageUrls = await handleAlternativePinterest(query);
      
      // Phương pháp 3: Nếu vẫn thất bại, thử Google Image Search
      if (finalImageUrls.length === 0) {
        finalImageUrls = await handleGoogleImageSearch(query);
      }
    }

    if (finalImageUrls.length === 0) {  
      await api.sendMessage(  
        {  
          msg: CONFIG.messages.noResults(senderName),  
          quote: message,  
          mentions: [MessageMention(senderId, senderName.length, 0)],  
          ttl: 30000  
        },  
        threadId,  
        message.type  
      );  
      return;  
    }  

    // Tải nhiều ảnh và trả về đường dẫn
    const downloadedImages = await downloadMultipleImages(finalImageUrls, imageCount);
    
    // Gửi nhiều ảnh
    await sendMultipleImages(api, message, downloadedImages, query, imageCount);

  } catch (error) {
    console.error("Lỗi khi tìm kiếm ảnh:", error.message);
    await api.sendMessage(
      {
        msg: CONFIG.messages.apiError(senderName),
        quote: message,
        mentions: [MessageMention(senderId, senderName.length, 0)],
      },
      threadId,
      message.type
    );
  }
}