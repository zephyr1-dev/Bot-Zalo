import fs from "fs";
import path from "path";

import axios from "axios";
import { JSDOM } from "jsdom";
import schedule from "node-schedule";
import youtubedl from "youtube-dl-exec";
import { promisify } from "util";
import { Worker } from 'worker_threads';

import { MessageMention } from "../../../api-zalo/index.js";
import { deleteFile } from "../../../utils/util.js";
import { removeMention } from "../../../utils/format-util.js";
import { getGlobalPrefix } from "../../service.js";
import {
  sendMessageCompleteRequest,
  sendMessageProcessingRequest,
  sendMessageWarningRequest,
} from "../../chat-zalo/chat-style/chat-style.js";
import { sendVoiceMusic } from "../../chat-zalo/chat-special/send-voice/send-voice.js";
import { setSelectionsMapData } from "../index.js";
import { getCachedMedia, setCacheData } from "../../../utils/link-platform-cache.js";
import { getDurationVideo } from "../api-hoangdev/aio-downlink.js";
import { tempDir } from "../../../utils/io-json.js";
import { createSearchResultImage } from "../spotify/search-canvas.js";
import { getBotId, isAdmin } from "../../../index.js";
import { uploadAudioFile } from "../../chat-zalo/chat-special/send-voice/process-audio.js";

// Author: debug
// Description: Code get data youtube by HA HUY HOANG

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
  'Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
];

const CONFIG = {
  baseUrl: 'https://www.youtube.com',
  searchPath: '/results',
  headers: {
    'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
    'Accept-Language': 'en-US,en;q=0.9',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  },
  maxResults: 10,
  timeWaitSelection: 60000,
};
const PLATFORM = "youtube";
export const audioFormat = "bestaudio[ext=aac]/bestaudio[ext=m4a]/bestaudio";
const videoFormat360 = "bestvideo[height<=360][vcodec^=avc1]+bestaudio/best[height<=360][vcodec^=avc1]";
const videoFormat720 = "bestvideo[height<=720][fps<=60][vcodec^=avc1]+bestaudio/best[height<=720][fps<=60][vcodec^=avc1]";
const videoFormat1080 = "bestvideo[height<=1080][fps<=60][vcodec^=avc1]+bestaudio/best[height<=1080][fps<=60][vcodec^=avc1]";
const videoFormatMax = "bestvideo[vcodec^=avc1]+bestaudio/best[vcodec^=avc1]";

