import axios from "axios";
import path from "path";
import fs from "fs";
import { getGlobalPrefix } from "../../service.js";
import { MessageMention } from "../../../api-zalo/index.js";
import {
  sendMessageCompleteRequest,
  sendMessageProcessingRequest,
  sendMessageWarningRequest,
} from "../../chat-zalo/chat-style/chat-style.js";
import { downloadFile, deleteFile } from "../../../utils/util.js";
import { sendVoiceMusic } from "../../chat-zalo/chat-special/send-voice/send-voice.js";
import { capitalizeEachWord, removeMention } from "../../../utils/format-util.js";
import { setSelectionsMapData } from "../index.js";
import { getCachedMedia, setCacheData } from "../../../utils/link-platform-cache.js";
import { downloadYoutubeVideo, extractYoutubeId, getVideoFormatByQuality } from "../youtube/youtube-service.js";
import { clearImagePath } from "../../../utils/canvas/index.js";
import { tempDir } from "../../../utils/io-json.js";
import { getBotId } from "../../../index.js";

const { execSync } = await import("child_process");

export const API_KEY_HOANGDEV = "hoangdev.debug";
export const API_URL_DOWNAIO_HOANGDEV = "https://hoangdev.io.vn/Aio/aio-download";

const MEDIA_TYPES = {
  "tiktok.": "tiktok",
  "douyin.": "douyin",
  "capcut.": "capcut",
  "threads.": "threads",
  "instagram.": "instagram",
  "facebook.": "facebook",
  "fb.": "facebook",
  "espn.": "espn",
  "pinterest.": "pinterest",
  "imdb.": "imdb",
  "imgur.": "imgur",
  "ifunny.": "ifunny",
  "izlesene.": "izlesene",
  "reddit.": "reddit",
  "youtube.": "youtube",
  "youtu.": "youtube",
  "twitter.": "twitter",
  "x.com": "twitter",
  "vimeo.": "vimeo",
  "snapchat.": "snapchat",
  "bilibili.": "bilibili",
  "dailymotion.": "dailymotion",
  "sharechat.": "sharechat",
  "likee.": "likee",
  "linkedin.": "linkedin",
  "tumblr.com": "tumblr",
  "hipi.co.in": "hipi",
  "t.me": "telegram",
  "telegram.": "telegram",
  "getstickerpack.com": "getstickerpack",
  "bitchute.com": "bitchute",
  "febspot.com": "febspot",
  "9gag.com": "9gag",
  "ok.ru": "oke",
  "oke.ru": "oke",
  "vk.com": "vk-vkvideo",
  "vk.ru": "vk-vkvideo",
  "vkvideo.": "vk-vkvideo",
  "rumble.com": "rumble",
  "streamable.com": "streamable",
  "ted.com": "ted",
  "tv.sohu.com": "sohutv",
  "sohu.com": "sohutv",
  "xvideos.": "xvideos",
  "xnxx.": "xnxx",
  "pornbox.": "pornbox",
  "xiaohongshu.": "xiaohongshu",
  "ixigua.": "ixigua",
  "weibo.": "weibo",
  "sina.com": "sina",
  "miaopai.": "miaopai",
  "meipai.": "meipai",
  "xiaoying.tv": "xiaoying",
  "national.video": "national",
  "yingke.": "yingke",
  "soundcloud.": "soundcloud",
  "mixcloud.": "mixcloud",
  "spotify.": "spotify",
  "deezer.": "deezer",
  "zingmp3.vn": "zingmp3",
  "bandcamp.": "bandcamp",
  "kuaishou.": "kuaishou",
  "qq.": "qq",
  "bluesky.": "bluesky",
};

const getMediaType = (url) => {
  const urlLower = url.toLowerCase();
  return Object.entries(MEDIA_TYPES).find(([domain]) => urlLower.includes(domain))?.[1] || null;
};

const extractFacebookId = (url) => {
  let uniqueId;
  if (url.includes("/v/")) uniqueId = url.split("/v/")[1];
  if (url.includes("/r/")) uniqueId = url.split("/r/")[1];
  if (uniqueId) uniqueId = uniqueId.replace("/", '');
  if (!uniqueId) uniqueId = url;
  return uniqueId;
};

