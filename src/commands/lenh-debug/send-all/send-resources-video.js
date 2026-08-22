import fs from "fs";
import path from "path";
import { sendMessageCompleteRequest, sendMessageFailed } from "../../../service-debug/chat-zalo/chat-style/chat-style.js";
import { getCachedMedia, setCacheData } from "../../../utils/link-platform-cache.js";
import { getGlobalPrefix } from "../../../service-debug/service.js";
import { removeMention } from "../../../utils/format-util.js";

const dataVideoPath = path.join(process.cwd(), "assets", "resources", "video");
const PLATFORM = "ZaloVideo";

export async function handleSendVideo(api, message, aliasCommand) {
    const prefix = getGlobalPrefix();
    const content = removeMention(message);
    const keyword = content.replace(prefix + aliasCommand, "").trim();

    if (!keyword) {
        const files = fs.readdirSync(dataVideoPath);
        const fileList = files.map((file, index) => `${index + 1}. ${path.parse(file).name}`).join("\n");
        await sendMessageCompleteRequest(api, message, {
            caption: `Đây là những video đã lưu trữ:\n${fileList}`
                + `\n\nDùng lệnh: ${prefix}${aliasCommand} <tên video> để gửi video`
        }, 60000);
        return;
    }

    await sendVideo(api, message, keyword);
}

async function sendVideo(api, message, keyword) {
    const files = fs.readdirSync(dataVideoPath);
    const videoFile = files.find(file => path.parse(file).name === keyword);
    
    if (!videoFile) {
        await sendMessageFailed(api, message, "Không tìm thấy video với tên này trong thư mục", false);
        return;
    }
    
    const fileExt = path.parse(videoFile).ext;
    const videoPath = path.join(dataVideoPath, videoFile);
    const nameLocalVideo = keyword;

    try {
        let cachedVideo = await getCachedMedia(PLATFORM, videoFile, fileExt, nameLocalVideo);
        let videoUrl;

        if (cachedVideo) {
            videoUrl = cachedVideo.fileUrl;
        } else {
            const linkUploadZalo = await api.uploadAttachment([videoPath], message.threadId, message.type);
            videoUrl = linkUploadZalo[0].fileUrl || linkUploadZalo[0].normalUrl;

            setCacheData(PLATFORM, videoFile, {
                fileUrl: videoUrl,
                title: nameLocalVideo
            }, fileExt);
        }

        // Thay đổi phần này để sử dụng sendVideo thay vì sendMessage
        await api.sendVideo({
            videoUrl: videoUrl,  // Sử dụng URL video thay vì đường dẫn local
            threadId: message.threadId,
            threadType: message.type,
            message: {
                text: `Video: ${nameLocalVideo}`
            },
            ttl: 3600000
        });

    } catch (error) {
        console.error("Lỗi khi gửi video:", error);
        await sendMessageFailed(api, message, "Có lỗi xảy ra khi gửi video", false);
    }
}