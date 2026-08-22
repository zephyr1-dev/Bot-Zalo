import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { sendMessageCompleteRequest, sendMessageFailed } from "../../../service-debug/chat-zalo/chat-style/chat-style.js";
import { getCachedMedia, setCacheData } from "../../../utils/link-platform-cache.js";
import { getGlobalPrefix } from "../../../service-debug/service.js";
import { removeMention } from "../../../utils/format-util.js";

const audioFilePath = path.join(process.cwd(), "assets", "resources", "audio");
const convertedCachePath = path.join(audioFilePath, ".converted");
const PLATFORM = "ZaloAudio";

// Tạo thư mục cache nếu chưa có
if (!fs.existsSync(convertedCachePath)) {
    fs.mkdirSync(convertedCachePath);
}

// Hàm chuyển đổi sang mp3 nếu chưa đúng định dạng và lưu cache
async function ensureMp3Format(inputPath) {
    const ext = path.extname(inputPath).toLowerCase();
    const baseName = path.basename(inputPath, ext);
    const cachedMp3Path = path.join(convertedCachePath, `${baseName}.mp3`);

    if (ext === ".mp3") return inputPath;
    if (fs.existsSync(cachedMp3Path)) return cachedMp3Path;

    await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .toFormat("mp3")
            .on("end", resolve)
            .on("error", reject)
            .save(cachedMp3Path);
    });

    return cachedMp3Path;
}

export async function handleSendAudio(api, message, aliasCommand) {
    const prefix = getGlobalPrefix();
    const content = removeMention(message);
    const keyword = content.replace(prefix + aliasCommand, "").trim();

    if (!keyword) {
        const files = fs.readdirSync(audioFilePath).filter(file => !file.startsWith("."));
        const audioList = files.map((file, index) => `${index + 1}. ${path.parse(file).name}`).join("\n");
        await sendMessageCompleteRequest(api, message, {
            caption: `Đây là những file audio đã lưu trữ:\n${audioList}` +
                `\n\nDùng lệnh: ${prefix}${aliasCommand} <tên file> để gửi audio`
        }, 60000);
        return;
    }

    await sendAudio(api, message, keyword);
}

async function sendAudio(api, message, keyword) {
    const files = fs.readdirSync(audioFilePath).filter(file => !file.startsWith("."));
    const audioFile = files.find(file => path.parse(file).name === keyword);

    if (!audioFile) {
        await sendMessageFailed(api, message, "Không tìm thấy file audio với tên này trong thư mục", false);
        return;
    }

    const filePath = path.join(audioFilePath, audioFile);
    const nameLocalFile = keyword;

        

    try {
        // Kiểm tra cache upload trước khi xử lý
        let cachedFile = await getCachedMedia(PLATFORM, audioFile, ".mp3", nameLocalFile);
        let voiceUrl;

        if (cachedFile) {
            voiceUrl = cachedFile.fileUrl;
        } else {
            const mp3FilePath = await ensureMp3Format(filePath);

            // Upload file
            const linkUploadZalo = await api.uploadAttachment([mp3FilePath], message.threadId, message.type);
            voiceUrl = linkUploadZalo[0].fileUrl || linkUploadZalo[0].normalUrl;

            // Lưu cache
            setCacheData(PLATFORM, audioFile, {
                fileUrl: voiceUrl,
                title: nameLocalFile
            }, ".mp3");
        }

        await sendMessageCompleteRequest(api, message, {
                caption: `📤 Đang upload file audio: ${nameLocalFile}...`
            }, 1200000);

            // 🟢 Gửi voice sau khi đã có voiceUrl (cũng lấy từ code 2)
        await api.sendVoice(
            message,
            voiceUrl,
            3600000 // TTL 1 giờ
        );

    } catch (error) {
        console.error("Lỗi khi gửi audio:", error);
        await sendMessageFailed(api, message, "Có lỗi xảy ra khi gửi audio", false);
    }
}
