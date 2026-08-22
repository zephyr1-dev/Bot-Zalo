import axios from "axios";
import * as cheerio from "cheerio";
import { ThreadType } from "zca-js";
import { LRUCache } from 'lru-cache';
import { sendMessageCompleteRequest, sendMessageWarningRequest } from "../../../service-debug/chat-zalo/chat-style/chat-style.js";
import { setSelectionsMapData } from "../../../service-debug/api-crawl/index.js";
import { getBotId } from "../../../index.js";
import { createSearchResultImage } from "../../../utils/canvas/search-canvas.js";
import fs from "fs";
import path from "path";
import { getGlobalPrefix } from "../../../service-debug/service.js";
import { getDataDownloadVideo, categoryDownload } from "../../../service-debug/api-crawl/api-hoangdev/aio-downlink.js";
import { removeMention as removeMentionUtil } from "../../../utils/format-util.js";
// Định nghĩa thư mục tạm thời
const TEMP_DIR = path.join(process.cwd(), "assets/temp");

// Tạo thư mục tạm nếu chưa tồn tại
try {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
} catch (e) {
  console.error("Failed to create temp directory:", e.message);
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];
const MAX_SIZE_MB = 80;
const TIME_TO_SELECT = 300000; // 5 phút
const PLATFORM = "xnxx";
const MAX_RETRIES = 3;
const RETRY_DELAY = () => Math.random() * 100 + 50;

const videoSelectionsMap = new LRUCache({
  max: 500,
  ttl: TIME_TO_SELECT
});

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getLogger(enabled) {
  return enabled ? (...args) => console.log(...args) : () => {};
}

function isCertError(e) {
  const msg = String(e?.message || "").toLowerCase();
  return msg.includes("certificate") || msg.includes("ssl") || msg.includes("self signed") || msg.includes("unable to verify");
}

async function searchVideos(query, logger, { insecure = false, retryCount = 0 } = {}) {
  const searchQuery = query.toLowerCase().includes("viet") ? query : `${query} vietnam`;
  const url = `https://www.xnxx.com/search/${encodeURIComponent(searchQuery)}`;
  logger && logger("search", { query, searchQuery, url, retryCount });
  try {
    const res = await axios.get(url, {
      headers: { 
        "User-Agent": getRandomUserAgent(), 
        "Accept-Language": "vi-VN,vi;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Referer": "https://www.xnxx.com/"
      },
      timeout: 40000,
      httpsAgent: insecure ? new (require('https')).Agent({ rejectUnauthorized: false }) : undefined,
    });
    const list = parseVideos(res.data, logger);
    if (list.length === 0) {
      throw new Error("Không tìm thấy video nào trong HTML");
    }
    logger && logger("search results", { count: list.length });
    return list;
  } catch (e) {
    if (retryCount < MAX_RETRIES) {
      if (isCertError(e)) {
        logger && logger("retrying with insecure", { retryCount: retryCount + 1 });
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY()));
        return await searchVideos(query, logger, { insecure: true, retryCount: retryCount + 1 });
      } else if (e.response?.status === 403 || e.response?.status === 429 || e.code === "ECONNABORTED") {
        logger && logger(`retrying due to ${e.response?.status || e.code}`, { retryCount: retryCount + 1 });
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY()));
        return await searchVideos(query, logger, { insecure, retryCount: retryCount + 1 });
      }
    }
    throw new Error(
      e.response?.status === 403 ? "Bị chặn bởi trang web (403 Forbidden)" :
      e.response?.status === 429 ? "Quá nhiều yêu cầu, vui lòng thử lại sau" :
      e.code === "ECONNABORTED" ? "Hết thời gian kết nối, vui lòng kiểm tra mạng" :
      e.message || "Không thể tìm kiếm video, có thể do lỗi trang web hoặc kết nối"
    );
  }
}

function parseVideos(html, logger) {
  const $ = cheerio.load(html);
  const results = [];
  $(".mozaique .thumb-block").each((i, el) => {
    if (i >= 30) return; // Lấy tối đa 30 video
    const element = $(el);
    const titleEl = element.find(".thumb-under a");
    const title = titleEl.attr("title") || titleEl.text().trim() || "Không có tiêu đề";
    const href = titleEl.attr("href");
    const url = href ? `https://www.xnxx.com${href}` : null;
    if (!url) {
      logger && logger("parse warning", { index: i, issue: "No URL found" });
      return;
    }
    const thumbnail = element.find(".thumb img").attr("src") || element.find(".thumb img").attr("data-src") || "";
    const metadata = element.find(".metadata").text().trim() || "";
    const duration = metadata.match(/[0-9]+min[0-9]*sec?|[0-9]+min|[0-9]+sec/gi)?.[0] || "Không rõ";
    const quality = metadata.match(/[0-9]+p/gi)?.[0] || "Không rõ";
    const views = element.find(".views").text().trim() || "0";
    const uploader = element.find(".uploader").text().trim() || "Không rõ";
    const item = { title, url, thumbnail, duration, quality, views, uploader };
    results.push(item);
  });
  logger && logger("parsed videos", results.map((r, i) => ({ i: i + 1, title: r.title, url: r.url })));
  return results;
}

