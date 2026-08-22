import axios from "axios";
import fs from "fs";
import path from "path";
import { getGlobalPrefix } from "../../../service.js";
import { checkExstentionFileRemote, deleteFile, downloadFile } from "../../../../utils/util.js";
import { MessageMention, MessageType } from "../../../../api-zalo/index.js";
import { tempDir } from "../../../../utils/io-json.js";
import { removeMention } from "../../../../utils/format-util.js";
import { getVideoMetadata } from "../../../../api-zalo/utils.js";
import { isAdmin } from "../../../../index.js";
import { appContext } from "../../../../api-zalo/context.js";
import ffmpeg from 'fluent-ffmpeg';

// Khóa API Tenor
const TENOR_API_KEY = "AIzaSyACyC8fxJfIm6yiM1TG0B-gBNXnM2iATFw";
const CLIENT_KEY = "my_bot_app";

async function searchTenorSticker(query) {
    try {
        //console.log(`Tìm kiếm GIF trên Tenor với từ khóa: ${query}`);
        const response = await axios.get('https://tenor.googleapis.com/v2/search', {
            params: {
                q: query,
                key: TENOR_API_KEY,
                client_key: CLIENT_KEY,
                limit: 50,
                contentfilter: 'high',
            },
            timeout: 10000,
            headers: { 'User-Agent': 'HHH_MYBOT/1.0 (Node.js)' },
        });

        const results = response.data.results;
        if (!results || !Array.isArray(results) || results.length === 0) {
            //console.log(`Không tìm thấy GIF nào cho từ khóa: ${query}`);
            if (query.toLowerCase() === "ếch") {
                //console.log(`Thử tìm kiếm với từ khóa thay thế: "frog"`);
                return await searchTenorSticker("frog");
            }
            return null;
        }

        const validResults = results.filter(gif => {
            if (!gif || !gif.media_formats || typeof gif.media_formats !== 'object') {
                return false;
            }
            const formats = gif.media_formats;
            return (
                (formats.webp && formats.webp.url && formats.webp.url.trim()) ||
                (formats.gif && formats.gif.url && formats.gif.url.trim()) ||
                (formats.mediumgif && formats.mediumgif.url && formats.mediumgif.url.trim()) ||
                (formats.nanogif && formats.nanogif.url && formats.nanogif.url.trim()) ||
                (formats.mp4 && formats.mp4.url && formats.mp4.url.trim())
            );
        });

        if (validResults.length === 0) {
            //console.log(`Không có GIF hợp lệ cho từ khóa: ${query}`);
            if (query.toLowerCase() === "ếch") {
                //console.log(`Thử tìm kiếm với từ khóa thay thế: "frog"`);
                return await searchTenorSticker("frog");
            }
            return null;
        }

        const randomIndex = Math.floor(Math.random() * validResults.length);
        const media = validResults[randomIndex].media_formats;
        const mediaUrl = media.webp?.url || media.gif?.url || media.mediumgif?.url || media.nanogif?.url || media.mp4?.url || null;
        //console.log(`Đã chọn GIF ngẫu nhiên: ${mediaUrl}`);
        return mediaUrl;
    } catch (error) {
        //console.error('Lỗi khi tìm kiếm GIF trên Tenor:', error.message);
        return null;
    }
}