const extractInitialData = (html) => {
  try {
    const dom = new JSDOM(html);
    const scripts = dom.window.document.getElementsByTagName("script");

    for (const script of scripts) {
      const content = script.textContent;
      if (content.includes("var ytInitialData = ")) {
        const startIndex = content.indexOf("var ytInitialData = ") + "var ytInitialData = ".length;
        const endIndex = content.indexOf("};", startIndex);

        if (startIndex === -1 || endIndex === -1) continue;

        let jsonStr = content.substring(startIndex, endIndex + 1);

        jsonStr = jsonStr.replace(/\\x[0-9A-Fa-f]{2}/g, "");
        jsonStr = jsonStr.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

        try {
          return JSON.parse(jsonStr);
        } catch (parseError) {
          console.error("Lỗi parse JSON:", parseError);
          const ytDataRegex = /ytInitialData\s*=\s*({.+?});\s*</;
          const match = content.match(ytDataRegex);
          if (match && match[1]) {
            return JSON.parse(match[1]);
          }
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Lỗi khi parse dữ liệu YouTube:", error);
    return null;
  }
};

const parseVideoInfo = (item) => {
  try {
    const videoRenderer = item.videoRenderer;
    if (!videoRenderer) return null;

    return {
      videoId: videoRenderer.videoId,
      title: videoRenderer.title?.runs?.[0]?.text || "",
      thumbnail: videoRenderer.thumbnail?.thumbnails?.[0]?.url || "",
      duration: videoRenderer.lengthText?.simpleText || "",
      viewCount: videoRenderer.viewCountText?.simpleText || "",
      publishedTime: videoRenderer.publishedTimeText?.simpleText || "",
      channelName: videoRenderer.ownerText?.runs?.[0]?.text || "",
      channelId: videoRenderer.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || "",
      description: videoRenderer.descriptionSnippet?.runs?.[0]?.text || "",
      url: `https://www.youtube.com/watch?v=${videoRenderer.videoId}`,
    };
  } catch (error) {
    console.error("Lỗi khi parse thông tin video:", error);
    return null;
  }
};

export const searchYouTube = async (query) => {
  try {
    const searchUrl = `${CONFIG.baseUrl}${CONFIG.searchPath}?search_query=${encodeURIComponent(query)}`;

    const response = await axios.get(searchUrl, {
      headers: {
        ...CONFIG.headers,
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        Expires: "0",
      },
      timeout: 10000,
    });

    validateYouTubeResponse(response);

    const initialData = extractInitialData(response.data);
    if (!initialData) throw new Error("Không thể lấy được dữ liệu từ YouTube");

    const items =
      initialData.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]
        ?.itemSectionRenderer?.contents || [];

    const videos = items.map(parseVideoInfo).filter((video) => video !== null && video.videoId && video.title);

    if (videos.length === 0) {
      throw new Error("Không tìm thấy video nào");
    }

    return videos;
  } catch (error) {
    console.error("Lỗi khi tìm kiếm video YouTube:", error.message);
    return [];
  }
}

export const downloadYoutubeVideo = (videoUrl, videoId, format) => {
  return new Promise((resolve, reject) => {
    try {
      const ext = format === audioFormat ? "aac" : "mp4";
      const videoPath = path.join(tempDir, `youtube_${videoId}_${Date.now()}.${ext}`);

      const worker = new Worker(
        new URL('./youtube-download-worker.js', import.meta.url),
        {
          workerData: {
            videoUrl,
            videoPath,
            format
          }
        }
      );

      worker.on('message', (result) => {
        if (result.success) {
          resolve(result.videoPath);
        } else {
          reject(new Error(result.error));
        }
      });

      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });

    } catch (error) {
      reject(error);
    }
  });
};

const convertDurationToMs = (duration) => {
  try {
    const parts = duration.split(":").reverse();
    let ms = 0;

    if (parts[0]) ms += parseInt(parts[0]) * 1000;
    if (parts[1]) ms += parseInt(parts[1]) * 60 * 1000;
    if (parts[2]) ms += parseInt(parts[2]) * 60 * 60 * 1000;

    return ms;
  } catch (error) {
    console.error("Lỗi khi chuyển đổi thời lượng:", error);
    return 0;
  }
};

const videoSelectionsMap = new Map();

schedule.scheduleJob("*/5 * * * * *", () => {
  const currentTime = Date.now();
  for (const [msgId, data] of videoSelectionsMap.entries()) {
    if (currentTime - data.timestamp > CONFIG.timeWaitSelection) {
      videoSelectionsMap.delete(msgId);
    }
  }
});

const extractYoutubeUrl = (text) => {
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)(?:\S+)?/i;
  const match = text.match(youtubeRegex);
  return match ? match[0] : null;
};

export const extractYoutubeId = (url) => {
  try {
    let uniqueId = null;

    if (url.includes("?v=")) uniqueId = url.split("?v=")[1];

    if (!uniqueId) {
      const match = url.match(/youtu\.be\/([^?]+)/);
      uniqueId = match ? match[1] : null;
    }

    if (!uniqueId) {
      if (url.includes("/shorts/")) uniqueId = url.split("/shorts/")[1];
      if (uniqueId && uniqueId.includes("?")) {
        uniqueId = uniqueId.split("?")[0];
      }
    }

    if (uniqueId && uniqueId.includes("&")) {
      uniqueId = uniqueId.split("&")[0];
    }

    return uniqueId;
  } catch (error) {
    console.error("Lỗi khi tách YouTube ID:", error);
    return url;
  }
};