async function fetchVideoUrl(pageUrl, logger, { insecure = false, retryCount = 0 } = {}) {
  logger && logger("fetchVideoUrl: get page", { pageUrl, retryCount });
  try {
    const res = await axios.get(pageUrl, {
      headers: { 
        "User-Agent": getRandomUserAgent(), 
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Referer": "https://www.xnxx.com/"
      },
      timeout: 40000,
      httpsAgent: insecure ? new (require('https')).Agent({ rejectUnauthorized: false }) : undefined,
    });
    const $ = cheerio.load(res.data);
    const scripts = Array.from($("script").toArray()).map(el => $(el).html() || "");
    let videoUrl = null;
    for (const s of scripts) {
      if (!s) continue;
      const mHigh = s.match(/html5player\.setVideoUrlHigh\('(.+?)'\)/);
      const mLow = s.match(/html5player\.setVideoUrlLow\('(.+?)'\)/);
      if (mHigh && mHigh[1]) { videoUrl = mHigh[1]; logger && logger("videoUrl HIGH found"); break; }
      if (!videoUrl && mLow && mLow[1]) { videoUrl = mLow[1]; logger && logger("videoUrl LOW candidate found"); }
    }
    if (!videoUrl) throw new Error("Không tìm thấy link video trong trang");
    logger && logger("final videoUrl", videoUrl);
    return videoUrl;
  } catch (e) {
    if (retryCount < MAX_RETRIES) {
      if (isCertError(e)) {
        logger && logger("retrying with insecure", { retryCount: retryCount + 1 });
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY()));
        return await fetchVideoUrl(pageUrl, logger, { insecure: true, retryCount: retryCount + 1 });
      } else if (e.response?.status === 403 || e.response?.status === 429 || e.code === "ECONNABORTED") {
        logger && logger(`retrying due to ${e.response?.status || e.code}`, { retryCount: retryCount + 1 });
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY()));
        return await fetchVideoUrl(pageUrl, logger, { insecure, retryCount: retryCount + 1 });
      }
    }
    throw new Error(
      e.response?.status === 403 ? "Bị chặn bởi trang web (403 Forbidden)" :
      e.response?.status === 429 ? "Quá nhiều yêu cầu, vui lòng thử lại sau" :
      e.code === "ECONNABORTED" ? "Hết thời gian kết nối, vui lòng kiểm tra mạng" :
      e.message || "Không thể lấy link video, có thể do lỗi trang web"
    );
  }
}

async function headContentLength(url, logger, { insecure = false, retryCount = 0 } = {}) {
  try {
    const r = await axios.head(url, {
      headers: { 
        "User-Agent": getRandomUserAgent(), 
        "Accept": "*/*",
        "Referer": "https://www.xnxx.com/"
      },
      timeout: 20000,
      maxRedirects: 5,
      validateStatus: () => true,
      httpsAgent: insecure ? new (require('https')).Agent({ rejectUnauthorized: false }) : undefined,
    });
    const len = Number(r.headers?.["content-length"] || 0);
    logger && logger("HEAD", { status: r.status, length: len });
    return Number.isFinite(len) ? len : 0;
  } catch (e) {
    if (retryCount < MAX_RETRIES) {
      if (isCertError(e) || e.response?.status === 403 || e.code === "ECONNABORTED") {
        logger && logger("retrying HEAD", { retryCount: retryCount + 1 });
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY()));
        return await headContentLength(url, logger, { insecure: true, retryCount: retryCount + 1 });
      }
    }
    logger && logger("HEAD error", { error: e.message });
    return 0;
  }
}