async function processAndSendSticker(api, message, mediaSource) {
    const senderName = message.data.dName;
    const senderId = message.data.uidFrom;
    let pathSticker = path.join(tempDir, `sticker_${Date.now()}.temp`);
    let pathWebp = path.join(tempDir, `sticker_${Date.now()}.webp`);
    let isLocalFile = false;

    try {
        // Kiểm tra quyền truy cập thư mục tạm
        try {
            fs.accessSync(tempDir, fs.constants.W_OK);
        } catch (error) {
            throw new Error(`Không có quyền ghi vào thư mục ${tempDir}: ${error.message}`);
        }

        //console.log(`Xử lý mediaSource: ${mediaSource}`);
        if (!isLocalFile) {
            const mediaCheck = await isValidMediaUrl(mediaSource);
            if (!mediaCheck.isValid) {
                throw new Error(`URL media không hợp lệ: ${mediaSource}`);
            }

            const ext = await checkExstentionFileRemote(mediaSource);
            pathSticker = path.join(tempDir, `sticker_${Date.now()}.${ext}`);
            //console.log(`Tải file từ ${mediaSource} về ${pathSticker}`);
            await downloadFile(mediaSource, pathSticker);

            const stats = fs.statSync(pathSticker);
            if (stats.size === 0) {
                throw new Error(`File tải về rỗng: ${pathSticker}`);
            }

            // Nếu file đã là WebP, sử dụng trực tiếp
            if (ext.toLowerCase() === 'webp') {
                //console.log(`File đã là WebP, sử dụng ${pathSticker} làm ${pathWebp}`);
                pathWebp = pathSticker;
            } else {
                // Chuyển đổi sang WebP
                //console.log(`Chuyển đổi ${pathSticker} sang ${pathWebp}`);
                await convertToWebp(pathSticker, pathWebp);
            }
        } else {
            pathSticker = mediaSource;
            //console.log(`Chuyển đổi ${pathSticker} sang ${pathWebp}`);
            await convertToWebp(pathSticker, pathWebp);
        }

        // Kiểm tra file WebP đầu ra
        if (!fs.existsSync(pathWebp) || fs.statSync(pathWebp).size === 0) {
            throw new Error(`File WebP đầu ra rỗng hoặc không tồn tại: ${pathWebp}`);
        }

        const linkUploadZalo = await api.uploadAttachment([pathWebp], appContext.send2meId, MessageType.DirectMessage);
        const stickerData = await getVideoMetadata(pathWebp);
        const finalUrl = (linkUploadZalo[0].fileUrl || linkUploadZalo[0].normalUrl || linkUploadZalo[0].url || linkUploadZalo[0].mediaUrl) + "?CreatedBy=HàHuyHoàng.BOT";
        await api.sendMessage(
            {
                msg: `${senderName} Sticker của bạn đây!`,
                quote: message,
                mentions: [MessageMention(senderId, senderName.length, 0)],
                ttl: 300000,
            },
            message.threadId,
            message.type
        );

        await api.sendCustomSticker(
            message,
            finalUrl,
            finalUrl,
            stickerData.width,
            stickerData.height,
            3600000
        );

        return true;
    } catch (error) {
        console.error("Lỗi khi xử lý sticker:", error);
        throw error;
    } finally {
        if (pathSticker !== pathWebp) {
            await deleteFile(pathSticker);
        }
        await deleteFile(pathWebp);
    }
}

async function isValidMediaUrl(url) {
    try {
        const ext = await checkExstentionFileRemote(url);
        if (!ext) {
            return { isValid: false, isVideo: false };
        }
        if (ext === "mp4" || ext === "mov" || ext === "webm") {
            return { isValid: true, isVideo: true };
        } else if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "gif" || ext === "webp") {
            return { isValid: true, isVideo: false };
        } else {
            return { isValid: false, isVideo: false };
        }
    } catch (error) {
        console.error("Lỗi khi kiểm tra URL:", error);
        return { isValid: false, isVideo: false };
    }
}