export async function handleYoutubeCommand(api, message, aliasCommand) {
  const content = removeMention(message);
  const senderId = message.data.uidFrom;
  const prefix = getGlobalPrefix();
  const isAdminLevelHigh = isAdmin(senderId);
  let imagePath = null;

  try {
    const keyword = content.replace(`${prefix}${aliasCommand}`, "").trim();

    if (!keyword) {
      const object = {
        caption: `Vui lòng nhập từ khóa tìm kiếm hoặc link\nVí dụ:\n${prefix}${aliasCommand} Nội Dung Cần Tìm`,
      };
      return await sendMessageCompleteRequest(api, message, object, 30000);
    }

    const [query, typeVideo = "normal"] = keyword.split(" ");

    const url = extractYoutubeUrl(query);
    if (url) {
      const object = {
        caption: "Đang xử lý dữ liệu từ link...",
      };
      await sendMessageProcessingRequest(api, message, object, 5000);

      try {
        const videoInfo = await getYoutubeVideoInfo(url);
        if (!videoInfo) {
          throw new Error("Không thể lấy thông tin video");
        }

        const durationMs = videoInfo.duration * 1000;
        if (!isAdminLevelHigh && durationMs > 30 * 60 * 1000) {
          const object = {
            caption: "Vì tài nguyên có hạn, Không thể lấy video có độ dài hơn 30 phút!\n" +
              `Vui lòng truy cập vào link sau để xem đầy đủ: ${url}`,
          };
          return await sendMessageWarningRequest(api, message, object, 30000);
        }

        const { format, qualityText, timeNotify } = getVideoFormat(typeVideo);

        const cachedVideo = await getCachedMedia(PLATFORM, videoInfo.videoId, qualityText, videoInfo.title);
        let videoUrl;
        let duration = null;

        if (cachedVideo) {
          videoUrl = cachedVideo.fileUrl;
          duration = cachedVideo.duration;
        } else {
          const object = {
            caption:
              `Chờ bé lấy ${qualityText === "audio" ? "nhạc" : "video"} một chút, xong bé gọi cho hay.\n\n` +
              `⏳ ${videoInfo.title}\n📊 Chất lượng: ${qualityText}`,
          };
          await sendMessageProcessingRequest(api, message, object, timeNotify);

          let videoPath = null;
          try {
            videoPath = await downloadYoutubeVideo(videoInfo.url, videoInfo.videoId, format);
            if (!fs.existsSync(videoPath)) {
              throw new Error(`Không thể tải video : ${videoPath}`);
            }

            if (format === audioFormat) {
              videoUrl = await uploadAudioFile(videoPath, api, message);
            } else {
              const uploadVideo = await api.uploadAttachment([videoPath], message.threadId, message.type);
              videoUrl = uploadVideo[0].fileUrl;
            }

            duration = await getDurationVideo(videoPath);

            setCacheData(PLATFORM, videoInfo.videoId, { fileUrl: videoUrl, title: videoInfo.title, duration }, qualityText);
          } catch (error) {
            console.error("Lỗi khi lấy thông tin video:", error);
          } finally {
            if (videoPath) await deleteFile(videoPath);
          }
        }

        if (format === audioFormat) {
          const object = {
            trackId: videoInfo.videoId,
            title: videoInfo.title,
            artists: videoInfo.channelName,
            source: "Youtube",
            caption: `> From Youtube <\nNhạc Bạn Chọn Đây!!!`,
            imageUrl: videoInfo.thumbnail,
            voiceUrl: videoUrl,
            viewCount: videoInfo.viewCount,
            like: videoInfo.likeCount,
            publishedTime: convertPublishedTimeToVietnamese(videoInfo.publishedTime),
          };
          await sendVoiceMusic(api, message, object, 60000*60*2);
        } else {
          await api.sendVideo({
            videoUrl: videoUrl,
            threadId: message.threadId,
            threadType: message.type,
            thumbnail: videoInfo.thumbnail,
            duration,
            message: {
              text:
                `[ ${message.data.dName} ] \n🎵 Tiêu Đề: ${videoInfo.title}\n` +
                `📺 Kênh: ${videoInfo.channelName}\n👀 Lượt Xem: ${videoInfo.viewCount.replace("views", "")}\n` +
                `📅 Ngày Đăng: ${convertPublishedTimeToVietnamese(videoInfo.publishedTime)}\n📊 Chất Lượng: ${qualityText}` +
                `\n[ Watch More On Youtube ]`,
              mentions: [MessageMention(senderId, message.data.dName.length, 2, false)],
            },
            ttl: isAdminLevelHigh ? 14400000 : 3600000,
          });
        }

        return true;
      } catch (error) {
        console.error("Lỗi khi xử lý URL video:", error);
        const object = {
          caption: "Có lỗi xảy ra khi xử lý video từ URL!",
        };
        await sendMessageWarningRequest(api, message, object, 30000);
      }
      return;
    }

    const [searchQuery, numberVideo = 30] = keyword.split("&&");

    let videos = await searchYouTube(searchQuery);

    let limit = parseInt(numberVideo) || CONFIG.maxResults;
    videos = videos.filter((video) => video.duration !== "").slice(0, limit);

    if (videos.length === 0) {
      const object = {
        caption: `Không tìm thấy video phù hợp với cụm từ: ${searchQuery}`
      };
      return await sendMessageWarningRequest(api, message, object, 30000);
    }

    let videoListText = "Đây là danh sách video tôi tìm thấy từ Youtube:\n";
    videoListText += "Hãy trả lời tin nhắn này với số thứ tự video bạn muốn xem!\n";
    videoListText += "\nVD: 1 hoặc 1 audio";

    imagePath = await createSearchResultImage(videos.map(video => ({
      title: video.title,
      artistsNames: video.channelName,
      thumbnailM: video.thumbnail,
      view: video.viewCount,
      publishedTime: video.publishedTime
    })));

    const object = {
      caption: videoListText,
      imagePath: imagePath,
    };

    const listMessage = await sendMessageCompleteRequest(api, message, object, CONFIG.timeWaitSelection);

    const quotedMsgId = listMessage?.message?.msgId || listMessage?.attachment[0]?.msgId;

    videoSelectionsMap.set(quotedMsgId.toString(), {
      userRequest: senderId,
      collection: videos,
      timestamp: Date.now(),
    });
    setSelectionsMapData(senderId, {
      quotedMsgId: quotedMsgId.toString(),
      collection: videos,
      timestamp: Date.now(),
      platform: PLATFORM,
    });
  } catch (error) {
    console.error("Lỗi khi xử lý lệnh YouTube:", error);
    const object = {
      caption: "Có lỗi xảy ra khi xử lý video!",
    };
    await sendMessageWarningRequest(api, message, object, 30000);
  } finally {
    if (imagePath) deleteFile(imagePath);
  }
}

