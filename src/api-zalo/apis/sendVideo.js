import path from "path";
import { appContext } from "../context.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { encodeAES, getVideoMetadata, handleZaloResponse, makeURL, request } from "../utils.js";
import { Zalo } from "../index.js";
import { MessageType } from "../models/Message.js";
import { deleteFile, execAsync } from "../../utils/util.js";
import { tempDir } from "../../utils/io-json.js";

export function sendVideoFactory(api) {
  const directMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/message/forward`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
    nretry: 0,
  });
  const groupMessageServiceURL = makeURL(`${api.zpwServiceMap.file[0]}/api/group/forward`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
    nretry: 0,
  });
  function handleMentions(type, msg, mentions) {
    let totalMentionLen = 0;
    const mentionsFinal =
      Array.isArray(mentions) && type == MessageType.GroupMessage
        ? mentions
          .filter((m) => m.pos >= 0 && m.uid && m.len > 0)
          .map((m) => {
            totalMentionLen += m.len;
            return {
              pos: m.pos,
              uid: m.uid,
              len: m.len,
              type: m.uid == "-1" ? 1 : 0,
            };
          })
        : [];
    if (totalMentionLen > msg.length) {
      throw new ZaloApiError("Invalid mentions: total mention characters exceed message length");
    }
    return {
      mentionsFinal,
      msgFinal: msg,
    };
  }
  return async function sendVideo({ videoUrl, threadId, threadType, message = null, thumbnail = null, ttl = 0, duration = 0 }) {
    if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
      throw new ZaloApiError("Missing required app context fields");
    let width = 1280;
    let height = 720;
    let thumbnailUrl = null;
    let fileSize = 0;
    try {
      const { duration: videoDuration, width: videoWidth, height: videoHeight, fileSize: videoFileSize } = await getVideoMetadata(videoUrl);
      duration = videoDuration || duration || 0;
      width = videoWidth || 1280;
      height = videoHeight || 720;
      fileSize = videoFileSize || 0;
      if (thumbnail) {
        thumbnailUrl = thumbnail;
      } else {
        if (message) {
          const tempThumbnail = path.join(tempDir, `thumbnail_${Date.now()}.jpg`);
          const ffmpegCommand = ["ffmpeg", "-i", videoUrl, "-ss", "00:00:06", "-vframes", "1", tempThumbnail].join(" ");
          await execAsync(ffmpegCommand);
          const linkThumbnail = await api.uploadAttachment([tempThumbnail], threadId, message.type);
          await deleteFile(tempThumbnail);
          thumbnailUrl = linkThumbnail ? linkThumbnail[0].hdUrl || linkThumbnail[0].normalUrl : null;
        } else {
          thumbnailUrl = videoUrl.replace(/\.[^/.]+$/, ".jpg") || null;
        }
      }
    } catch (error) {
      throw new ZaloApiError(`Unable to get video content: ${error.message}`);
    }

    const payload = {
      params: {
        clientId: String(Date.now())*600,
        ttl: ttl,
        zsource: 704,
        msgType: 5,
        msgInfo: JSON.stringify({
          videoUrl: String(videoUrl),
          thumbUrl: String(thumbnailUrl),
          duration: Number(duration),
          width: Number(width),
          height: Number(height),
          fileSize: Number(fileSize),
          properties: {
            color: -1,
            size: -1,
            type: 1003,
            subType: 0,
            ext: {
              sSrcType: -1,
              sSrcStr: "",
              msg_warning_type: 0,
            },
          },
          title: message ? message.text : "",
        }),
      },
    };

    if (message && message.mentions) {
      const { mentionsFinal } = handleMentions(message.type, message, message.mentions);
      payload.params.mentionInfo = mentionsFinal;
    }

    let url;
    if (threadType === MessageType.DirectMessage) {
      url = directMessageServiceURL;
      payload.params.toId = String(threadId);
      payload.params.imei = appContext.imei;
    } else if (threadType === MessageType.GroupMessage) {
      url = groupMessageServiceURL;
      payload.params.visibility = 0;
      payload.params.grid = String(threadId);
      payload.params.imei = appContext.imei;
    } else {
      throw new ZaloApiError("Thread type is invalid");
    }

    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(payload.params));
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
