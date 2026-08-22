import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, makeURL, request, handleZaloResponse } from "../utils.js";
import { Zalo } from "../index.js";
import { MessageType } from "../models/Message.js";

export function zSendLocalImageFactory(api) {
    /**
     * Gửi ảnh từ file local
     * 
     * @param {string} imagePath Đường dẫn đến file ảnh cần gửi
     * @param {string|number} threadId ID của người dùng/nhóm cần gửi đến
     * @param {MessageType} threadType MessageType.UserMessage hoặc MessageType.GroupMessage
     * @param {number} [width=2560] Chiều rộng của ảnh
     * @param {number} [height=2560] Chiều cao của ảnh
     * @param {object} [message=null] Tin nhắn đi kèm với ảnh
     * @param {object} [customPayload=null] Tùy chọn payload tùy chỉnh
     * @param {number} [ttl=0] Thời gian tồn tại của tin nhắn
     * @throws {ZaloApiError}
     * @returns {Promise<User|Group|object>} Đối tượng User/Group phản hồi hoặc dữ liệu lỗi
     */
    return async function sendLocalImage(imagePath, threadId, threadType, width = 2560, height = 2560, message = null, customPayload = null, ttl = 0) {
        if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
            throw new ZaloApiError("Thiếu các trường bắt buộc trong app context");
        
        const params = {
            zpw_ver: Zalo.API_VERSION,
            zpw_type: Zalo.API_TYPE,
            nretry: "0"
        };

        let url;
        let payload;

        if (customPayload) {
            if (threadType === MessageType.UserMessage) {
                url = "https://tt-files-wpa.chat.zalo.me/api/message/photo_original/send";
            } else if (threadType === MessageType.GroupMessage) {
                url = "https://tt-files-wpa.chat.zalo.me/api/group/photo_original/send";
            } else {
                throw new ZaloApiError("Loại thread không hợp lệ");
            }
            
            payload = customPayload;
        } else {
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
                url = "https://tt-files-wpa.chat.zalo.me/api/message/photo_original/send";
                payloadParams.toid = String(threadId);
                payloadParams.normalUrl = imageData.normalUrl;
            } else if (threadType === MessageType.GroupMessage) {
                url = "https://tt-files-wpa.chat.zalo.me/api/group/photo_original/send";
                payloadParams.grid = String(threadId);
                payloadParams.oriUrl = imageData.normalUrl;
            } else {
                throw new ZaloApiError("Loại thread không hợp lệ");
            }

            payload = { params: payloadParams };
        }

        payload.params = encodeAES(appContext.secretKey, JSON.stringify(payload.params));
        if (!payload.params) throw new ZaloApiError("Không thể mã hóa thông điệp");

        const response = await request(makeURL(url, params), {
            method: "POST",
            body: new URLSearchParams(payload),
        });

        const data = await response.json();
        
        const results = data.error_code === 0 ? data.data : null;
        
        if (results) {
            const decodedResults = api._decode ? api._decode(results) : results;
            const finalResults = decodedResults.data ? decodedResults.data : decodedResults;
            
            if (finalResults === null) {
                return { error_code: 1337, error_message: "Data is None" };
            }
            
            let parsedResults = finalResults;
            if (typeof finalResults === 'string') {
                try {
                    parsedResults = JSON.parse(finalResults);
                } catch {
                    return { error_code: 1337, error_message: finalResults };
                }
            }
            
            return parsedResults;
        }
        
        const errorCode = data.error_code;
        const errorMessage = data.error_message || data.data;
        throw new ZaloApiError(`Lỗi #${errorCode} khi gửi yêu cầu: ${errorMessage}`);
    };
}