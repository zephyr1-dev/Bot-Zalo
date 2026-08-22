import { appContext } from "../context.js";
import { Zalo, ZaloApiError } from "../index.js";
import { GroupMessage, Message, MessageType } from "../models/Message.js";
import { encodeAES, handleZaloResponse, request } from "../utils.js";
export function undoMessageFactory(api) {
  const URLType = {
    [MessageType.DirectMessage]: `${api.zpwServiceMap.chat[0]}/api/message/undo?zpw_ver=${Zalo.API_VERSION}&zpw_type=${Zalo.API_TYPE}`,
    [MessageType.GroupMessage]: `${api.zpwServiceMap.group[0]}/api/group/undomsg?zpw_ver=${Zalo.API_VERSION}&zpw_type=${Zalo.API_TYPE}`,
  };
  /**
   * Undo a message
   *
   * @param message Message or GroupMessage instance that has quote to undo
   *
   * @throws ZaloApiError
   */
  return async function undo(message) {
		if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
			throw new ZaloApiError("Missing required app context fields");
    if (!message.data.quote) throw new ZaloApiError("Message does not have quote");
    const params = {
      msgId: message.data.quote.globalMsgId,
      clientId: Date.now()*600,
      cliMsgIdUndo: message.data.quote.cliMsgId,
    };

    if (message.type === MessageType.GroupMessage) {
      params["grid"] = message.threadId;
      params["visibility"] = 0;
      params["imei"] = appContext.imei;
    } else params["toid"] = message.threadId;
    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");
    const response = await request(URLType[message.type], {
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
