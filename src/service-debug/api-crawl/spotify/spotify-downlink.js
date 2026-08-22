import axios from "axios";
import path from "path";
import CryptoJS from "crypto-js";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { getGlobalPrefix } from "../../service.js";
import {
  sendMessageCompleteRequest,
  sendMessageProcessingRequest,
  sendMessageWarningRequest,
} from "../../chat-zalo/chat-style/chat-style.js";
import { downloadFile, deleteFile } from "../../../utils/util.js";
import { sendVoiceMusic } from "../../chat-zalo/chat-special/send-voice/send-voice.js";
import { capitalizeEachWord, removeMention } from "../../../utils/format-util.js";
import { getSelectionsMapData, setSelectionsMapData } from "../index.js";
import { createSearchResultImage } from "./search-canvas.js";
import { tempDir } from "../../../utils/io-json.js";
import { getBotId } from "../../../index.js";
import { MessageMention } from "../../../api-zalo/index.js";
import { downloadAndConvertAudio } from "../../chat-zalo/chat-special/send-voice/process-audio.js";

const PLATFORM = "spotify";
const URL_SPOTIFY_SEARCH = "https://api.spotify.com/v1/search";
const TIME_WAIT_SELECTION = 120000;

const me = {
  J2DOWN_SECRET:
    "U2FsdGVkX18wVfoTqTpAQwAnu9WB9osIMSnldIhYg6rMvFJkhpT6eUM9YqgpTrk41mk8calhYvKyhGF0n26IDXNmtXqI8MjsXtsq0nnAQLROrsBuLnu4Mzu63mpJsGyw",
  API_URL: "https://api.zeidteam.xyz/media-downloader/atd2?url="
};

function secretKey() {
  const decrypted = CryptoJS.AES.decrypt(me.J2DOWN_SECRET, "manhg-api");
  return decrypted.toString(CryptoJS.enc.Utf8);
}

function randomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function encryptData(data) {
  const keyHex = CryptoJS.enc.Hex.parse(secretKey());
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(data, keyHex, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return {
    iv: iv.toString(CryptoJS.enc.Hex),
    k: randomString(11) + "8QXBNv5pHbzFt5QC",
    r: "BRTsfMmf3CuN",
    encryptedData: encrypted.toString(),
  };
}

function sanitizeFilename(name) {
  if (!name) return `media_${Date.now()}_${randomString(8)}`;
  return name
    .replace(/[<>:"/\\|?*&%=#@!$'`~\s]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 100) || `media_${Date.now()}_${randomString(8)}`;
}

async function validateFile(filePath) {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.size > 0;
  } catch {
    return false;
  }
}

export async function getDataDownload(url) {
  let attempts = 0;
  const maxAttempts = 2;
  while (attempts < maxAttempts) {
    try {
      const response = await axios.get(`${me.API_URL}${encodeURIComponent(url)}`, {
        timeout: 20000, // Tăng timeout lên 20s
      });
      if (!response.data || !response.data.medias || response.data.medias.length === 0 || !response.data.medias[0].url) {
        throw new Error("API trả về dữ liệu không hợp lệ hoặc không có media.");
      }
      return response.data;
    } catch (error) {
      attempts++;
      if (attempts >= maxAttempts) {
        return { error: error.message || "Không thể kết nối đến API atd2." };
      }
    }
  }
}

export async function searchSpotify(query) {
  try {
    const CLIENT_ID = "ce9196efcc434c9fb409089dbd5dfd88";
    const CLIENT_SECRET = "24c29c32afdc469db2c8b28fc4ce0029";

    if (!CLIENT_ID || !CLIENT_SECRET || CLIENT_ID === "YOUR_SPOTIFY_CLIENT_ID_HERE") {
      throw new Error("Client ID hoặc Client Secret chưa được thiết lập.");
    }

    const tokenRes = await axios.post(
      "https://accounts.spotify.com/api/token",
      "grant_type=client_credentials",
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
        },
        timeout: 10000,
      }
    );

    const accessToken = tokenRes.data.access_token;

    // Tối ưu hóa query: ví dụ, tách tên bài hát và nghệ sĩ nếu có
    let optimizedQuery = query;
    const queryParts = query.split(" by ");
    if (queryParts.length > 1) {
      optimizedQuery = `track:${queryParts[0]} artist:${queryParts[1]}`;
    }

    const res = await axios.get("https://api.spotify.com/v1/search", {
      params: {
        q: optimizedQuery,
        type: "track",
        limit: 10, // Tăng limit để có thêm kết quả
      },
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
      timeout: 10000,
    });

    const tracks = res.data.tracks.items;
    if (tracks && tracks.length > 0) {
      // Sắp xếp kết quả theo độ phổ biến hoặc mức độ khớp
      const sortedTracks = tracks.sort((a, b) => b.popularity - a.popularity);
      return sortedTracks.map(track => ({
        id: track.id,
        title: track.name || "Unknown Title",
        artist: track.artists.map(a => a.name).join(", ") || "Unknown Artist",
        thumbnail: track.album.images[0]?.url,
        url: track.external_urls.spotify,
        quality: "default",
        extension: "mp3",
        type: "audio",
        duration: track.duration_ms || 0,
        album: track.album.name || "Unknown Album", // Thêm thông tin album
      }));
    }

    return null;
  } catch (error) {
    console.error("Lỗi tìm kiếm Spotify:", error.message); // Thêm logging
    return null;
  }
}

