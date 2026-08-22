import axios from "axios";
import { MessageMention } from "zlbotdqt";
import fs from "fs";
import path from "path";
import { removeMention } from "../../../../utils/format-util.js";

// Cấu hình chung
const CONFIG = {
  baseDataPath: path.resolve(process.cwd(), "src", "service-debug", "chat-zalo", "chat-special", "data-send"),
  maxRetries: 5,
  checkTimeout: 3000,
  retryDelay: 1000,
  // Thêm cấu hình cho các domain đặc biệt
  secureHandling: {
    maxRetries: 3,
    timeout: 3000,
    // Các domain cần xử lý đặc biệt
    domains: ['tiktok.com', 'facebook.com', 'instagram.com', 'imgur.com', 'twitter.com']
  }
};

// Cấu hình video
const VIDEO_TYPES = {
  girl: {
    variants: {
      default: { source: "vdgirl.txt", ttl: 300000 },
      sexy: { source: "vdsexy.txt", ttl: 60000, type: "Sexy" },
    },
  },
  sexy: {
    variants: {
      default: { source: "vdsexy.txt", ttl: 60000 },
    },
  },
  anime: {
    variants: {
      default: { source: "vdanime.txt", ttl: 300000 },
    },
  },
  cosplay: {
    variants: {
      default: { source: "vdcos.txt", ttl: 300000 },
    },
  },
  boy: {
    variants: {
      default: { api: "https://api.zeidteam.xyz/videos/gai", ttl: 300000 },
    },
  },
  sex: {
    variants: {
      default: { source: "vdsex.txt", ttl: 60000 },
    },
  },
};

const KEYWORD_MAPPING = {
  girl: {
    sexy: ["sexy", "hot", "gợi cảm"]
  },
  sex: {
    sex: ["sex"]
  },
};

// Các hàm utility
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Kiểm tra domain cần xử lý đặc biệt
function isSecureDomain(url) {
  return CONFIG.secureHandling.domains.some(domain => url.toLowerCase().includes(domain));
}

// Tạo headers phù hợp cho từng loại request
function createHeaders(url) {
  const headers = {
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Pragma': 'no-cache',
    'Range': 'bytes=0-1',  // Chỉ lấy header đầu tiên khi kiểm tra
    'Sec-Fetch-Dest': 'video',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'cross-site',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
  };

  // Headers theo từng domain cụ thể
  if (url.includes('tiktok.com')) {
    headers['Referer'] = 'https://www.tiktok.com/';
    headers['Origin'] = 'https://www.tiktok.com';
  } else if (url.includes('facebook.com') || url.includes('fb.com')) {
    headers['Referer'] = 'https://www.facebook.com/';
    headers['Origin'] = 'https://www.facebook.com';
  } else if (url.includes('instagram.com')) {
    headers['Referer'] = 'https://www.instagram.com/';
    headers['Origin'] = 'https://www.instagram.com';
  } else if (url.includes('imgur.com')) {
    headers['Referer'] = 'https://imgur.com/';
    headers['Origin'] = 'https://imgur.com';
  } else if (url.includes('twitter.com')) {
    headers['Referer'] = 'https://twitter.com/';
    headers['Origin'] = 'https://twitter.com';
  }

  return headers;
}

// Kiểm tra URL video có hợp lệ không với xử lý đặc biệt cho domain bảo mật
const checkVideoUrl = async (url) => {
  const isSecure = isSecureDomain(url);
  const retryConfig = isSecure ? {
    retries: CONFIG.secureHandling.maxRetries,
    timeout: CONFIG.secureHandling.timeout
  } : {
    retries: 1,
    timeout: CONFIG.checkTimeout
  };
  
  let attempt = 0;
  
  while (attempt < retryConfig.retries) {
    try {
      // Sử dụng HEAD request thay vì GET để tiết kiệm băng thông
      await Promise.race([
        axios.head(url, {
          timeout: retryConfig.timeout,
          headers: createHeaders(url),
          validateStatus: (status) => status >= 200 && status < 400,
          maxRedirects: 5
        }),
        delay(retryConfig.timeout).then(() => {
          throw new Error("Timeout khi kiểm tra URL");
        }),
      ]);
      
      // Nếu không có lỗi, URL hợp lệ
      return true;
    } catch (error) {
      attempt++;
      
      // Log lỗi và thử lại nếu còn lượt
      console.log(`Thử kiểm tra lần ${attempt}/${retryConfig.retries} cho URL: ${url}. Lỗi: ${error.message}`);
      
      // Nếu đã hết lượt thử, trả về false
      if (attempt >= retryConfig.retries) {
        return false;
      }
      
      // Đợi trước khi thử lại
      await delay(500);
    }
  }
  
  return false;
};

