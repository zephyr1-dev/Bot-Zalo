import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, makeURL, request, handleZaloResponse } from "../utils.js";
import { Zalo } from "../index.js";
import { MessageType } from "../models/Message.js";

export function zSendMultiLocalImageFactory(api) {
    /**
     * Gửi nhiều ảnh từ file local
     * 
     * @param {string[]} imagePathList Danh sách đường dẫn đến các file ảnh cần gửi
     * @param {string|number} threadId ID của người dùng/nhóm cần gửi đến
     * @param {MessageType} threadType MessageType.UserMessage hoặc MessageType.GroupMessage
     * @param {number} [width=2560] Chiều rộng của ảnh
     * @param {number} [height=2560] Chiều cao của ảnh
     * @param {object} [message=null] Tin nhắn đi kèm với ảnh
     * @param {number} [ttl=0] Thời gian tồn tại của tin nhắn
     * @throws {ZaloApiError}
     * @returns {Promise<object>} Kết quả từ việc gửi ảnh
     */
    return async function sendMultiLocalImage(imagePathList, threadId, threadType, width = 2560, height = 2560, message = null, ttl = 0) {
        if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
            throw new ZaloApiError("Thiếu các trường bắt buộc trong app context");
        
        if (!Array.isArray(imagePathList) || imagePathList.length < 1)
            throw new ZaloApiError("Đường dẫn ảnh phải là một mảng để có thể gửi nhiều ảnh cùng lúc.");
        
        const uploadData = [];
        const groupLayoutId = Date.now().toString();
        
        for (let i = 0; i < imagePathList.length; i++) {
            const imagePath = imagePathList[i];
            
            const uploadImage = await api.uploadAttachment([imagePath], threadId, threadType);
            if (!uploadImage || uploadImage.length === 0) {
                throw new ZaloApiError("Lỗi khi tải lên ảnh");
            }
            
            const imageData = uploadImage[0];
            const now = Date.now();
            
            const payloadParams = {
                photoId: imageData.photoId || Math.floor(now / 1000),
                clientId: imageData.clientFileId || Math.floor(now - 1000),
                desc: message?.text || "",
                width: width,
                height: height,
                groupLayoutId: groupLayoutId,
                totalItemInGroup: imagePathList.length,
                isGroupLayout: 1,
                idInGroup: i,
                rawUrl: imageData.normalUrl,
                thumbUrl: imageData.thumbUrl,
                hdUrl: imageData.hdUrl,
                thumbSize: "53932",
                fileSize: "247671",
                hdSize: imageData.hdSize || "344622",
                zsource: -1,
                jcp: JSON.stringify({ sendSource: 1, convertible: "jxl" }),
                ttl: ttl,
                imei: appContext.imei
            };
            
            if (message && message.mention) {
                payloadParams.mentionInfo = message.mention;
            }
            
            if (threadType === MessageType.UserMessage) {
                payloadParams.toid = String(threadId);
                payloadParams.normalUrl = imageData.normalUrl;
            } else if (threadType === MessageType.GroupMessage) {
                payloadParams.grid = String(threadId);
                payloadParams.oriUrl = imageData.normalUrl;
            } else {
                throw new ZaloApiError("Loại thread không hợp lệ");
            }
            
            const payload = { params: payloadParams };
            const data = await api.zSendLocalImage(imagePath, threadId, threadType, width, height, message, payload, ttl);
            uploadData.push(data);
        }
        
        return uploadData;
    };
}