export const getVideoFormatByQuality = (qualityParam) => {
  switch (qualityParam.toLowerCase()) {
    case "360p":
      return getVideoFormat("low");
    case "1080p":
      return getVideoFormat("high");
    case "max":
      return getVideoFormat("max");
    case "audio":
      return getVideoFormat("audio");
    default:
      return getVideoFormat("default");
  }
};

export const getVideoFormat = (qualityParam) => {
  switch (qualityParam.toLowerCase()) {
    case "audio":
      return {
        format: audioFormat,
        qualityText: "audio",
        timeNotify: 8000,
      };
    case "low":
      return {
        format: videoFormat360,
        qualityText: "360p",
        timeNotify: 8000,
      };
    case "high":
      return {
        format: videoFormat1080,
        qualityText: "1080p",
        timeNotify: 16000,
      };
    case "max":
      return {
        format: videoFormatMax,
        qualityText: "Cao nhất",
        timeNotify: 24000,
      };
    default:
      return {
        format: videoFormat720,
        qualityText: "720p",
        timeNotify: 10000,
      };
  }
};

export async function handleYoutubeReply(api, message) {
  const senderId = message.data.uidFrom;
  const isAdminLevelHigh = isAdmin(senderId);
  const idBot = getBotId();
  const senderName = message.data.dName;

  try {
    if (!message.data.quote || !message.data.quote.globalMsgId) return false;

    const quotedMsgId = message.data.quote.globalMsgId.toString();
    if (!videoSelectionsMap.has(quotedMsgId)) return false;

    const videoData = videoSelectionsMap.get(quotedMsgId);
    if (videoData.userRequest !== senderId) return false;

    const content = removeMention(message);
    const [index, qualityParam = "default"] = content.split(" ");
    const selectedIndex = parseInt(index) - 1;

    if (isNaN(selectedIndex)) {
      const object = {
        caption: `Lựa chọn Không hợp lệ. Vui lòng chọn một số từ danh sách.\nCú pháp: <số> [low/high/audio]\nVí dụ:\n1 - Chất lượng 720p\n1 low - Chất lượng 360p\n1 high - Chất lượng cao nhất\n1 audio - Chỉ tải âm thanh`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return true;
    }

    const { collection } = videoSelectionsMap.get(quotedMsgId);
    if (selectedIndex < 0 || selectedIndex >= collection.length) {
      const object = {
        caption: `Số bạn chọn Không nằm trong danh sách. Vui lòng chọn lại.`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return true;
    }

    const video = collection[selectedIndex];
    const durationMs = convertDurationToMs(video.duration);
    if (!isAdminLevelHigh && durationMs > 30 * 60 * 1000) {
      const object = {
        caption: "Vì tài nguyên có hạn, Không thể lấy video có độ dài hơn 30 phút!\n" +
          `Vui lòng chọn lại video khác hoặc truy cập vào link sau để xem đầy đủ: ${video.url}`,
      };
      return await sendMessageWarningRequest(api, message, object, 30000);
    }

    let videoPath = null;
    try {
      const msgDel = {
        type: message.type,
        threadId: message.threadId,
        data: {
          cliMsgId: message.data.quote.cliMsgId,
          msgId: message.data.quote.globalMsgId,
          uidFrom: idBot,
        },
      };
      await api.deleteMessage(msgDel, false);
      // await api.undoMessage(message);
      videoSelectionsMap.delete(quotedMsgId);

      return await handleSendMediaYoutube(api, message, video, qualityParam, videoPath, isAdminLevelHigh);
    } catch (error) {
      if (videoPath) await deleteFile(videoPath);
      console.error("Lỗi khi tải video:", error);
      const object = {
        caption: "Có lỗi xảy ra khi xử lý video!",
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return true;
    }
  } catch (error) {
    console.error("Lỗi xử lý reply YouTube:", error);
    const object = {
      caption: `Đã xảy ra lỗi khi xử lý tin nhắn của bạn. Vui lòng thử lại sau.`,
    };
    await sendMessageWarningRequest(api, message, object, 30000);
    return true;
  }
}

const validateYouTubeResponse = (response) => {
  if (!response?.data) {
    throw new Error("Không nhận được dữ liệu từ YouTube");
  }

  if (!response.data.includes("ytInitialData")) {
    throw new Error("Không phải trang kết quả tìm kiếm YouTube");
  }

  return true;
};

const convertPublishedTimeToVietnamese = (publishedTime) => {
  if (!publishedTime) return "Không xác định";

  const timeMap = {
    "second ago": "giây trước",
    "seconds ago": "giây trước",
    "minute ago": "phút trước",
    "minutes ago": "phút trước",
    "hour ago": "giờ trước",
    "hours ago": "giờ trước",
    "day ago": "ngày trước",
    "days ago": "ngày trước",
    "week ago": "tuần trước",
    "weeks ago": "tuần trước",
    "month ago": "tháng trước",
    "months ago": "tháng trước",
    "year ago": "năm trước",
    "years ago": "năm trước",
  };

  let vietnameseTime = publishedTime;
  for (const [eng, viet] of Object.entries(timeMap)) {
    vietnameseTime = vietnameseTime.replace(eng, viet);
  }

  return vietnameseTime;
};

const formatUploadDateToTimeAgo = (uploadDate) => {
  try {
    if (!uploadDate || uploadDate.length !== 8) return "Không xác định";

    const year = parseInt(uploadDate.substring(0, 4));
    const month = parseInt(uploadDate.substring(4, 6)) - 1; // JS months are 0-based
    const day = parseInt(uploadDate.substring(6, 8));

    const uploadDateTime = new Date(year, month, day);
    const now = new Date();

    const diffTime = now - uploadDateTime;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 1) return "Hôm nay";
    if (diffDays === 1) return "Hôm qua";
    if (diffDays < 7) return `${diffDays} ngày trước`;

    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks} tuần trước`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} tháng trước`;

    const diffYears = Math.floor(diffDays / 365);
    return `${diffYears} năm trước`;
  } catch (error) {
    console.error("Lỗi khi format ngày tải lên:", error);
    return "Không xác định";
  }
};

export const getYoutubeVideoInfo = async (videoUrl) => {
  try {
    const options = {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true
    };

    const videoInfo = await youtubedl(videoUrl, options);

    if (!videoInfo) {
      throw new Error("Không thể lấy thông tin video");
    }

    return {
      videoId: videoInfo.id,
      title: videoInfo.title,
      description: videoInfo.description,
      duration: videoInfo.duration,
      thumbnail: videoInfo.thumbnail,
      viewCount: videoInfo.view_count.toString(),
      likeCount: videoInfo.like_count,
      commentCount: videoInfo.comment_count,
      channelId: videoInfo.channel_id,
      channelName: videoInfo.channel,
      publishedTime: formatUploadDateToTimeAgo(videoInfo.upload_date),
      categories: videoInfo.categories,
      tags: videoInfo.tags,
      isLive: videoInfo.is_live,
      url: videoInfo.webpage_url
    };
  } catch (error) {
    console.error("Lỗi khi lấy thông tin video:", error);
    throw new Error("Không thể lấy thông tin video: " + error.message);
  }
};

export async function handleSendMediaYoutube(api, message, video, qualityParam, videoPath, isAdminLevelHigh) {
  const { format, qualityText, timeNotify } = getVideoFormat(qualityParam);

  const cachedVideo = await getCachedMedia(PLATFORM, video.videoId, qualityText, video.title);
  let videoUrl;
  let duration = null;

  if (cachedVideo) {
    videoUrl = cachedVideo.fileUrl;
    duration = cachedVideo.duration;
  } else {
    const object = {
      caption:
        `Chờ bé lấy ${qualityText === "audio" ? "nhạc" : "video"} một chút, xong bé gọi cho hay.\n\n` +
        `⏳ ${video.title}\n📊 Chất lượng: ${qualityText}`,
    };
    await sendMessageProcessingRequest(api, message, object, timeNotify);

    videoPath = await downloadYoutubeVideo(video.url, video.videoId, format);
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Không thể tải video : ${videoPath}`);
    }

    if (format === audioFormat) {
      videoUrl = await uploadAudioFile(videoPath, api, message);
    } else {
      const uploadVideo = await api.uploadAttachment([videoPath], message.threadId, message.type);
      videoUrl = uploadVideo[0].fileUrl;
    }

    duration = await getDurationVideo(videoPath);

    setCacheData(PLATFORM, video.videoId, { fileUrl: videoUrl, title: video.title, duration }, qualityText);

    await deleteFile(videoPath);
  }

  if (format === audioFormat) {
    const object = {
      trackId: video.videoId,
      title: video.title,
      artists: video.channelName,
      source: "Youtube",
      caption: `> From Youtube <\nNhạc Bạn Chọn Đây!!!`,
      imageUrl: video.thumbnail,
      voiceUrl: videoUrl,
      viewCount: video.viewCount,
      publishedTime: convertPublishedTimeToVietnamese(video.publishedTime),
    };
    await sendVoiceMusic(api, message, object, 1800000);
  } else {
    await api.sendVideo({
      videoUrl: videoUrl,
      threadId: message.threadId,
      threadType: message.type,
      thumbnail: video.thumbnail,
      duration,
      message: {
        text:
          `[ ${message.data.dName} ] \n🎵 Tiêu Đề: ${video.title}\n` +
          `📺 Kênh: ${video.channelName}\n👀 Lượt Xem: ${video.viewCount.replace("views", "")}\n` +
          `📅 Ngày Đăng: ${convertPublishedTimeToVietnamese(video.publishedTime)}\n📊 Chất Lượng: ${qualityText}` +
          `\n[ Watch More On Youtube ]`,
        // mentions: [MessageMention(senderId, senderName.length, 2, false)],
      },
      ttl: isAdminLevelHigh ? 14400000 : 3600000,
    });
  }

  return true;
}