// Xác thực API có hoạt động không
async function validateApiEndpoint(apiUrl) {
  try {
    const response = await axios.get(apiUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    console.error(`API không hoạt động: ${apiUrl}`, error.message);
    return false;
  }
}

// Xử lý video từ file txt
async function handleApiSourceVideo(api, message, config, senderName, senderId) {
  const filePath = path.join(CONFIG.baseDataPath, config.variantConfig.source);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File không tồn tại: ${filePath}`);
    return false;
  }
  
  let videoLinks = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
  let isDieLink = false;
  let validLinksCount = videoLinks.length;
  
  // console.log(`Đang xử lý ${validLinksCount} links từ file ${config.variantConfig.source}`);
  
  while (videoLinks.length > 0) {
    const randomIndex = Math.floor(Math.random() * videoLinks.length);
    const videoUrl = videoLinks[randomIndex].trim();
    
    // Kiểm tra URL có hợp lệ không
    // console.log(`Kiểm tra URL: ${videoUrl}`);
    const isValid = await checkVideoUrl(videoUrl);
    
    if (isValid) {
      try {
        await api.sendVideo({
          videoUrl,
          threadId: message.threadId,
          threadType: message.type,
          message: {
            text: `[ ${senderName} ] ${config.variant != "default" ? `( ${config.variant} )` : ""}`,
            mentions: [MessageMention(senderId, senderName.length, 2, false)],
          },
          ttl: config.ttl,
        });
        
        // Cập nhật file nếu có links không hợp lệ
        if (isDieLink) {
          console.log(`Cập nhật lại file với ${videoLinks.length} links còn lại`);
          fs.writeFileSync(filePath, videoLinks.join("\n"));
        }
        
        return true;
      } catch (error) {
        console.error("Lỗi khi gửi video:", error.message);
        // Xóa link này nếu không gửi được
        videoLinks.splice(randomIndex, 1);
        isDieLink = true;
      }
    } else {
      console.log(`URL không hợp lệ: ${videoUrl}`);
      videoLinks.splice(randomIndex, 1);
      isDieLink = true;
    }
    
    if (isDieLink && videoLinks.length === 0) {
      console.error(`Không còn links hợp lệ trong file ${config.variantConfig.source}`);
      fs.writeFileSync(filePath, ""); // Xóa tất cả links không hợp lệ
    }
  }
  
  return false;
}

// Xử lý video từ API bên ngoài
async function handleApiExternalVideo(api, message, config, senderName, senderId) {
  let retryCount = 0;
  
  // Kiểm tra API có hoạt động không
  const isApiValid = await validateApiEndpoint(config.variantConfig.api);
  if (!isApiValid) {
    console.error(`API không hoạt động: ${config.variantConfig.api}`);
    return false;
  }
  
  while (retryCount < CONFIG.maxRetries) {
    try {
      // console.log(`Lấy video từ API: ${config.variantConfig.api} (lần ${retryCount + 1})`);
      
      const response = await axios.get(config.variantConfig.api, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`API trả về status: ${response.status}`);
      }
      
      // Xử lý cấu trúc response khác nhau
      let videoUrl;
      if (response.data.data) {
        videoUrl = response.data.data;
      } else if (response.data.url) {
        videoUrl = response.data.url;
      } else if (typeof response.data === 'string') {
        videoUrl = response.data;
      } else {
        console.error("Cấu trúc response không hợp lệ:", response.data);
        throw new Error("Không thể trích xuất URL video từ API response");
      }
      
      videoUrl = videoUrl.trim();
      // console.log(`Đã nhận URL: ${videoUrl}`);
      
      // Kiểm tra URL có hợp lệ không
      const isValid = await checkVideoUrl(videoUrl);
      
      if (isValid) {
        // console.log(`URL hợp lệ, đang gửi video...`);
        await api.sendVideo({
          videoUrl,
          threadId: message.threadId,
          threadType: message.type,
          message: {
            text: `[ ${senderName} ] ${config.variant != "default" ? `( ${config.variant} )` : ""}`,
            mentions: [MessageMention(senderId, senderName.length, 2, false)],
          },
          ttl: config.ttl,
        });
        return true;
      } else {
        console.log(`URL không hợp lệ: ${videoUrl}`);
        throw new Error("URL video không hợp lệ");
      }
    } catch (error) {
      console.error(`Lỗi lần ${retryCount + 1}:`, error.message);
      retryCount++;
      
      if (retryCount < CONFIG.maxRetries) {
        // console.log(`Đợi ${CONFIG.retryDelay}ms trước khi thử lại...`);
        await delay(CONFIG.retryDelay);
      }
    }
  }
  
  console.error(`Đã thử ${CONFIG.maxRetries} lần nhưng không thành công`);
  return false;
}

// Hàm chính xử lý video command
export const handleVideoCommand = async (api, message, type) => {
  const { dName: senderName, uidFrom: senderId } = message.data;
  const content = removeMention(message);

  // console.log(`Xử lý lệnh video type: ${type}, từ user: ${senderName}`);

  // Lấy config cho loại video
  const config = (() => {
    const typeConfig = VIDEO_TYPES[type];
    if (!typeConfig) {
      console.log(`Không tìm thấy cấu hình cho type: ${type}`);
      return null;
    }

    let variant = "default";
    const typeKeywords = KEYWORD_MAPPING[type];
    
    if (typeKeywords && content) {
      const normalizedContent = content.toLowerCase();
      for (const [variantName, keywords] of Object.entries(typeKeywords)) {
        if (keywords.some(keyword => normalizedContent.includes(keyword))) {
          variant = variantName;
          // console.log(`Tìm thấy variant: ${variant} dựa trên từ khóa trong: ${normalizedContent}`);
          break;
        }
      }
    }

    const variantConfig = typeConfig.variants[variant];
    if (!variantConfig) {
      const defaultConfig = typeConfig.variants.default;
      if (!defaultConfig) {
        console.log(`Không tìm thấy cấu hình default cho type: ${type}`);
        return null;
      }
      
      return {
        variantConfig: defaultConfig,
        ttl: defaultConfig.ttl,
        variant: defaultConfig.type || variant,
      };
    }

    return {
      variantConfig,
      ttl: variantConfig.ttl,
      variant: variantConfig.type || variant,
    };
  })();

  if (!config) {
    console.log(`Không thể xác định cấu hình cho lệnh video type: ${type}`);
    return;
  }

  // console.log(`Đã xác định cấu hình: ${JSON.stringify(config)}`);
  let success = false;
  
  try {
    if (config.variantConfig.api) {
      success = await handleApiExternalVideo(api, message, config, senderName, senderId);
    } else if (config.variantConfig.source) {
      success = await handleApiSourceVideo(api, message, config, senderName, senderId);
    }
  } catch (error) {
    console.error(`Lỗi không xác định khi xử lý video:`, error);
  }

  if (!success) {
    console.log(`Xử lý video không thành công, gửi thông báo lỗi`);
    await api.sendMessage(
      {
        msg: "Đã xảy ra lỗi khi xử lý lệnh video. Vui lòng thử lại sau.",
        quote: message,
      },
      message.threadId,
      message.type
    );
  }
};

export async function sendRandomGirlVideo(api, message, caption, type, ttl = 0) {
  // console.log(`Gửi video ngẫu nhiên loại: ${type}`);
  
  let nameFile = "vdsex.txt";
  if (type == "anime") nameFile = "vdanime.txt";
  if (type == "cosplay") nameFile = "vdcos.txt";
  if (type == "sexy") nameFile = "vdsexy.txt";
  if (type == "girl") nameFile = "vdgirl.txt";
  
  const filePath = path.join(CONFIG.baseDataPath, nameFile);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File không tồn tại: ${filePath}`);
    return false;
  }
  
  let videoLinks = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
  let processedLinks = 0;
  let removedLinks = 0;
  
  // console.log(`Đọc được ${videoLinks.length} links từ file ${nameFile}`);
  
  while (videoLinks.length > 0 && processedLinks < CONFIG.maxRetries) {
    const randomIndex = Math.floor(Math.random() * videoLinks.length);
    const videoUrl = videoLinks[randomIndex].trim();
    
    processedLinks++;
    // console.log(`Kiểm tra URL (${processedLinks}/${CONFIG.maxRetries}): ${videoUrl}`);
    
    const isValid = await checkVideoUrl(videoUrl);
    
    if (isValid) {
      try {
        // console.log(`URL hợp lệ, đang gửi video...`);
        await api.sendVideo({
          videoUrl,
          threadId: message.threadId,
          threadType: message.type,
          message: {
            text: caption,
          },
          ttl: ttl,
        });
        
        // Cập nhật file nếu có links đã bị xóa
        if (removedLinks > 0) {
          // console.log(`Cập nhật lại file với ${videoLinks.length} links còn lại`);
          fs.writeFileSync(filePath, videoLinks.join("\n"));
        }
        
        return true;
      } catch (error) {
        console.error("Lỗi khi gửi video:", error.message);
        videoLinks.splice(randomIndex, 1);
        removedLinks++;
      }
    } else {
      console.log(`URL không hợp lệ: ${videoUrl}`);
      videoLinks.splice(randomIndex, 1);
      removedLinks++;
    }
  }
  
  // Cập nhật file nếu có links không hợp lệ
  if (removedLinks > 0) {
    console.log(`Cập nhật lại file với ${videoLinks.length} links còn lại`);
    fs.writeFileSync(filePath, videoLinks.join("\n"));
  }
  
  console.log(`Không thể gửi video sau ${processedLinks} lần thử`);
  return false;
}