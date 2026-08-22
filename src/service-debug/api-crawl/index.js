import fs from "fs/promises";
import path from "path";
import schedule from "node-schedule";
import chalk from "chalk";
import axios from "axios";
import { LRUCache } from 'lru-cache';
import { handleSendTrackZingMp3 } from "./music/zingmp3.js";
import { removeMention } from "../../utils/format-util.js";
import { getMessageCache, getMessageCacheByMsgId } from "../../utils/message-cache.js";
import { getBotId, isAdmin } from "../../index.js";
import { handleSendTrackSoundCloud } from "./music/soundcloud.js";
import { handleSendTrackNhacCuaTui } from "./music/nhaccuatui.js";
import { handleSendMediaYoutube } from "./youtube/youtube-service.js";
import { deleteFile } from "../../utils/util.js";
import { sendTikTokVideo } from "./tiktok/tiktok-service.js";
import { handleSendTemplateCapcut } from "./capcut/capcut-service.js";
import { processAndSendMedia } from "./api-hoangdev/aio-downlink.js";
import { handleSpotifyDownloadReply } from "./spotify/spotify-downlink.js";

const TIME_TO_SELECT = 60000;
export const selectionsMapData = new LRUCache({
  max: 500,
  ttl: TIME_TO_SELECT
});

export const getSelectionsMapData = () => selectionsMapData;
export function setSelectionsMapData(idUser, data) {
  deleteSelectionsMapData(idUser);
  selectionsMapData.set(idUser, { ...data });
};
export function deleteSelectionsMapData(idUser) {
  if (selectionsMapData.has(idUser)) {
    selectionsMapData.delete(idUser);
  }
}
export async function checkReplySelectionsMapData(api, message) {
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const isAdminLevelHighest = isAdmin(senderId);
  
  if (message.data?.quote) return false;
  if (selectionsMapData.has(senderId)) {
    const data = selectionsMapData.get(senderId);
    let selection = removeMention(message);
    let [selectedIndex, subCommand] = selection.split(" ");
    selectedIndex = parseInt(selectedIndex) - 1;
    if (isNaN(selectedIndex)) {
      return false;
    }
    const { collection, quotedMsgId } = data;
    if (selectedIndex < 0 || selectedIndex >= collection.length) {
      return false;
    }
    const media = collection[selectedIndex];
    if (!isAdminLevelHighest && media.duration && media.duration > 30 * 60 * 1000) {
      const object = {
        caption: `Thời lượng của lựa chọn bạn chọn vượt quá thời gian tin nhắn tồn tại, vui lòng chọn lựa chọn khác.`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return true;
    }
    deleteSelectionsMapData(senderId);
    const cacheMessage = getMessageCacheByMsgId(quotedMsgId);
    if (cacheMessage) {
      const msgDel = {
        type: cacheMessage.type,
        threadId: cacheMessage.threadId,
        data: {
          cliMsgId: cacheMessage.cliMsgId,
          msgId: cacheMessage.msgId,
          uidFrom: getBotId(),
        },
      };
      await api.deleteMessage(msgDel, false);
    }
    switch (data.platform) {
      case "zingmp3":
        return await handleSendTrackZingMp3(api, message, media, subCommand);
      case "soundcloud":
        return await handleSendTrackSoundCloud(api, message, media);
      case "nhaccuatui":
        return await handleSendTrackNhacCuaTui(api, message, media);
      case "youtube":
        const videoPath = null;
        try {
          await handleSendMediaYoutube(api, message, media, subCommand || "default", videoPath, isAdminLevelHighest);
        } catch (error) {
          if (videoPath) await deleteFile(videoPath);
        }
        return true;
      case "tiktok":
        return await sendTikTokVideo(api, message, media, false, subCommand || "540p");
      case "capcut":
        return await handleSendTemplateCapcut(api, message, media);
      case "downlink":
        let { uniqueId, mediaType, title, duration = 0, author } = data;
        await processAndSendMedia(api, message, {
          selectedMedia: media,
          mediaType,
          uniqueId,
          duration,
          title,
          author,
          senderId,
          senderName
        });
        return true;
      case "spotify":
        return await handleSpotifyDownloadReply(api, message);        
    }
  }
  return false;
};

