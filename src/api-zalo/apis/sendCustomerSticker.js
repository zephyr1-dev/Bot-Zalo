import { appContext } from "../context.js";
import { Zalo, ZaloApiError } from "../index.js";
import { MessageType } from "../models/Message.js";
import { encodeAES, handleZaloResponse, makeURL, request } from "../utils.js";

export function sendCustomStickerFactory(api) {
  const directMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/message/photo_url`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
    nretry: "0",
  });
  const groupMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/group/photo_url`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
    nretry: "0",
  });
  /**
   * Gửi sticker tùy chỉnh (static/animation) đến một cuộc trò chuyện
   *
   * @param {Message} message Tin nhắn để gửi sticker
   * @param {string} staticImgUrl URL ảnh tĩnh (png, jpg, jpeg) để tạo sticker
   * @param {string} animationImgUrl URL ảnh động (webp) để tạo sticker
   * @param {number} [width] Chiều rộng của sticker
   * @param {number} [height] Chiều cao của sticker
   * @param {number} [ttl=0] Thời gian tồn tại của tin nhắn
   * @throws {ZaloApiError}
   */
  return async function sendCustomSticker(message, staticImgUrl, animationImgUrl, width = null, height = null, ttl = 0) {
    if (!appContext.secretKey) throw new ZaloApiError("Secret key is not available");
    if (!appContext.imei) throw new ZaloApiError("IMEI is not available");
    if (!appContext.cookie) throw new ZaloApiError("Cookie is not available");
    if (!appContext.userAgent) throw new ZaloApiError("User agent is not available");
    if (!staticImgUrl) throw new ZaloApiError("Missing static image URL");
    if (!animationImgUrl) throw new ZaloApiError("Missing animation image URL");
    if (!message) throw new ZaloApiError("Missing message");

    const type = message.type;
    const threadId = message.threadId;
    const quote = message.data.quote;

    width = width ? parseInt(width) : 498;
    height = height ? parseInt(height) : 332;
    const isGroupMessage = type === MessageType.GroupMessage;

    const params = {
      clientId: Date.now()*600,
      title: "",
      oriUrl: staticImgUrl,
      thumbUrl: staticImgUrl,
      hdUrl: staticImgUrl,
      width,
      height,
      properties: JSON.stringify({
        subType: 0,
        color: -1,
        size: -1,
        type: 3,
        ext: JSON.stringify({
          sSrcStr: "@STICKER",
          sSrcType: 0,
        }),
      }),
      contentId: Date.now(),
      thumb_height: width,
      thumb_width: height,
      webp: JSON.stringify({
        width,
        height,
        url: animationImgUrl,
      }),
      zsource: -1,
      ttl,
    };

    if (quote) {
      params.refMessage = quote.cliMsgId.toString();
    }

    if (isGroupMessage) {
      params.visibility = 0;
      params.grid = threadId.toString();
    } else {
      params.toId = threadId.toString();
    }

    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");

    const finalServiceUrl = new URL(isGroupMessage ? groupMessageServiceURL : directMessageServiceURL);
    const response = await request(finalServiceUrl.toString(), {
      method: "POST",
      body: new URLSearchParams({
        params: encryptedParams,
      }),
    });

    const result = await handleZaloResponse(response);
    if (result.error) {
      throw new ZaloApiError(result.error.message, result.error.code);
    }

    return result.data;
  };
}
