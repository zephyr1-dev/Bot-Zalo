import fs from "fs";
import path from "path";
import { sendMessageCompleteRequest, sendMessageFailed } from "../../../service-debug/chat-zalo/chat-style/chat-style.js";
import { getCachedMedia, setCacheData } from "../../../utils/link-platform-cache.js";
import { getGlobalPrefix } from "../../../service-debug/service.js";
import { removeMention } from "../../../utils/format-util.js";

const dataImagePath = path.join(process.cwd(), "assets", "resources", "image");
const PLATFORM = "ZaloImage";

export async function handleSendImage(api, message, aliasCommand) {
    const prefix = getGlobalPrefix();
    const content = removeMention(message);
    const keyword = content.replace(prefix + aliasCommand, "").trim();

    if (!keyword) {
        const files = fs.readdirSync(dataImagePath);
        const fileList = files.map((file, index) => `${index + 1}. ${path.parse(file).name}`).join("\n");
        await sendMessageCompleteRequest(api, message, {
            caption: `Đây là những hình ảnh đã lưu trữ:\n${fileList}`
                + `\n\nDùng lệnh: ${prefix}${aliasCommand} <tên ảnh> để gửi ảnh`
        }, 60000);
        return;
    }

    await sendImage(api, message, keyword);
}

async function sendImage(api, message, keyword) {
    const files = fs.readdirSync(dataImagePath);
    const imageFile = files.find(file => path.parse(file).name === keyword);
    
    if (!imageFile) {
        await sendMessageFailed(api, message, "Không tìm thấy ảnh với tên này trong thư mục", false);
        return;
    }
    
    const fileExt = path.parse(imageFile).ext;
    const imagePath = path.join(dataImagePath, imageFile);
    const nameLocalImage = keyword;

    try {
        let cachedImage = await getCachedMedia(PLATFORM, imageFile, fileExt, nameLocalImage);
        let imageUrl;

        if (cachedImage) {
            imageUrl = cachedImage.fileUrl;
        } else {
            // Upload ảnh lên Zalo
            const linkUploadZalo = await api.uploadAttachment([imagePath], message.threadId, message.type);
            imageUrl = linkUploadZalo[0].fileUrl || linkUploadZalo[0].normalUrl;

            // Cache lại thông tin ảnh đã upload
            setCacheData(PLATFORM, imageFile, {
                fileUrl: imageUrl,
                title: nameLocalImage
            }, fileExt);
        }

        // Sửa lại cấu trúc message để gửi
        await api.sendMessage(
            {
                msg: `Ảnh: ${nameLocalImage}`,
                attachments: [imagePath], // Sử dụng đường dẫn file thay vì URL
                ttl: 3600000 // 1 giờ
            },
            message.threadId,
            message.type
        );

    } catch (error) {
        console.error("Lỗi khi gửi ảnh:", error);
        await sendMessageFailed(api, message, "Có lỗi xảy ra khi gửi ảnh", false);
    }
}