export async function handleXnxxCommand(api, message, aliasCommand) {
  const threadId = message.threadId;
  const threadType = message.type ?? ThreadType.User;
  const senderId = message.data.uidFrom;
  const prefix = getGlobalPrefix();
  const content = removeMentionUtil(message);
  const commandContent = content.replace(`${prefix}${aliasCommand}`, "").trim();
  const rawArgs = commandContent.split(/\s+/);
  const debug = rawArgs.some(a => /^(-d|--debug|-debug)$/i.test(a));
  const insecureFlag = rawArgs.some(a => /^(-k|--insecure)$/i.test(a));
  const input = rawArgs.filter(a => !/^(-d|--debug|-debug|-k|--insecure)$/i.test(a)).join(" ").trim();
  const logger = getLogger(debug);
  let imagePath = null;

  logger("run", { threadId, input, debug, insecure: insecureFlag });

  if (!input) {
    await sendMessageWarningRequest(api, message, { 
      caption: `Vui lòng nhập từ khóa hoặc dán link video\nVí dụ: ${prefix}${aliasCommand} từ khóa` 
    }, 30000);
    return 0;
  }

  if (/^https?:\/\/(www\.)?xnxx\.com\//i.test(input)) {
    const waiting = await sendMessageCompleteRequest(api, message, { caption: `Đang xử lý link...` }, 30000);
    try {
      const videoUrl = await fetchVideoUrl(input, logger, { insecure: insecureFlag });
      const size = await headContentLength(videoUrl, logger, { insecure: insecureFlag });
      if (size > 0 && size > MAX_SIZE_MB * 1024 * 1024) {
        const caption = `File quá lớn (${(size / (1024*1024)).toFixed(1)}MB). Link tải trực tiếp:\n${videoUrl}`;
        await sendMessageCompleteRequest(api, message, { caption }, 10*60_000);
      } else {
        const dataDownload = await getDataDownloadVideo(videoUrl);
        if (!dataDownload || !dataDownload.medias || dataDownload.medias.length === 0) {
          throw new Error("Không tìm thấy dữ liệu tải video từ API");
        }
        const selectedMedia = dataDownload.medias[0]; // Giả định video đầu tiên là video chính
        const quality = "default";
        const uniqueId = videoUrl.split('/').pop();
        const videoPath = await categoryDownload(api, message, "xnxx", uniqueId, selectedMedia, quality);
        await sendMessageCompleteRequest(api, message, { 
          caption: `Video: ${input}`,
          videoPath
        }, 10*60_000);
        // categoryDownload tự động xóa videoPath
      }
    } catch (e) {
      logger("error", e?.message || e);
      await sendMessageWarningRequest(api, message, { 
        caption: `Lỗi xử lý link: ${e.message || "Không thể tải video"}` 
      }, 30000);
    }
    return 0;
  }

  try {
    const videos = await searchVideos(input, logger, { insecure: insecureFlag });
    if (!videos || videos.length === 0) {
      await sendMessageWarningRequest(api, message, { 
        caption: `Không tìm thấy kết quả cho "${input}"! Vui lòng thử từ khóa khác.` 
      }, 30000);
      return 0;
    }

    // Tạo danh sách video cho canvas
    const videosCustom = videos.map(video => ({
      title: video.title,
      uploader: video.uploader || "Không rõ",
      thumbnailM: video.thumbnail || null,
      duration: video.duration || "Không rõ",
      quality: video.quality || "Không rõ",
      views: video.views || "0"
    }));

    // Tạo hình ảnh kết quả tìm kiếm
    imagePath = await createSearchResultImage(videosCustom);
    logger("createSearchResultImage", { imagePath });

    const searchResultTxt = `🔍 Kết quả tìm kiếm "${input}":\nHãy trả lời tin nhắn này với số thứ tự (1-${videos.length}) để nhận video.${debug ? "\n🪵 Debug: Bật" : ""}${insecureFlag ? "\n⚠️ Insecure TLS: Bật" : ""}`;
    const sent = await sendMessageCompleteRequest(api, message, { 
      caption: searchResultTxt,
      imagePath: imagePath
    }, TIME_TO_SELECT);
    
    const quotedMsgId = sent?.message?.msgId?.toString() || sent?.attachment?.[0]?.msgId?.toString();
    if (!quotedMsgId) {
      logger("error", "Failed to get quotedMsgId");
      await sendMessageWarningRequest(api, message, { 
        caption: "Lỗi: Không thể gửi danh sách kết quả. Vui lòng thử lại." 
      }, 30000);
      return 0;
    }

    videoSelectionsMap.set(quotedMsgId, {
      userRequest: senderId,
      collection: videos,
      timestamp: Date.now(),
      threadId: threadId
    });
    setSelectionsMapData(senderId, {
      quotedMsgId: quotedMsgId,
      collection: videos,
      timestamp: Date.now(),
      platform: PLATFORM,
      threadId: threadId
    });
    logger("videoSelectionsMap set", { quotedMsgId, threadId, videos: videos.length });

  } catch (e) {
    logger("search error", e?.message || e);
    await sendMessageWarningRequest(api, message, { 
      caption: `Lỗi tìm kiếm: ${e.message || "Không thể tìm kiếm, vui lòng thử lại sau"}` 
    }, 30000);
  } finally {
    if (imagePath) {
      deleteFile(imagePath);
    }
  }
  return 0;
}