export async function processAndSendSpotifyMedia(api, message, mediaData) {
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
  const typeFile = (selectedMedia.type || "audio").toLowerCase();

  if (typeFile !== "audio") {
    const processingMessage = {
      caption: "Spotify chỉ hỗ trợ tải nội dung âm thanh. Vui lòng thử lại với link âm thanh.",
    };
    await sendMessageWarningRequest(api, message, processingMessage, 30000);
    return;
  }

  if (!selectedMedia.url) {
    const processingMessage = {
      caption: `Lỗi: Không tìm thấy URL bài hát. Vui lòng thử lại.`,
    };
    await sendMessageWarningRequest(api, message, processingMessage, 30000);
    return;
  }

  if (duration > 3000000) {
    const processingMessage = {
      caption: `Bài hát "${title}" có thời lượng quá dài (>${duration/1000}s). Vui lòng chọn bài khác.`,
    };
    await sendMessageWarningRequest(api, message, processingMessage, 30000);
    return;
  }

  let voiceUrl;
  let validatedDuration = Math.floor(duration / 1000) || 1;

  const processingMessage = {
    caption: `Đang tải nhạc từ Spotify, chờ xíu nha!\n\n⏳ ${title}\n📊 Chất lượng: ${quality}`,
  };
  await sendMessageProcessingRequest(api, message, processingMessage, 8000);

  try {
    const tempFilePath = path.resolve(tempDir, `${mediaType}_${uniqueId}_${Date.now()}_${randomString(8)}.aac`);
    
    let attempts = 0;
    const maxAttempts = 2;
    while (attempts < maxAttempts) {
      if (fs.existsSync(tempFilePath)) {
        await deleteFile(tempFilePath);
      }

      try {
        voiceUrl = await downloadAndConvertAudio(selectedMedia.url, api, message, uniqueId);
        if (!voiceUrl) {
          throw new Error("Không thể tải hoặc chuyển đổi file âm thanh.");
        }

        await downloadFile(voiceUrl, tempFilePath, { timeout: 20000 });
        if (!(await validateFile(tempFilePath))) {
          throw new Error("File âm thanh rỗng hoặc không hợp lệ.");
        }

        validatedDuration = Math.floor(duration / 1000) || 1;
        break;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(`Không thể tải hoặc chuyển đổi file âm thanh: ${error.message}`);
        }
      }
    }

    if (fs.existsSync(tempFilePath)) {
      await deleteFile(tempFilePath);
    }
  } catch (error) {
    const processingMessage = {
      caption: `Không tải được bài hát "${title}" từ Spotify: ${error.message}. Vui lòng thử lại sau hoặc kiểm tra link.`,
    };
    await sendMessageWarningRequest(api, message, processingMessage, 30000);
    return;
  }

  const object = {
    trackId: uniqueId || "unknown",
    title: title || "Không rõ",
    artists: author || "Unknown Artist",
    source: capitalizeEachWord(mediaType) || "Spotify",
    caption: `> From Spotify <\nNhạc đây nè! 🎉\n\n🎵 Music: ${title}`,
    imageUrl: selectedMedia.thumbnail,
    voiceUrl: voiceUrl,
    duration: validatedDuration,
  };
  try {
    await sendVoiceMusic(api, message, object, 86400000);
  } catch (error) {
    try {
      const tempFilePath = path.resolve(tempDir, `${mediaType}_${uniqueId}_${Date.now()}_${randomString(8)}.aac`);
      if (fs.existsSync(tempFilePath)) {
        await deleteFile(tempFilePath);
      }
      voiceUrl = await downloadAndConvertAudio(selectedMedia.url, api, message, uniqueId);
      if (!voiceUrl) {
        throw new Error("Không thể tải lại hoặc chuyển đổi file âm thanh.");
      }
      await downloadFile(voiceUrl, tempFilePath, { timeout: 20000 });
      if (!(await validateFile(tempFilePath))) {
        throw new Error("File âm thanh rỗng hoặc không hợp lệ.");
      }
      object.voiceUrl = voiceUrl;
      object.duration = validatedDuration;
      await sendVoiceMusic(api, message, object, 86400000);
      if (fs.existsSync(tempFilePath)) {
        await deleteFile(tempFilePath);
      }
    } catch (retryError) {
      const processingMessage = {
        caption: `Không gửi được bài hát "${title}": ${retryError.message}. Vui lòng thử lại sau hoặc kiểm tra link.`,
      };
      await sendMessageWarningRequest(api, message, processingMessage, 30000);
    }
  }
}

