import gtts from "gtts";
import fs from "fs";
import path from "path";
import { getGlobalPrefix } from "../../../service.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { convertToM4A, downloadAndConvertAudio, extractAudioFromVideo, uploadAudioFile } from "./process-audio.js";
import { sendMessageCompleteRequest, sendMessageFailed, sendMessageFromSQL, sendMessageImageNotQuote, sendMessageState, sendMessageStateQuote } from "../../chat-style/chat-style.js";
import { checkExstentionFileRemote, deleteFile, downloadFile, execAsync } from "../../../../utils/util.js";
import { tempDir } from "../../../../utils/io-json.js";
import { createSpinningDiscGif } from "../send-gif/create-gif.js";
import { normalizeSymbolName, removeMention } from "../../../../utils/format-util.js";
import { createCircleWebp, createImageWebp } from "../send-sticker/create-webp.js";
import { createMusicCard } from "../../../../utils/canvas/music-canvas.js";
import { getUserInfoData } from "../../../info-service/user-info.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function textToSpeech(text, api, message, lang = "vi") {
  return new Promise((resolve, reject) => {
    try {
      const tts = new gtts(text, lang);
      const fileName = `voice_${Date.now()}.mp3`;
      const filePath = path.join(tempDir, fileName);

      tts.save(filePath, async (err) => {
        if (err) {
          reject(err);
          return;
        }
        try {
          const voiceUrl = await uploadAudioFile(filePath, api, message);
          resolve(voiceUrl);
        } catch (error) {
          reject(error);
        } finally {
          await deleteFile(filePath);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Nhận diện ngôn ngữ từ text dựa trên bộ ký tự
 */
function detectLanguage(text) {
  const patterns = {
    vi: /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i,
    zh: /[\u4E00-\u9FFF]/,
    ja: /[\u3040-\u309F\u30A0-\u30FF]/,
    ko: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/,
  };

  const counts = {
    vi: (text.match(patterns.vi) || []).length,
    zh: (text.match(patterns.zh) || []).length,
    ja: (text.match(patterns.ja) || []).length,
    ko: (text.match(patterns.ko) || []).length,
  };

  const maxLang = Object.entries(counts).reduce(
    (max, [lang, count]) => {
      return count > max.count ? { lang, count } : max;
    },
    { lang: "vi", count: 0 }
  );

  if (maxLang.count === 0 && /^[\x00-\x7F]*$/.test(text)) {
    return "vi";
  }

  return maxLang.count > 0 ? maxLang.lang : "vi";
}

/**
 * Tách văn bản thành các phần theo ngôn ngữ
 */
function splitByLanguage(text) {
  const words = text.split(" ");
  const parts = [];
  let currentPart = {
    text: words[0],
    lang: detectLanguage(words[0]),
  };

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const lang = detectLanguage(word);

    if (lang === currentPart.lang) {
      currentPart.text += " " + word;
    } else {
      parts.push(currentPart);
      currentPart = {
        text: word,
        lang: lang,
      };
    }
  }
  parts.push(currentPart);
  return parts;
}

/**
 * Ghép các file audio
 */
async function concatenateAudios(audioPaths) {
  const outputPath = path.join(tempDir, `combined_${Date.now()}.mp3`);

  const ffmpegCommand = [
    "ffmpeg",
    "-y",
    ...audioPaths.map((path) => ["-i", path]).flat(),
    "-filter_complex",
    `concat=n=${audioPaths.length}:v=0:a=1[out]`,
    "-map",
    "[out]",
    "-c:a",
    "libmp3lame",
    "-q:a",
    "2",
    outputPath,
  ].join(" ");

  await execAsync(ffmpegCommand);
  return outputPath;
}

/**
 * Chuyển văn bản đa ngôn ngữ thành giọng nói
 */
async function multilingualTextToSpeech(text, api, message) {
  let finalAudioPath = null;
  const audioFiles = [];
  try {
    const parts = splitByLanguage(text);

    for (const part of parts) {
      const fileName = `voice_${Date.now()}_${part.lang}.mp3`;
      const filePath = path.join(tempDir, fileName);

      const tts = new gtts(part.text, part.lang);
      await new Promise((resolve, reject) => {
        tts.save(filePath, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      audioFiles.push(filePath);
    }

    finalAudioPath = await concatenateAudios(audioFiles);

    const voiceUrl = await uploadAudioFile(finalAudioPath, api, message);

    return voiceUrl;
  } catch (error) {
    console.error("Lỗi khi xử lý audio đa ngôn ngữ:", error);
    throw error;
  } finally {
    audioFiles.forEach(async (file) => {
      await deleteFile(file);
    });
    await deleteFile(finalAudioPath);
  }
}

/**
 * Xử lý lệnh chuyển văn bản thành giọng nói
 */
export async function handleVoiceCommand(api, message, command) {
  try {
    const prefix = getGlobalPrefix();
    const content = removeMention(message);
    let text = content.slice(prefix.length + command.length).trim();
    if (message.data?.quote) {
      if (!text) text = message.data?.quote?.msg || null;
      if (!text) {
        try {
          const parseMessage = JSON.parse(message.data?.quote?.attach);
          text = parseMessage.description || parseMessage.title || null;
        } catch (error) {
        }
      }
    }

    if (!text) {
      await api.sendMessage(
        {
          msg: `Vui lòng nhập nội dung cần chuyển thành giọng nói.\nVí dụ: 
${prefix}${command} Nội dung cần send Voice bất kỳ`,
          quote: message,
          ttl: 600000,
        },
        message.threadId,
        message.type
      );
      return;
    }

    const voiceUrl = await multilingualTextToSpeech(text, api, message);

    if (!voiceUrl) {
      throw new Error("Không thể tạo file âm thanh");
    }

    await api.sendVoice(
      message,
      voiceUrl,
      600000
    );
  } catch (error) {
    console.error("Lỗi khi xử lý lệnh voice:", error);
    await api.sendMessage(
      {
        msg: "Đã xảy ra lỗi khi chuyển văn bản thành giọng nói. Vui lòng thử lại sau.",
        quote: message,
        ttl: 600000,
      },
      message.threadId,
      message.type
    );
  }
}

export async function handleStoryCommand(api, message) {
  try {
    const storyFilePath = path.join(__dirname, "z_truyencuoi.txt");
    const stories = fs
      .readFileSync(storyFilePath, "utf8")
      .split("\n")
      .filter((line) => line.trim());

    let randomStory = stories[Math.floor(Math.random() * stories.length)];

    if (!randomStory) {
      throw new Error("Không tìm thấy truyện cười");
    }

    randomStory = randomStory.replaceAll("\\n", "\n");
    const voiceUrl = await textToSpeech(randomStory, api, message);

    if (!voiceUrl) {
      throw new Error("Không thể tạo file âm thanh");
    }

    await Promise.all([
      api.sendVoice(message, voiceUrl, 600000),
      api.sendMessage(
        {
          msg: randomStory,
          quote: message,
          ttl: 600000,
        },
        message.threadId,
        message.type
      ),
    ]);
  } catch (error) {
    console.error("Lỗi khi xử lý lệnh story:", error);
    await api.sendMessage(
      {
        msg: "Đã xảy ra lỗi khi đọc truyện cười. Vui lòng thử lại sau.",
        quote: message,
        ttl: 600000,
      },
      message.threadId,
      message.type
    );
  }
}

export async function handleTarrotCommand(api, message) {
  try {
    const tarotFilePath = path.join(__dirname, "z_tarot.txt");
    const tarots = fs
      .readFileSync(tarotFilePath, "utf8")
      .split("\n")
      .filter((line) => line.trim());

    let randomTarot = tarots[Math.floor(Math.random() * tarots.length)];

    if (!randomTarot) {
      throw new Error("Không tìm thấy Tarot");
    }

    const tarotText = randomTarot
      .replaceAll("\\n", "\n")
      .replaceAll("♠", "Bích")
      .replaceAll("♥", "Cơ")
      .replaceAll("♣", "Chuồn")
      .replaceAll("♦", "Rô");
    const voiceUrl = await textToSpeech(tarotText, api, message);

    await Promise.all([
      api.sendMessage(
        { msg: randomTarot, quote: message, ttl: 600000 },
        message.threadId,
        message.type
      ),
      api.sendVoice(message, voiceUrl, 600000),
    ]);
  } catch (error) {
    console.error("Lỗi khi xử lý lệnh Tarot:", error);
    await api.sendMessage(
      {
        msg: "Đã xảy ra lỗi khi đọc Tarot. Vui lòng thử lại sau.",
        quote: message,
        ttl: 600000,
      },
      message.threadId,
      message.type
    );
  }
}

export async function sendVoiceMusic(api, message, object, ttl) {
  let thumbnailPath = path.resolve(tempDir, `${Date.now()}.jpg`);
  const voiceUrl = object.voiceUrl;
  if (!voiceUrl) {
    sendMessageFailed(api, message, "Upload file nhạc thất bại!", true);
    return;
  }
  // let spinningWebp = null;
  try {
    if (message?.data?.uidFrom) {
      let senderId = message.data.uidFrom;
      const userInfo = await getUserInfoData(api, senderId);
      object.userAvatar = userInfo.avatar;
    }
  } catch (error) {
    console.error("Lỗi khi lấy thông tin người dùng:", error);
  }
  let imagePath = null;
  try {
    if (object.imageUrl) {
      await downloadFile(object.imageUrl, thumbnailPath);
      try {
        object.thumbnailPath = thumbnailPath;
        imagePath = await createMusicCard(object);
      } catch (error) {
        console.error("Lỗi khi tạo music card:", error);
        imagePath = null;
      }
      // spinningWebp = await createCircleWebp(api, message, object.imageUrl, object.trackId);
    }

    await sendMessageCompleteRequest(api, message, object, 180000);
    if (imagePath) {
      await api.sendMessage(
        {
          msg: ``,
          attachments: [imagePath],
          ttl: ttl,
        },
        message.threadId,
        message.type
      );
    }
    // if (spinningWebp) {
    //   await api.sendCustomSticker(
    //     message,
    //     spinningWebp.url,
    //     spinningWebp.url,
    //     spinningWebp.stickerData.width,
    //     spinningWebp.stickerData.height
    //   );
    // }
    await api.sendVoice(message, voiceUrl, ttl);
  } catch (error) {
    console.error("Lỗi khi gửi voice music:", error);
  } finally {
    await deleteFile(thumbnailPath);
    if (imagePath && imagePath !== thumbnailPath) await deleteFile(imagePath);
  }
}

export async function sendVoiceMusicNotQuote(api, message, object, ttl) {
  let thumbnailPath = path.resolve(tempDir, `${Date.now()}.jpg`);
  let imagePath = null;
  try {
    const voiceUrl = object.voiceUrl;
    if (object.imageUrl) {
      await downloadFile(object.imageUrl, thumbnailPath);
      try {
        object.thumbnailPath = thumbnailPath;
        imagePath = await createMusicCard(object);
      } catch (error) {
        console.error("Lỗi khi tạo music card:", error);
        imagePath = null;
      }
    }

    const result = {
      message: object.caption,
      success: true,
    };

    await sendMessageImageNotQuote(api, result, message.threadId, imagePath, ttl, false);
    await api.sendVoice(message, voiceUrl, ttl);
  } catch (error) {
    console.error("Lỗi khi gửi voice music:", error);
  } finally {
    await deleteFile(thumbnailPath);
    if (imagePath && imagePath !== thumbnailPath) await deleteFile(imagePath);
  }
}

export async function handleGetVoiceCommand(api, message, aliasCommand) {
  const quote = message.data.quote;
  const prefix = getGlobalPrefix();
  const content = removeMention(message);
  let voiceUrl = null;
  let videoUrl = null;
  let keyContent = content.replace(`${prefix}${aliasCommand}`, "").trim();
  let ext = null;

  if (!quote && !keyContent) {
    const object = {
      caption: `Nhập link video hoặc reply nội dung video cần tách âm thanh và dùng lại lệnh ${prefix}${aliasCommand}.`,
      state: false,
      ttl: 30000,
    };
    await sendMessageStateQuote(api, message, object.caption, object.state, object.ttl);
    return;
  }

  if (keyContent) {
    ext = await checkExstentionFileRemote(keyContent);
    if (ext === 'mp4') {
      videoUrl = keyContent;
    } else if (ext === 'aac' || ext === 'm4a') {
      voiceUrl = keyContent;
    } else if (ext === 'mp3') {
      voiceUrl = await downloadAndConvertAudio(keyContent, api, message);
    } else {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Chỉ hỗ trợ get voice cho định dạng video`,
        },
        false,
        30000
      );
      return;
    }
  }

  if (quote) {
    const attachData = quote.attach ? JSON.parse(quote.attach) : null;
    if (attachData?.href) {
      ext = await checkExstentionFileRemote(attachData.href);
      if (ext === 'mp4') {
        videoUrl = attachData.href;
      } else if (ext === 'aac' || ext === 'm4a') {
        voiceUrl = attachData.href;
      } else if (ext === 'mp3') {
        voiceUrl = await downloadAndConvertAudio(attachData.href, api, message);
      } else {
        await sendMessageFromSQL(
          api,
          message,
          {
            success: false,
            message: `Chỉ hỗ trợ get voice cho định dạng video`,
          },
          false,
          30000
        );
        return;
      }
    } else {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Không tìm thấy link đính kèm trong tin nhắn được reply!`,
        },
        false,
        30000
      );
      return;
    }
  }

  if (voiceUrl) {
    if (ext === 'mp3') {
      await sendVoiceMusic(api, message, { voiceUrl, caption: "Chuyển đổi voice từ mp3 thành công!!!" }, 1800000);
    } else {
      await sendVoiceMusic(api, message, { voiceUrl, caption: "Đã Là Định Dạng Voice!!!" }, 1800000);
    }
    return;
  } else {
    if (videoUrl) {
      try {
        const voiceUrl = await extractAudioFromVideo(videoUrl, api, message);
        await sendVoiceMusic(api, message, { voiceUrl, caption: "Chuyển đổi voice từ video thành công!!!" }, 1800000);
      } catch (error) {
        console.error("Lỗi khi tách âm thanh:", error);
        await sendMessageFromSQL(
          api,
          message,
          {
            success: false,
            message: `Đã xảy ra lỗi khi get voice, vui lòng thử lại với link khác.`,
          },
          false,
          30000
        );
      }
      return;
    }
  }
}