export async function handleStkmemeCommand(api, message, aliasCommand = 'stkmeme') {
    const threadId = message.threadId;
    const threadType = message.type ?? MessageType.DirectMessage;
    const senderId = message.data.uidFrom;
    const senderName = message.data.dName || "Người dùng";
    const prefix = getGlobalPrefix();
    const content = message.data.content ? message.data.content.trim() : '';
    const commandContent = content.replace(`${prefix}${aliasCommand}`, "").trim();
    const rawArgs = commandContent.split(/\s+/);
    const input = rawArgs.filter(a => !/^(-d|--debug|-debug)$/i.test(a)).join(" ").trim();

    if (!commandContent || !input) {
        await api.sendMessage(
            {
                msg: `Vui lòng nhập từ khóa tìm kiếm sticker!\nVí dụ: ${prefix}${aliasCommand} [nội dung] [số lượng]`,
                quote: message,
                mentions: [MessageMention(senderId, senderName.length, 0)],
                ttl: 30000,
            },
            threadId,
            threadType
        );
        return 0;
    }

    // Tách từ khóa và số lượng
    const args = input.split(/\s+/);
    let query = input;
    let count = 1; // Mặc định lấy 1 sticker nếu không chỉ định số lượng
    const lastArg = args[args.length - 1];
    if (/^\d+$/.test(lastArg)) {
        count = parseInt(lastArg, 10);
        query = args.slice(0, -1).join(" ").trim();
        if (!query) {
            await api.sendMessage(
                {
                    msg: `Vui lòng nhập từ khóa tìm kiếm sticker trước số lượng!\nVí dụ: ${prefix}${aliasCommand} funny 3`,
                    quote: message,
                    mentions: [MessageMention(senderId, senderName.length, 0)],
                    ttl: 30000,
                },
                threadId,
                threadType
            );
            return 0;
        }
    }

    // Giới hạn số lượng tối đa
    const MAX_COUNT = 10;
    if (count > MAX_COUNT) {
        await api.sendMessage(
            {
                msg: `${senderName}, Số lượng sticker tối đa là ${MAX_COUNT}! Hãy thử lại với số lượng nhỏ hơn.`,
                quote: message,
                mentions: [MessageMention(senderId, senderName.length, 0)],
                ttl: 30000,
            },
            threadId,
            threadType
        );
        return 0;
    }

    if (count < 1) {
        await api.sendMessage(
            {
                msg: `${senderName}, Số lượng sticker phải là số dương!\nVí dụ: ${prefix}${aliasCommand} funny 3`,
                quote: message,
                mentions: [MessageMention(senderId, senderName.length, 0)],
                ttl: 30000,
            },
            threadId,
            threadType
        );
        return 0;
    }

    await api.sendMessage(
        {
            msg: `${senderName}, Đang tìm ${count > 1 ? count : 'một'} sticker cho từ khóa "${query}", chờ chút nhé!`,
            quote: message,
            mentions: [MessageMention(senderId, senderName.length, 0)],
            ttl: 6000,
        },
        threadId,
        threadType
    );

    try {
        // Lấy danh sách sticker từ Tenor
        const response = await axios.get('https://tenor.googleapis.com/v2/search', {
            params: {
                q: query,
                key: TENOR_API_KEY,
                client_key: CLIENT_KEY,
                limit: count > 1 ? count : 50, // Lấy 50 nếu không chỉ định số lượng để chọn ngẫu nhiên
                contentfilter: 'high',
            },
            timeout: 10000,
            headers: { 'User-Agent': 'HHH_MYBOT/1.0 (Node.js)' },
        });

        const results = response.data.results;
        if (!results || !Array.isArray(results) || results.length === 0) {
            await api.sendMessage(
                {
                    msg: `${senderName}, Không tìm thấy GIF nào trên Tenor với từ khóa "${query}"! Hãy thử từ khóa khác như "funny" hoặc "cat".`,
                    quote: message,
                    mentions: [MessageMention(senderId, senderName.length, 0)],
                    ttl: 30000,
                },
                threadId,
                threadType
            );
            return 0;
        }

        const validResults = results.filter(gif => {
            if (!gif || !gif.media_formats || typeof gif.media_formats !== 'object') {
                return false;
            }
            const formats = gif.media_formats;
            return (
                (formats.webp && formats.webp.url && formats.webp.url.trim()) ||
                (formats.gif && formats.gif.url && formats.gif.url.trim()) ||
                (formats.mediumgif && formats.mediumgif.url && formats.mediumgif.url.trim()) ||
                (formats.nanogif && formats.nanogif.url && formats.nanogif.url.trim()) ||
                (formats.mp4 && formats.mp4.url && formats.mp4.url.trim())
            );
        });

        if (validResults.length === 0) {
            await api.sendMessage(
                {
                    msg: `${senderName}, Không tìm thấy GIF hợp lệ nào trên Tenor với từ khóa "${query}"! Hãy thử từ khóa khác như "funny" hoặc "cat".`,
                    quote: message,
                    mentions: [MessageMention(senderId, senderName.length, 0)],
                    ttl: 30000,
                },
                threadId,
                threadType
            );
            return 0;
        }

        // Xử lý theo số lượng
        if (count === 1 && args.length === 1) {
            // Trường hợp không chỉ định số lượng: chọn ngẫu nhiên 1 sticker
            const randomIndex = Math.floor(Math.random() * validResults.length);
            const media = validResults[randomIndex].media_formats;
            const mediaUrl = media.webp?.url || media.gif?.url || media.mediumgif?.url || media.nanogif?.url || media.mp4?.url || null;
            if (mediaUrl) {
                await processAndSendSticker(api, message, mediaUrl);
            } else {
                await api.sendMessage(
                    {
                        msg: `${senderName}, Không tìm thấy sticker hợp lệ nào cho từ khóa "${query}"! Hãy thử từ khóa khác.`,
                        quote: message,
                        mentions: [MessageMention(senderId, senderName.length, 0)],
                        ttl: 30000,
                    },
                    threadId,
                    threadType
                );
            }
        } else {
            // Trường hợp có số lượng: xử lý và gửi tất cả sticker cùng lúc
            const stickerUrls = validResults.slice(0, count).map(gif => {
                const media = gif.media_formats;
                return media.webp?.url || media.gif?.url || media.mediumgif?.url || media.nanogif?.url || media.mp4?.url || null;
            }).filter(url => url);

            if (stickerUrls.length === 0) {
                await api.sendMessage(
                    {
                        msg: `${senderName}, Không tìm thấy sticker hợp lệ nào cho từ khóa "${query}"! Hãy thử từ khóa khác.`,
                        quote: message,
                        mentions: [MessageMention(senderId, senderName.length, 0)],
                        ttl: 30000,
                    },
                    threadId,
                    threadType
                );
                return 0;
            }

            // Xử lý tất cả sticker trước khi gửi
            const processedStickers = [];
            for (const mediaUrl of stickerUrls) {
                const pathSticker = path.join(tempDir, `sticker_${Date.now()}_${Math.random().toString(36).substring(2, 15)}.temp`);
                const pathWebp = path.join(tempDir, `sticker_${Date.now()}_${Math.random().toString(36).substring(2, 15)}.webp`);

                try {
                    const mediaCheck = await isValidMediaUrl(mediaUrl);
                    if (!mediaCheck.isValid) {
                        continue;
                    }

                    const ext = await checkExstentionFileRemote(mediaUrl);
                    await downloadFile(mediaUrl, pathSticker);

                    const stats = fs.statSync(pathSticker);
                    if (stats.size === 0) {
                        await deleteFile(pathSticker);
                        continue;
                    }

                    if (ext.toLowerCase() === 'webp') {
                        fs.copyFileSync(pathSticker, pathWebp);
                    } else {
                        await convertToWebp(pathSticker, pathWebp);
                    }

                    if (!fs.existsSync(pathWebp) || fs.statSync(pathWebp).size === 0) {
                        await deleteFile(pathSticker);
                        await deleteFile(pathWebp);
                        continue;
                    }

                    const linkUploadZalo = await api.uploadAttachment([pathWebp], appContext.send2meId, MessageType.DirectMessage);
                    const stickerData = await getVideoMetadata(pathWebp);
                    const finalUrl = (linkUploadZalo[0].fileUrl || linkUploadZalo[0].normalUrl || linkUploadZalo[0].url || linkUploadZalo[0].mediaUrl) + "?CreatedBy=HàHuyHoàng.BOT";
                    processedStickers.push({ url: finalUrl, width: stickerData.width, height: stickerData.height });

                    await deleteFile(pathSticker);
                    await deleteFile(pathWebp);
                } catch (error) {
                    console.error(`Lỗi khi xử lý sticker ${mediaUrl}:`, error);
                    await deleteFile(pathSticker);
                    await deleteFile(pathWebp);
                    continue;
                }
            }

            if (processedStickers.length === 0) {
                await api.sendMessage(
                    {
                        msg: `${senderName}, Không thể xử lý sticker nào cho từ khóa "${query}"! Hãy thử lại.`,
                        quote: message,
                        mentions: [MessageMention(senderId, senderName.length, 0)],
                        ttl: 30000,
                    },
                    threadId,
                    threadType
                );
                return 0;
            }

            // Gửi tất cả sticker cùng lúc
            await api.sendMessage(
                {
                    msg: `${senderName}, Đây là ${processedStickers.length} sticker của bạn!`,
                    quote: message,
                    mentions: [MessageMention(senderId, senderName.length, 0)],
                    ttl: 300000,
                },
                threadId,
                threadType
            );

            for (const sticker of processedStickers) {
                await api.sendCustomSticker(
                    message,
                    sticker.url,
                    sticker.url,
                    sticker.width,
                    sticker.height,
                    3600000
                );
            }
        }
    } catch (error) {
        let errorMessage = `${senderName}, Lỗi khi xử lý sticker: ${error.message}`;
        if (error.message.includes("File đầu vào rỗng") || error.message.includes("không tồn tại")) {
            errorMessage = `${senderName}, File GIF từ Tenor không hợp lệ hoặc không tải được. Hãy thử từ khóa khác.`;
        } else if (error.message.includes("Lỗi khi chuyển đổi sang WebP")) {
            errorMessage = `${senderName}, Lỗi khi chuyển đổi GIF sang sticker. Vui lòng thử lại sau.`;
        } else if (error.message.includes("không hợp lệ")) {
            errorMessage = `${senderName}, File từ Tenor không hợp lệ. Hãy thử từ khóa khác.`;
        }
        await api.sendMessage(
            {
                msg: errorMessage,
                quote: message,
                mentions: [MessageMention(senderId, senderName.length, 0)],
                ttl: 30000,
            },
            threadId,
            threadType
        );
    }

    return 0;
}