export async function handleSpotifyDownloadCommand(api, message, aliasCommand) {
  const content = removeMention(message);
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const prefix = getGlobalPrefix();

  try {
    const query = content.replace(`${prefix}${aliasCommand}`, "").trim();
    if (!query) {
      const processingMessage = {
        caption: `Vui lòng nhập link Spotify cần tải\nVí dụ:\n${prefix}${aliasCommand} <link>`,
      };
      await sendMessageWarningRequest(api, message, processingMessage, 30000);
      return;
    }

    if (!query.toLowerCase().includes("spotify.com")) {
      const processingMessage = {
        caption: `Link không phải từ Spotify. Vui lòng cung cấp link Spotify hợp lệ.`,
      };
      await sendMessageWarningRequest(api, message, processingMessage, 30000);
      return;
    }

    const downloadData = await getDataDownload(query);
    if (!downloadData || downloadData.error || !downloadData.medias || downloadData.medias.length === 0) {
      const processingMessage = {
        caption: `Link không hợp lệ hoặc không thể tải dữ liệu từ Spotify: ${downloadData?.error || "Lỗi không xác định"}. Vui lòng thử lại với link khác.`,
      };
      await sendMessageWarningRequest(api, message, processingMessage, 30000);
      return;
    }

    const uniqueId = sanitizeFilename(downloadData.title || downloadData.url || `spotify_${Date.now()}_${randomString(8)}`);
    const dataLink = downloadData.medias?.map((item) => ({
      url: item.url,
      quality: item.quality || "default",
      type: "audio",
      title: downloadData.title || "Unknown Title",
      thumbnail: item.thumbnail || downloadData.thumbnail,
      extension: item.extension || "mp3",
      duration: downloadData.duration || 0,
    })) || [];

    if (dataLink.length === 0) {
      const processingMessage = {
        caption: `Không tìm thấy dữ liệu tải về phù hợp cho link Spotify này! Vui lòng thử lại với link khác.`,
      };
      await sendMessageWarningRequest(api, message, processingMessage, 30000);
      return;
    }

    if (dataLink.length === 1) {
      await processAndSendSpotifyMedia(api, message, {
        selectedMedia: dataLink[0],
        mediaType: "spotify",
        uniqueId,
        duration: downloadData.duration || 0,
        title: downloadData.title || "Unknown Title",
        author: downloadData.author || "Unknown Artist",
        senderId,
        senderName,
      });
      return;
    }

    const processingMessage = {
      caption: `Vui lòng trả lời tin nhắn này với số thứ tự bài hát bạn muốn tải!`,
    };
    const listMessage = await sendMessageCompleteRequest(api, message, processingMessage, TIME_WAIT_SELECTION);
    const quotedMsgId = listMessage?.message?.msgId || listMessage?.attachment[0]?.msgId;
    if (!quotedMsgId) {
      const processingMessage = {
        caption: `Lỗi hệ thống: Không thể tạo danh sách bài hát. Vui lòng thử lại.`,
      };
      await sendMessageWarningRequest(api, message, processingMessage, 30000);
      return;
    }
    const downloadSelectionsMap = getSelectionsMapData();
    downloadSelectionsMap.clear(); // Xóa dữ liệu cũ
    downloadSelectionsMap.set(quotedMsgId.toString(), {
      userRequest: senderId,
      collection: dataLink,
      uniqueId,
      mediaType: "spotify",
      title: downloadData.title || "Unknown Title",
      duration: downloadData.duration || 0,
      author: downloadData.author || "Unknown Artist",
      timestamp: Date.now(),
    });
    setSelectionsMapData(senderId, {
      quotedMsgId: quotedMsgId.toString(),
      collection: dataLink,
      uniqueId,
      mediaType: "spotify",
      title: downloadData.title || "Unknown Title",
      duration: downloadData.duration || 0,
      author: downloadData.author || "Unknown Artist",
      timestamp: Date.now(),
      platform: "spotify",
    });
  } catch (error) {
    const processingMessage = {
      caption: `Đã xảy ra lỗi khi xử lý lệnh tải Spotify: ${error.message}. Vui lòng thử lại sau hoặc kiểm tra link.`,
    };
    await sendMessageWarningRequest(api, message, processingMessage, 30000);
  }
}