export const getDurationVideo = async (path) => {
  const durationCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${path}"`;
  const duration = parseFloat(execSync(durationCmd).toString()) * 1000;
  return duration;
};

export const getDataDownloadVideo = async (url) => {
  try {
    const response = await axios.get(`${API_URL_DOWNAIO_HOANGDEV}?apikey=${API_KEY_HOANGDEV}&url=${encodeURIComponent(url)}`, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (response.data && response.data.success && response.data.data) {
      return response.data.data;
    }
    return null;
  } catch (error) {
    console.error("Lỗi khi tải video:", error);
    return null;
  }
};

const typeText = (type) => {
  switch (type) {
    case "video":
      return "video";
    case "audio":
      return "nhạc";
    case "image":
      return "ảnh";
    default:
      return "tập tin";
  }
}

const downloadSelectionsMap = new Map();
const TIME_WAIT_SELECTION = 30000;

export async function processAndSendMedia(api, message, mediaData, isMultipleImages = false) {
  const {
    selectedMedia,
    mediaType,
    uniqueId,
    duration,
    title,
    author,
    senderId,
    senderName
  } = mediaData;

  const quality = selectedMedia.quality || "default";
  const typeFile = selectedMedia.type.toLowerCase();

  if (typeFile === "image") {
    const thumbnailPath = path.resolve(tempDir, `${uniqueId}.${selectedMedia.extension}`);
    const thumbnailUrl = selectedMedia.url;

    if (thumbnailUrl) {
      let retryCount = 0;
      const maxRetries = 3;
      let downloadSuccess = false;
      
      while (retryCount < maxRetries && !downloadSuccess) {
        try {
          await downloadImageWithTimeout(thumbnailUrl, thumbnailPath, 30000);
          downloadSuccess = true;
        } catch (downloadError) {
          retryCount++;
          console.error(`Lỗi tải ảnh lần ${retryCount}:`, downloadError.message);
          if (retryCount >= maxRetries) {
            throw downloadError;
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    }

    await api.sendMessage({
      msg: `[ ${senderName} ]\n\n👤 Author: ${author}\n🖼️ Caption: ${title}`,
      attachments: [thumbnailPath],
      mentions: [MessageMention(senderId, senderName.length, 2, false)],
      ttl: 3600000,
    }, message.threadId, message.type);

    if (selectedMedia.voiceUrl) {
      try {
        const voicePath = path.resolve(tempDir, `voice_${Date.now()}.mp3`);
        
        let retryCount = 0;
        const maxRetries = 3;
        let downloadSuccess = false;
        
        while (retryCount < maxRetries && !downloadSuccess) {
          try {
            await downloadVoiceWithTimeout(selectedMedia.voiceUrl, voicePath, 30000);
            downloadSuccess = true;
          } catch (downloadError) {
            retryCount++;
            console.error(`Lỗi tải voice lần ${retryCount}:`, downloadError.message);
            if (retryCount >= maxRetries) {
              throw downloadError;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        if (downloadSuccess) {
          const uploadResult = await api.uploadAttachment([voicePath], message.threadId, message.type);
          const voiceUrl = uploadResult[0].fileUrl;
          
          if (voiceUrl) {
            await api.sendVoice(message, voiceUrl, 3600000);
          }
        }
        
        await deleteFile(voicePath);
      } catch (error) {
        console.error("Lỗi khi tải và gửi voice:", error);
      }
    }

    if (thumbnailUrl) {
      await clearImagePath(thumbnailPath);
    }
    return;
  }

  if ((mediaType === "youtube" || mediaType === "instagram") && duration) {
    if (duration * 1000 > 60 * 60 * 1000) {
      const object = {
        caption: "Vì tài nguyên có hạn, Không thể lấy video có độ dài hơn 60 phút!\nVui lòng chọn video khác.",
      };
      return await sendMessageWarningRequest(api, message, object, 30000);
    }
  }

  const cachedMedia = await getCachedMedia(mediaType, uniqueId, quality, title);
  let videoUrl;

  if (cachedMedia) {
    videoUrl = cachedMedia.fileUrl;
  } else {
    if (!isMultipleImages) {
      const object = {
        caption: `Chờ bé lấy ${typeText(typeFile)} một chút, xong bé gọi cho hay.\n\n⏳ ${title}\n📊 Chất lượng: ${quality}`,
      };
      await sendMessageProcessingRequest(api, message, object, 8000);
    }

    videoUrl = await categoryDownload(api, message, mediaType, uniqueId, selectedMedia, quality);
    if (!videoUrl) {
      const object = {
        caption: `Không tải được dữ liệu...`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return;
    }
  }

  if (typeFile === "audio") {
    try {
      const audioPath = path.resolve(tempDir, `audio_${Date.now()}.${selectedMedia.extension || 'mp3'}`);
      
      let retryCount = 0;
      const maxRetries = 3;
      let downloadSuccess = false;
      
      while (retryCount < maxRetries && !downloadSuccess) {
        try {
          await downloadVoiceWithTimeout(videoUrl, audioPath, 30000);
          downloadSuccess = true;
        } catch (downloadError) {
          retryCount++;
          console.error(`Lỗi tải audio lần ${retryCount}:`, downloadError.message);
          if (retryCount >= maxRetries) {
            throw downloadError;
                      }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
              if (downloadSuccess) {
          const uploadResult = await api.uploadAttachment([audioPath], message.threadId, message.type);
          const audioUrl = uploadResult[0].fileUrl;
          
          if (audioUrl) {
            await api.sendVoice(message, audioUrl, 3600000);
          }
        }
        
        await deleteFile(audioPath);
    } catch (error) {
      console.error("Lỗi khi xử lý audio:", error);
      await api.sendMessage({
        msg: `Không thể tải audio từ ${capitalizeEachWord(mediaType)}`,
        ttl: 30000,
      }, message.threadId, message.type);
    }
  } else if (typeFile === "video") {
    await api.sendVideo({
      videoUrl: videoUrl,
      threadId: message.threadId,
      threadType: message.type,
      thumbnail: selectedMedia.thumbnail,
      message: {
        text:
          `[ ${senderName} ]\n` +
          `🎥 Nền Tảng: ${capitalizeEachWord(mediaType)}\n` +
          `🎬 Tiêu Đề: ${title}\n` +
          `${author && author !== "Unknown Author" ? `👤 Người Đăng: ${author}\n` : ""}` +
          `📊 Chất lượng: ${quality}`,
        mentions: [MessageMention(senderId, senderName.length, 2, false)],
      },
      ttl: 3600000,
    });
  }
}

export async function processAndSendMultipleImages(api, message, images, mediaData) {
  const {
    mediaType,
    title,
    author,
    senderId,
    senderName
  } = mediaData;

  const imagePaths = [];
  
  try {
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const imagePath = path.resolve(tempDir, `${Date.now()}_${i}.${image.extension}`);
      
      let retryCount = 0;
      const maxRetries = 3;
      let downloadSuccess = false;
      
      while (retryCount < maxRetries && !downloadSuccess) {
        try {
          await downloadImageWithTimeout(image.url, imagePath, 30000);
          downloadSuccess = true;
        } catch (downloadError) {
          retryCount++;
          console.error(`Lỗi tải ảnh lần ${retryCount}:`, downloadError.message);
          if (retryCount >= maxRetries) {
            throw downloadError;
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      if (downloadSuccess) {
        imagePaths.push(imagePath);
      }
    }

    await api.sendMessage({
      msg: `[ ${senderName} ]\n\n👤 Author: ${author}\n🖼️ Caption: ${title}`,
      attachments: imagePaths,
      mentions: [MessageMention(senderId, senderName.length, 2, false)],
      ttl: 3600000,
    }, message.threadId, message.type);

  } finally {
    for (const imagePath of imagePaths) {
      await clearImagePath(imagePath);
    }
  }
}

export async function handleDownloadCommand(api, message, aliasCommand) {
  const content = removeMention(message);
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const prefix = getGlobalPrefix();

  try {
    const query = content.replace(`${prefix}${aliasCommand}`, "").trim();

    if (!query) {
      const object = {
        caption: `Vui lòng nhập link cần tải\nVí dụ:\n${prefix}${aliasCommand} <link>`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return;
    }

    const mediaType = getMediaType(query);
    if (!mediaType) {
      const object = {
        caption: `Link này em chưa hỗ trợ tải dữ liệu.`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return;
    }
    
    let dataDownload = await getDataDownloadVideo(query);
    if (!dataDownload || dataDownload.error) {
      const object = {
        caption: `Link Không hợp lệ hoặc Không hỗ trợ tải dữ liệu link dạng này.`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return;
    }
    const dataLink = [];
    let uniqueId;

    switch (mediaType) {
      case "tiktok":
        uniqueId = (dataDownload.title || dataDownload.url || "unknown").replace(/#\w+/g, (match) => match.toLowerCase());
        dataDownload.medias.forEach((item) => {
          dataLink.push({
            url: item.url,
            quality: item.quality,
            type: item.type,
            title: dataDownload.title,
            thumbnail: item.thumbnail || dataDownload.thumbnail,
            extension: item.extension,
            voiceUrl: dataDownload.music?.url || dataDownload.voice?.url || null,
          });
        });
        break;
      case "douyin":
        uniqueId = (dataDownload.title || dataDownload.url || "unknown").replace(/#\w+/g, (match) => match.toLowerCase());
        dataDownload.medias.forEach((item) => {
          if (item.quality.toLowerCase() === "no watermark") {
            dataLink.push({
              url: item.url,
              quality: item.quality,
              type: item.type,
              title: dataDownload.title,
              thumbnail: item.thumbnail || dataDownload.thumbnail,
              extension: item.extension,
              voiceUrl: dataDownload.music?.url || dataDownload.voice?.url || null,
            });
          }
        });
        break;
      case "youtube":
        uniqueId = extractYoutubeId(dataDownload.url);
        dataDownload.medias.forEach((item) => {
          dataLink.push({
            url: item.url,
            quality: item.quality || item.label || "Unknown",
            type: item.type,
            title: dataDownload.title,
            thumbnail: dataDownload.thumbnail,
            extension: item.extension || item.ext || "mp4",
            voiceUrl: dataDownload.music?.url || dataDownload.voice?.url || null,
          });
        });
        break;
      case "facebook":
        uniqueId = extractFacebookId(dataDownload.url);
        dataDownload.medias.forEach((item) => {
          if (item.quality.toLowerCase() === "hd") {
            dataLink.push({
              url: item.url,
              quality: item.quality,
              type: item.type,
              title: dataDownload.title,
              thumbnail: item.thumbnail || dataDownload.thumbnail,
              extension: item.extension,
              voiceUrl: dataDownload.music?.url || dataDownload.voice?.url || null,
            });
          }
        });
        break;
      case "threads":
        uniqueId = (dataDownload.author + dataDownload.title) || dataDownload.url || "unknown";
        dataDownload.medias.forEach((item) => {
          dataLink.push({
            url: item.url,
            quality: item.quality,
            type: item.type,
            title: dataDownload.title,
            thumbnail: item.thumbnail || item.url,
            extension: item.extension,
            voiceUrl: dataDownload.music?.url || dataDownload.voice?.url || null,
          });
        });
        break;
      case "instagram":
        uniqueId = dataDownload.url || dataDownload.title || "unknown";
        dataDownload.medias.forEach((item) => {
          dataLink.push({
            url: item.url,
            quality: item.quality,
            type: item.type,
            title: dataDownload.title,
            thumbnail: item.thumbnail || dataDownload.thumbnail,
            extension: item.extension,
            voiceUrl: dataDownload.music?.url || dataDownload.voice?.url || null,
          });
        });
        break;
      case "spotify":
      case "telegram":
      case "dailymotion":
      case "likee":
      case "sina":
      case "ixigua":
      case "vk-vkvideo":
      case "oke":
      case "deezer":
      case "kuaishou":
      case "qq":
      case "bluesky":
      case "pornbox":
        uniqueId = (dataDownload.url && dataDownload.url.split("/").pop()) || dataDownload.title || "unknown";
        dataDownload.medias.forEach((item) => {
          dataLink.push({
            url: item.url,
            quality: item.quality,
            type: item.type,
            title: dataDownload.title,
            thumbnail: item.thumbnail || dataDownload.thumbnail,
            extension: item.extension,
            voiceUrl: dataDownload.music?.url || dataDownload.voice?.url || null,
          });
        });
        break;
      default:
        uniqueId = (dataDownload.url && dataDownload.url.split("/").pop()) || dataDownload.title || "unknown";
        dataDownload.medias.forEach((item) => {
          dataLink.push({
            url: item.url,
            quality: item.quality,
            type: item.type,
            title: dataDownload.title,
            thumbnail: item.thumbnail || dataDownload.thumbnail,
            extension: item.extension,
            voiceUrl: dataDownload.music?.url || dataDownload.voice?.url || null,
          });
        });
        break;
    }

    if (dataLink.length === 0) {
      const object = {
        caption: `Không tìm thấy dữ liệu tải về phù hợp cho link này!\nVui lòng thử lại với link khác.`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return;
    }

    const images = dataLink.filter(item => item.type.toLowerCase() === 'image');
    const voices = dataLink.filter(item => item.type.toLowerCase() === 'audio');
    const videos = dataLink.filter(item => item.type.toLowerCase() === 'video');
    const others = dataLink.filter(item => !['image', 'audio', 'video'].includes(item.type.toLowerCase()));

    if (images.length > 0) {
      await processAndSendMultipleImages(api, message, images, {
        mediaType,
        uniqueId,
        duration: dataDownload.duration,
        title: dataDownload.title,
        author: dataDownload.author,
        senderId,
        senderName
      });
    }

    if (voices.length > 0) {
      for (const voice of voices) {
        await processAndSendMedia(api, message, {
          selectedMedia: voice,
          mediaType,
          uniqueId,
          duration: dataDownload.duration,
          title: dataDownload.title,
          author: dataDownload.author,
          senderId,
          senderName
        }, true);
      }
    }

    if (videos.length === 0 && others.length === 0) {
      return;
    }

    const remainingItems = [...videos, ...others];
    if (remainingItems.length === 1) {
      await processAndSendMedia(api, message, {
        selectedMedia: remainingItems[0],
        mediaType,
        uniqueId,
        duration: dataDownload.duration,
        title: dataDownload.title,
        author: dataDownload.author,
        senderId,
        senderName
      });
      return;
    }

    let listText = `Đây là danh sách các phiên bản có sẵn:\n`;
    listText += `Hãy trả lời tin nhắn này với số thứ tự phiên bản bạn muốn tải!\n\n`;
    listText += remainingItems
      .map((item, index) => `${index + 1}. ${item.type} - ${item.quality || "Unknown"} (${item.extension})`)
      .join("\n");

    const object = {
      caption: listText,
    };

    const listMessage = await sendMessageCompleteRequest(api, message, object, TIME_WAIT_SELECTION);
    const quotedMsgId = listMessage?.message?.msgId || listMessage?.attachment[0]?.msgId;
    downloadSelectionsMap.set(quotedMsgId.toString(), {
      userRequest: senderId,
      collection: remainingItems,
      uniqueId: uniqueId,
      mediaType: mediaType,
      title: dataDownload.title,
      duration: dataDownload.duration || 0,
      author: dataDownload.author || "Unknown Author",
      timestamp: Date.now(),
    });
    setSelectionsMapData(senderId, {
      quotedMsgId: quotedMsgId.toString(),
      collection: remainingItems,
      uniqueId: uniqueId,
      mediaType: mediaType,
      title: dataDownload.title,
      duration: dataDownload.duration || 0,
      author: dataDownload.author || "Unknown Author",
      timestamp: Date.now(),
      platform: "downlink",
    });
  } catch (error) {
    console.error("Lỗi khi xử lý lệnh download:", error);
    const object = {
      caption: `Đã xảy ra lỗi khi xử lý lệnh load data download.`,
    };
    await sendMessageWarningRequest(api, message, object, 30000);
  }
}

export async function categoryDownload(api, message, platform, uniqueId, selectedMedia, quality) {
  let qualityVideo;
  let tempFilePath;
  try {
    switch (platform) {
      case "youtube":
        const { format, qualityText } = getVideoFormatByQuality(quality);
        qualityVideo = qualityText;
        tempFilePath = await downloadYoutubeVideo(selectedMedia.url, uniqueId, format);
        break;
      default:
        qualityVideo = quality;
        tempFilePath = path.join(tempDir, `${platform}_${Date.now()}.${selectedMedia.extension}`);
        if (selectedMedia.extension === 'm3u8') {
          tempFilePath = path.join(tempDir, `${platform}_${Date.now()}.mp4`);
          const ffmpegCmd = `ffmpeg -i "${selectedMedia.url}" -c copy -bsf:a aac_adtstoasc "${tempFilePath}"`;
          await new Promise((resolve, reject) => {
            exec(ffmpegCmd, (error) => {
              if (error) reject(error);
              resolve();
            });
          });
        } else {
          await downloadFile(selectedMedia.url, tempFilePath);
        }
        break;
    }

    const uploadResult = await api.uploadAttachment([tempFilePath], message.threadId, message.type);
    const videoUrl = uploadResult[0].fileUrl;

    const duration = await getDurationVideo(tempFilePath);

    await deleteFile(tempFilePath);

    setCacheData(platform, uniqueId, { fileUrl: videoUrl, title: selectedMedia.title, duration }, qualityVideo);
    return videoUrl;
  } catch (error) {
    await deleteFile(tempFilePath);
    console.error("Lỗi khi tải video:", error);
    return null;
  }
}

export async function handleDownloadReply(api, message) {
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const idBot = getBotId();

  try {
    if (!message.data.quote || !message.data.quote.globalMsgId) return false;

    const quotedMsgId = message.data.quote.globalMsgId.toString();
    if (!downloadSelectionsMap.has(quotedMsgId)) return false;

    const downloadData = downloadSelectionsMap.get(quotedMsgId);
    if (downloadData.userRequest !== senderId) return false;

    const content = removeMention(message);
    const [selection] = content.split(" ");
    const selectedIndex = parseInt(selection) - 1;

    if (isNaN(selectedIndex)) {
      const object = {
        caption: `Lựa chọn Không hợp lệ. Vui lòng chọn một số từ danh sách.`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return true;
    }

    let { collection, uniqueId, mediaType, title, duration = 0, author } = downloadSelectionsMap.get(quotedMsgId);
    if (selectedIndex < 0 || selectedIndex >= collection.length) {
      const object = {
        caption: `Số bạn chọn Không nằm trong danh sách. Vui lòng chọn lại.`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return true;
    }

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
    downloadSelectionsMap.delete(quotedMsgId);

    await processAndSendMedia(api, message, {
      selectedMedia: collection[selectedIndex],
      mediaType,
      uniqueId,
      duration,
      title,
      author,
      senderId,
      senderName
    });

    return true;
  } catch (error) {
    console.error("Lỗi xử lý reply download:", error);
    const object = {
      caption: `Đã xảy ra lỗi khi xử lý tin nhắn của bạn. Vui lòng thử lại sau.`,
    };
    await sendMessageWarningRequest(api, message, object, 30000);
    return true;
  }
}

async function downloadVoiceWithTimeout(url, filepath, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Download timeout'));
    }, timeout);

    const response = axios({
      url,
      method: "GET",
      responseType: "stream",
      timeout: timeout,
    });

    response.then(res => {
      const writer = fs.createWriteStream(filepath);
      res.data.pipe(writer);
      
      writer.on("finish", () => {
        clearTimeout(timeoutId);
        resolve(filepath);
      });
      
      writer.on("error", (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    }).catch(error => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

async function downloadImageWithTimeout(url, filepath, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Download timeout'));
    }, timeout);

    const response = axios({
      url,
      method: "GET",
      responseType: "stream",
      timeout: timeout,
    });

    response.then(res => {
      const writer = fs.createWriteStream(filepath);
      res.data.pipe(writer);
      
      writer.on("finish", () => {
        clearTimeout(timeoutId);
        resolve(filepath);
      });
      
      writer.on("error", (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    }).catch(error => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}