export async function convertToWebp(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            // Kiểm tra file đầu vào
            if (!fs.existsSync(inputPath)) {
                throw new Error(`File đầu vào không tồn tại: ${inputPath}`);
            }
            const stats = fs.statSync(inputPath);
            if (stats.size === 0) {
                throw new Error(`File đầu vào rỗng: ${inputPath}`);
            }

            // Kiểm tra nếu file đầu vào đã là WebP
            const ext = path.extname(inputPath).toLowerCase();
            if (ext === '.webp') {
                //console.log(`File đầu vào đã là WebP, sao chép sang ${outputPath}`);
                fs.copyFileSync(inputPath, outputPath);
                if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
                    throw new Error(`Sao chép file WebP thất bại: ${outputPath}`);
                }
                resolve(true);
                return;
            }

            // Xác định tùy chọn FFmpeg dựa trên định dạng đầu vào
            let options = [
                '-c:v', 'libvpx-vp9',
                '-lossless', '0',
                '-compression_level', '6',
                '-q:v', '60',
                '-loop', '0',
                '-preset', 'default',
                '-cpu-used', '4',
                '-deadline', 'realtime',
                '-threads', 'auto',
                '-an',
                '-vsync', '0'
            ];

            if (ext === '.mp4' || ext === '.mov' || ext === '.webm') {
                options = options.concat(['-vf', 'fps=10,scale=512:-2:flags=fast_bilinear']);
            } else if (ext === '.gif') {
                options = options.concat(['-vf', 'scale=512:-2:flags=fast_bilinear']);
            } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
                options = options.concat(['-vf', 'scale=512:-2:flags=fast_bilinear']);
            } else {
                throw new Error(`Định dạng file không được hỗ trợ: ${ext}`);
            }

            ffmpeg(inputPath)
                .outputOptions(options)
                .toFormat('webp')
                .on('start', commandLine => {
                    console.log(`FFmpeg command: ${commandLine}`);
                })
                .on('end', () => {
                    console.log(`Chuyển đổi WebP thành công: ${outputPath}`);
                    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
                        throw new Error(`File WebP đầu ra rỗng hoặc không tồn tại: ${outputPath}`);
                    }
                    resolve(true);
                })
                .on('error', (err) => {
                    console.error(`Lỗi FFmpeg: ${err.message}`);
                    reject(new Error(`Lỗi khi chuyển đổi sang WebP: ${err.message}`));
                })
                .save(outputPath);
        } catch (error) {
            console.error(`Lỗi khi xử lý file đầu vào: ${error.message}`);
            reject(error);
        }
    });
}