export async function handleSpotifyDownloadReply(api, message) {
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const idBot = getBotId();
  const downloadSelectionsMap = getSelectionsMapData();

  try {
    let downloadData = null;
    let quotedMsgId = null;

    if (message.data.quote && message.data.quote.globalMsgId) {
      quotedMsgId = message.data.quote.globalMsgId.toString();
      downloadData = downloadSelectionsMap.get(quotedMsgId);
      if (!downloadData) {
        const processingMessage = {
          caption: `Danh sách bài hát đã hết hạn hoặc không tồn tại. Vui lòng tìm kiếm lại.`,
        };
        await sendMessageWarningRequest(api, message, processingMessage, 30000);
        return true;
      }
    } else {
      for (const [key, value] of downloadSelectionsMap) {
        if (value.userRequest === senderId && value.platform === "spotify") {
          downloadData = value;
          quotedMsgId = key;
          break;
        }
      }
      if (!downloadData) {
        const processingMessage = {
          caption: `Vui lòng trả lời trực tiếp tin nhắn danh sách bài hát bằng số thứ tự (ví dụ: 1). Hoặc tìm kiếm lại.`,
        };
        await sendMessageWarningRequest(api, message, processingMessage, 30000);
        return true;
      }
    }

    if (!downloadData.collection || !Array.isArray(downloadData.collection) || downloadData.collection.length === 0) {
      const processingMessage = {
        caption: `Lỗi hệ thống: Dữ liệu danh sách bài hát không hợp lệ. Vui lòng tìm kiếm lại.`,
      };
      await sendMessageWarningRequest(api, message, processingMessage, 30000);
      downloadSelectionsMap.delete(quotedMsgId);
      return true;
    }

    if (downloadData.userRequest !== senderId) {
      const processingMessage = {
        caption: `Bạn không phải người yêu cầu danh sách này. Vui lòng tìm kiếm lại.`,
      };
      await sendMessageWarningRequest(api, message, processingMessage, 30000);
      return true;
    }

    const content = removeMention(message).trim();
    const selectedIndex = parseInt(content) - 1;
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= downloadData.collection.length) {
      const processingMessage = {
        caption: `Lựa chọn không hợp lệ. Vui lòng chọn số từ 1 đến ${downloadData.collection.length}.`,
      };
      await sendMessageWarningRequest(api, message, processingMessage, 30000);
      return true;
    }

    const selectedMedia = downloadData.collection[selectedIndex];
    if (!selectedMedia || !selectedMedia.url || !selectedMedia.title) {
      const processingMessage = {
        caption: `Lỗi hệ thống: Dữ liệu bài hát không hợp lệ. Vui lòng tìm kiếm lại.`,
      };
      await sendMessageWarningRequest(api, message, processingMessage, 30000);
      downloadSelectionsMap.delete(quotedMsgId);
      return true;
    }

    if (!selectedMedia.url.toLowerCase().includes("spotify.com")) {
      const processingMessage = {
        caption: `Link bài hát không phải từ Spotify: ${selectedMedia.url}. Vui lòng thử lại với link khác.`,
      };
      await sendMessageWarningRequest(api, message, processingMessage, 30000);
      downloadSelectionsMap.delete(quotedMsgId);
      return true;
    }

    const atd2Data = await getDataDownload(selectedMedia.url);
    if (!atd2Data || atd2Data.error || !atd2Data.medias || atd2Data.medias.length === 0 || !atd2Data.medias[0].url) {
      const processingMessage = {
        caption: `Không thể tải bài hát từ link này: ${atd2Data?.error || "Lỗi không xác định"}. Vui lòng thử lại với bài khác.`,
      };
      await sendMessageWarningRequest(api, message, processingMessage, 30000);
      downloadSelectionsMap.delete(quotedMsgId);
      return true;
    }

    const atd2Media = atd2Data.medias[0];

    if (message.data.quote?.globalMsgId || quotedMsgId) {
      const msgDel = {
        type: message.type,
        threadId: message.threadId,
        data: {
          cliMsgId: message.data.quote?.cliMsgId || "",
          msgId: message.data.quote?.globalMsgId || quotedMsgId,
          uidFrom: idBot,
        },
      };
      if (msgDel.data.msgId && msgDel.data.uidFrom) {
        try {
          await api.deleteMessage(msgDel, false);
        } catch {}
      }
    }
    downloadSelectionsMap.delete(quotedMsgId);

    await processAndSendSpotifyMedia(api, message, {
      selectedMedia: {
        ...selectedMedia,
        url: atd2Media.url,
        quality: atd2Media.quality || selectedMedia.quality,
        extension: atd2Media.extension || selectedMedia.extension,
        thumbnail: atd2Media.thumbnail || selectedMedia.thumbnail,
      },
      mediaType: downloadData.mediaType,
      uniqueId: downloadData.uniqueId,
      duration: atd2Data.duration || selectedMedia.duration || downloadData.duration || 0,
      title: atd2Data.title || downloadData.title || selectedMedia.title,
      author: atd2Data.author || downloadData.author || selectedMedia.artist || "Unknown Artist",
      senderId,
      senderName,
    });
    return true;
  } catch (error) {
    const processingMessage = {
      caption: `Đã xảy ra lỗi khi xử lý lựa chọn bài hát: ${error.message}. Vui lòng thử lại sau hoặc kiểm tra link.`,
    };
    await sendMessageWarningRequest(api, message, processingMessage, 30000);
    return true;
  }
}

