import path from "path";
import schedule from "node-schedule";
import fs from "fs";
import { formatTime } from "./format-util.js";

const loggingMessageJsonPath = path.join(process.cwd(), "logs", "message.json");
let messageCache = {};
let hasChanges = false;

export const getMessageCache = () => messageCache;
export function getMessageCacheByMsgId(msgId) {
  return Object.values(messageCache).find((message) => message.msgId === msgId);
}

function loadMessageCache() {
  messageCache = readMessageJson();
}

function saveMessageCache() {
  if (hasChanges) {
    writeMessageJson(messageCache);
    hasChanges = false;
  }
}

export function readMessageJson() {
  try {
    if (!fs.existsSync(loggingMessageJsonPath)) {
      fs.writeFileSync(loggingMessageJsonPath, "{}");
      return {};
    }
    const data = fs.readFileSync(loggingMessageJsonPath, "utf-8");
    if (!data.trim()) return {};
    return JSON.parse(data);
  } catch (error) {
    console.error("Lỗi khi đọc hoặc parse file message.json:", error.message);
    return {};
  }
}

export function writeMessageJson(data) {
  try {
    fs.writeFileSync(loggingMessageJsonPath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Lỗi khi ghi file message.json:", error);
  }
}

function cleanOldMessages() {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  let hasDeleted = false;

  Object.keys(messageCache).forEach((key) => {
    if (messageCache[key].timestamp < oneDayAgo) {
      delete messageCache[key];
      hasDeleted = true;
    }
  });

  if (hasDeleted) {
    hasChanges = true;
  }
}

loadMessageCache();

schedule.scheduleJob("*/5 * * * * *", () => {
  saveMessageCache();

  if (new Date().getSeconds() === 0) {
    cleanOldMessages();
  }
});

const listSaveLogMess = [
  "webchat",
  "chat.photo",
  "chat.gif",
  "chat.video.msg",
  "chat.recommended",
  "chat.sticker",
  "chat.voice",
  "share.file",
];

export function updateMessageCache(data) {
  try {
    // if (listSaveLogMess.includes(data.data.msgType)) {
      const timestamp = formatTime(new Date());
      const filterData = {
        timestamp: data.data.ts,
        timestampString: timestamp,
        msgId: data.data.msgId,
        cliMsgId: data.data.cliMsgId,
        msgType: data.data.msgType,
        uidFrom: data.data.uidFrom,
        idTo: data.data.idTo,
        dName: data.data.dName,
        content: data.data.content,
        threadId: data.threadId,
        type: data.type,
        isUndo: false,
      };
      messageCache[data.data.cliMsgId] = {
        ...filterData,
      };
      hasChanges = true;
    // }
  } catch {
  }
}