export async function handleXnxxReply(api, message) {
  const senderId = message.data.uidFrom;
  const threadId = message.threadId;
  const idBot = getBotId();
  const debug = false;
  const logger = getLogger(debug);

  logger("handleXnxxReply", { 
    senderId, 
    threadId, 
    messageData: JSON.stringify(message.data), 
    mapKeys: Array.from(videoSelectionsMap.keys()) 
  });

  try {
    // Kiểm tra xem tin nhắn có phải trả lời một tin nhắn hợp lệ không
    if (!message.data.quote || (!message.data.quote.globalMsgId && !message.data.quote.msgId)) {
      logger("ignore", { issue: "No quote or globalMsgId/msgId found, ignoring reply" });
      return false;
    }

    const quotedMsgId = message.data.quote.globalMsgId?.toString() || message.data.quote.msgId?.toString();
    const videoData = videoSelectionsMap.get(quotedMsgId);

    // Nếu quotedMsgId không tồn tại hoặc không liên quan đến lệnh !xnxx, bỏ qua
    if (!videoData) {
      logger("ignore", { issue: "Invalid or expired quotedMsgId, ignoring reply", quotedMsgId });
      return false;
    }

    let selection = removeMentionUtil(message).trim().replace(/[^\d]/g, '');
    const selectedIndex = parseInt(selection) - 1;

    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= videoData.collection.length) {
      logger("error", { issue: "Invalid selection index", selection, selectedIndex, max: videoData.collection.length });
      await sendMessageWarningRequest(api, message, {
        caption: `Vui lòng chọn số từ 1 đến ${videoData.collection.length}`,
      }, 30000);
      return true;
    }

    const video = videoData.collection[selectedIndex];
    logger("pick", { index: selectedIndex + 1, title: video.title, url: video.url });

    // Xóa tin nhắn danh sách gốc
    try {
      const msgDel = {
        type: message.type,
        threadId: message.threadId,
        data: {
          cliMsgId: message.data.quote.cliMsgId,
          msgId: message.data.quote.globalMsgId || message.data.quote.msgId,
          uidFrom: idBot,
        },
      };
      await api.deleteMessage(msgDel, false);
    } catch (e) {
      logger("warning", { issue: "Failed to delete message", error: e.message });
      // Tiếp tục xử lý dù xóa tin nhắn thất bại
    }

    // Xóa dữ liệu trong videoSelectionsMap
    videoSelectionsMap.delete(quotedMsgId);

    const waiting = await sendMessageCompleteRequest(api, message, {
      caption: `Đang tải video: ${video.title}`,
    }, 30000);

    const fileUrl = await fetchVideoUrl(video.url, logger);
    const size = await headContentLength(fileUrl, logger);
    if (size > 0 && size > MAX_SIZE_MB * 1024 * 1024) {
      const caption = `File quá lớn (${(size / (1024*1024)).toFixed(1)}MB). Link tải trực tiếp:\n${fileUrl}`;
      await sendMessageCompleteRequest(api, message, { caption }, 10*60_000);
    } else {
      try {
        const dataDownload = await getDataDownloadVideo(fileUrl);
        if (!dataDownload || !dataDownload.medias || dataDownload.medias.length === 0) {
          throw new Error("Không tìm thấy dữ liệu tải video từ API");
        }
        const selectedMedia = dataDownload.medias[0]; // Giả định video đầu tiên là video chính
        const quality = "default";
        const uniqueId = fileUrl.split('/').pop();
        const videoPath = await categoryDownload(api, message, "xnxx", uniqueId, selectedMedia, quality);
        await sendMessageCompleteRequest(api, message, { 
          caption: `Video: ${video.title}`,
          videoPath
        }, 10*60_000);
        // categoryDownload tự động xóa videoPath
      } catch (e) {
        logger("fallback to link", { error: e.message });
        const caption = `Không thể tải video. Link tải trực tiếp:\n${fileUrl}`;
        await sendMessageCompleteRequest(api, message, { caption }, 10*60_000);
      }
    }

    return true;
  } catch (error) {
    logger("reply error", { error: error.message, stack: error.stack });
    await sendMessageWarningRequest(api, message, {
      caption: `Đã xảy ra lỗi khi xử lý video: ${error.message || "Vui lòng thử lại sau"}`,
    }, 30000);
    return true;
  }
}