export async function handleSpotifyCommand(api, message, command) {
  const content = removeMention(message);
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const prefix = getGlobalPrefix();
  let imagePath = null;

  try {
    const keyword = content.replace(`${prefix}${command}`, "").trim();

    if (!keyword) {
      const processingMessage = {
        caption: `Vui lòng nhập từ khóa tìm kiếm hoặc link Spotify\nVí dụ:\n${prefix}${command} tên bài hát hoặc ${prefix}${command} <link Spotify>`,
      };
      await sendMessageWarningRequest(api, message, processingMessage, 30000);
      return;
    }

    const extractSpotifyUrl = (text) => {
      const spotifyRegex = /https?:\/\/(?:open|play)\.spotify\.com\/[^\s]+/i;
      const match = text.match(spotifyRegex);
      return match ? match[0] : null;
    };

    const spotifyUrl = extractSpotifyUrl(keyword);
    if (spotifyUrl) {
      await handleSpotifyDownloadCommand(api, message, command);
      return;
    }

    const tracks = await searchSpotify(keyword);

    if (tracks && tracks.length > 0) {
      if (tracks.length === 1) {
        const modifiedMessage = {
          ...message,
          data: {
            ...message.data,
            content: `${prefix}${command} ${tracks[0].url}`,
          },
        };
        await handleSpotifyDownloadCommand(api, modifiedMessage, command);
        return;
      }

      imagePath = await createSearchResultImage(tracks.map(track => ({
        title: track.title || "No title",
        artistsNames: track.artist || "Unknown Artist",
        thumbnailM: track.thumbnail,
        listen: track.listen || 0,
        like: track.like || 0,
        comment: track.comment || 0,
      })));

      const processingMessage = {
        caption: `Vui lòng trả lời tin nhắn này với số thứ tự bài hát bạn muốn tải!`,
        imagePath: imagePath,
      };
      const listMessage = await sendMessageCompleteRequest(api, message, processingMessage, TIME_WAIT_SELECTION);
      const quotedMsgId = listMessage?.message?.msgId || listMessage?.attachment[0]?.msgId;
      if (!quotedMsgId) {
        const processingMessage = {
          caption: `Lỗi hệ thống: Không thể tạo danh sách bài hát. Vui lòng thử lại.`,
        };
        await sendMessageWarningRequest(api, message, processingMessage, 30000);
        return;
      }

      const downloadSelectionsMap = getSelectionsMapData();
      downloadSelectionsMap.clear(); // Xóa dữ liệu cũ
      downloadSelectionsMap.set(quotedMsgId.toString(), {
        userRequest: senderId,
        collection: tracks,
        timestamp: Date.now(),
        mediaType: "spotify",
        platform: PLATFORM,
      });
      setSelectionsMapData(senderId, {
        quotedMsgId: quotedMsgId.toString(),
        collection: tracks,
        timestamp: Date.now(),
        mediaType: "spotify",
        platform: PLATFORM,
      });
    } else {
      const processingMessage = {
        caption: `Không tìm được bài hát phù hợp trên Spotify. Hãy thử từ khóa khác hoặc kiểm tra Client ID/Secret.`,
      };
      await sendMessageWarningRequest(api, message, processingMessage, 30000);
    }
  } catch (error) {
    const processingMessage = {
      caption: `Đã xảy ra lỗi khi tìm kiếm bài hát Spotify: ${error.message}. Kiểm tra Client ID/Secret và thử lại.`,
    };
    await sendMessageWarningRequest(api, message, processingMessage, 30000);
  } finally {
    if (imagePath) await deleteFile(imagePath);
  }
}