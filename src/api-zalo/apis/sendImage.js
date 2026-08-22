import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";
import { Zalo } from "../index.js";
import { MessageType } from "../models/Message.js";
import { getImageInfo } from "../../utils/util.js";

export function sendImageFactory(api) {
	const directMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/message/photo_original/send`, {
		zpw_ver: Zalo.API_VERSION,
		zpw_type: Zalo.API_TYPE,
		nretry: "0",
	});

	const groupMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/group/photo_original/send`, {
		zpw_ver: Zalo.API_VERSION,
		zpw_type: Zalo.API_TYPE,
		nretry: "0",
	});

	/**
	 * Gửi ảnh từ URL
	 * 
	 * @param {string} imageUrl URL của ảnh
	 * @param {object} message Tin Nhắn
	 * @param {string} caption Tiêu đề của ảnh
	 * @param {number} [ttl=0] Ttl của tin nhắn
	 * @throws {ZaloApiError}
	 */
	return async function sendImage(imageUrl, message, caption = "", ttl = 0) {
		if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
			throw new ZaloApiError("Missing required app context fields");
		if (!imageUrl) throw new ZaloApiError("Missing image URL");
		if (!message) throw new ZaloApiError("Missing message object");

		const dataImage = await getImageInfo(imageUrl);
		if (!dataImage) throw new ZaloApiError("Failed to get image info");
		if (dataImage.totalSize && dataImage.totalSize < 1024) throw new ZaloApiError("Ảnh quá nhỏ");

		const threadId = message.threadId;
		const threadType = message.type;
		const clientId = Date.now().toString();

		const params = {
			photoId: Math.floor(Date.now() / 1000),
			clientId: clientId,
			desc: caption,
			width: dataImage.width || 500,
			height: dataImage.height || 500,
			rawUrl: imageUrl,
			thumbUrl: imageUrl,
			hdUrl: imageUrl,
			toid: threadType === MessageType.UserMessage ? String(threadId) : undefined,
			grid: threadType === MessageType.GroupMessage ? String(threadId) : undefined,
			oriUrl: threadType === MessageType.GroupMessage ? imageUrl : undefined,
			normalUrl: threadType === MessageType.UserMessage ? imageUrl : undefined,
			hdSize: String(dataImage.totalSize || 0),
			zsource: -1,
			jcp: JSON.stringify({
				sendSource: 1,
				convertible: "jxl"
			}),
			ttl: ttl,
			imei: appContext.imei
		};

		if (message.mentions) {
			params.mentionInfo = JSON.stringify(message.mentions);
		}

		const url = threadType === MessageType.GroupMessage ?
			groupMessageServiceURL : directMessageServiceURL;

		const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
		if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");
		const response = await request(url, {
			method: "POST",
			body: new URLSearchParams({
				params: encryptedParams,
			}),
		});

		const result = await handleZaloResponse(response);
		if (result.error) throw new ZaloApiError(result.error.message, result.error.code);
		return result.data;
	};
} 