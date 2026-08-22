import { MessageMention, MessageType } from "zlbotdqt";
import schedule from "node-schedule";
import { getGroupInfoData } from "../../service-debug/info-service/group-info.js";
import { getUserInfoData } from "../../service-debug/info-service/user-info.js";
import * as cv from "../../utils/canvas/index.js";
import { sendMessageStateQuote } from "../chat-zalo/chat-style/chat-style.js";
import { isInWhiteList } from "./white-list.js";
import { removeMention } from "../../utils/format-util.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PHONE_WHITELIST_FILE = path.join(__dirname, "phone-whitelist.json");
const CACHE_TTL = 5 * 60 * 1000;
let phoneSettingsCache = {};
let lastCacheUpdate = 0;

async function loadPhoneRegex() {
  return new RegExp(/0[\d.\s]{9,12}\b/g);
}

const phoneRegex = await loadPhoneRegex();

let phoneSendCount = {};
let phoneSendTime = {};

async function readPhoneSettings() {
  const now = Date.now();
  if (now - lastCacheUpdate < CACHE_TTL) {
    return phoneSettingsCache;
  }

  try {
    const data = await fs.readFile(PHONE_WHITELIST_FILE, "utf8");
    const parsedData = JSON.parse(data) || {};
    
    Object.keys(parsedData).forEach(groupId => {
      if (!parsedData[groupId].patterns) {
        parsedData[groupId] = {
          patterns: Array.isArray(parsedData[groupId]) ? parsedData[groupId] : []
        };
      }
    });

    phoneSettingsCache = parsedData;
    lastCacheUpdate = now;
    return parsedData;
  } catch (error) {
    if (error.code === "ENOENT") {
      const emptyObject = {};
      await fs.mkdir(path.dirname(PHONE_WHITELIST_FILE), { recursive: true });
      await fs.writeFile(PHONE_WHITELIST_FILE, JSON.stringify(emptyObject, null, 2));
      return emptyObject;
    }
    return {};
  }
}

async function writePhoneSettings(settings) {
  await fs.writeFile(PHONE_WHITELIST_FILE, JSON.stringify(settings, null, 2));
  phoneSettingsCache = settings;
  lastCacheUpdate = Date.now();
}

function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '');
}

function isWhitelisted(phone, whitelistedPatterns) {
  if (!whitelistedPatterns.length) return false;
  const normalized = normalizePhone(phone);
  return whitelistedPatterns.some(pattern => normalized.includes(pattern));
}

function detectPhoneNumber(content) {
  if (typeof content !== "string") {
    content = JSON.stringify(content);
  }

  const matches = content.match(phoneRegex);
  if (!matches) return false;

  for (const match of matches) {
    const digitsOnly = normalizePhone(match);
    if (digitsOnly.length === 10) {
      return true;
    }
  }

  return false;
}

function checkPhone(content) {
  return detectPhoneNumber(content);
}

export async function antiPhoneNumber(
  api,
  message,
  isAdminBox,
  groupSettings,
  botIsAdminBox,
  isSelf
) {
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const threadId = message.threadId;
  const messageId = message.msgId;

  if (
    isSelf ||
    isAdminBox ||
    !botIsAdminBox ||
    !groupSettings[threadId]?.antiPhoneNumber
  ) {
    return false;
  }

  return await handlePhoneMessage(
    api,
    message,
    groupSettings,
    isAdminBox,
    threadId,
    senderId,
    senderName,
    !!messageId
  );
}

export async function handleAntiPhoneNumberCommand(
  api,
  message,
  groupSettings
) {
  const threadId = message.threadId;
  let isChangeSetting = false;
  const content = removeMention(message);
  const parts = content.split(" ");
  const subcommand = parts[1]?.toLowerCase();
  const phoneSettings = await readPhoneSettings();
  if (!phoneSettings[threadId]) {
    phoneSettings[threadId] = {
      patterns: []
    };
  }

  if (subcommand === "add" && parts[2]) {
    const pattern = parts[2].toLowerCase();
    if (!phoneSettings[threadId].patterns.includes(pattern)) {
      phoneSettings[threadId].patterns.push(pattern);
      await writePhoneSettings(phoneSettings);
      await sendMessageStateQuote(api, message, `Đã thêm "${pattern}" vào danh sách trắng số điện thoại.`, true, 300000);
      isChangeSetting = true;
    } else {
      await sendMessageStateQuote(api, message, `"${pattern}" đã có trong danh sách trắng số điện thoại.`, false, 300000);
    }
  } else if (subcommand === "remove" && parts[2]) {
    const pattern = parts[2].toLowerCase();
    if (phoneSettings[threadId].patterns.includes(pattern)) {
      phoneSettings[threadId].patterns = phoneSettings[threadId].patterns.filter(p => p !== pattern);
      if (phoneSettings[threadId].patterns.length === 0) {
        delete phoneSettings[threadId];
      }
      await writePhoneSettings(phoneSettings);
      await sendMessageStateQuote(api, message, `Đã xóa "${pattern}" khỏi danh sách trắng số điện thoại.`, true, 300000);
      isChangeSetting = true;
    } else {
      await sendMessageStateQuote(api, message, `"${pattern}" không tồn tại trong danh sách trắng số điện thoại.`, false, 300000);
    }
  } else if (subcommand === "list") {
    const patterns = phoneSettings[threadId]?.patterns || [];
    const caption = patterns.length > 0
      ? `Danh sách số điện thoại bỏ qua:\n${patterns.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
      : "Hiện không có số điện thoại nào trong danh sách trắng.";
    await sendMessageStateQuote(api, message, caption, patterns.length > 0, 300000);
  } else if (subcommand === "clearall") {
    if (phoneSettings[threadId]?.patterns?.length > 0) {
      phoneSettings[threadId].patterns = [];
      delete phoneSettings[threadId];
      await writePhoneSettings(phoneSettings);
      await sendMessageStateQuote(api, message, `Đã xóa tất số điện thoại khỏi danh sách trắng.`, true, 300000);
      isChangeSetting = true;
    } else {
      await sendMessageStateQuote(api, message, `Danh sách trắng hiện đang rỗng.`, false, 300000);
    }
  } else {
    const status = parts[1]?.toLowerCase();
    if (!groupSettings[threadId]) {
      groupSettings[threadId] = {};
    }
    const newStatus =
      status === "on"
        ? true
        : status === "off"
          ? false
          : !groupSettings[threadId].antiPhoneNumber;
    groupSettings[threadId].antiPhoneNumber = newStatus;
    isChangeSetting = true;
    const statusText = newStatus ? "bật" : "tắt";
    const caption = `Chức năng chống gửi số điện thoại đã được ${statusText}!`;
    await sendMessageStateQuote(api, message, caption, newStatus, 300000);
  }

  return isChangeSetting;
}

async function handlePhoneMessage(
  api,
  message,
  groupSettings,
  isAdminBox,
  threadId,
  senderId,
  senderName,
  hasValidId = false
) {
  let content = message.data.content;
  if (typeof content === 'object' && content !== null) {
    content = content.caption || content.title || JSON.stringify(content);
  }
  if (typeof content !== 'string') {
    content = String(content || '');
  }
  let isDeletePhone = false;
  const isUserWhiteList = isInWhiteList(groupSettings, threadId, senderId);
  const phoneSettings = await readPhoneSettings();
  const whitelistedPatterns = phoneSettings[threadId]?.patterns || [];

  if (isUserWhiteList) {
    return isDeletePhone;
  }

  const hasPhone = checkPhone(content);

  if (hasPhone) {
    const matches = content.match(phoneRegex);
    if (matches && !matches.some(phone => isWhitelisted(phone, whitelistedPatterns))) {
      let deleteSuccess = false;

      const delayedDelete = () => {
        return new Promise((resolve) => {
          setTimeout(async () => {
            try {
              const deleteResult = await api.deleteMessage(message, false);
              if (deleteResult && deleteResult.status === 0) {
                deleteSuccess = true;
                resolve(true);
                return;
              }
            } catch (error) {
              try {
                await api.deleteMessage(threadId, message.msgId);
                deleteSuccess = true;
                resolve(true);
              } catch (e2) {
                try {
                  await api.deleteMessage(threadId, message);
                  deleteSuccess = true;
                  resolve(true);
                } catch (e3) {
                  resolve(false);
                }
              }
            }
          }, 1000);
        });
      };

      await delayedDelete();

      if (deleteSuccess) {
        isDeletePhone = true;
        await updatePhoneCount(
          api,
          message,
          threadId,
          senderId,
          senderName,
          isAdminBox,
          deleteSuccess
        );
      } else {
        await api.sendMessage(
          {
            msg: "Nhờn với tào à ;!",
            quote: message,
            ttl: 300000,
          },
          threadId,
          MessageType.GroupMessage
        );
        await blockUser(api, message, threadId, senderId, senderName);
        return true;
      }
    }
  }

  return isDeletePhone;
}

async function updatePhoneCount(
  api,
  message,
  threadId,
  senderId,
  senderName,
  isAdminBox,
  deleteSuccess = true
) {
  if (!phoneSendCount[senderId]) {
    phoneSendCount[senderId] = 0;
    phoneSendTime[senderId] = Date.now();
  }

  phoneSendCount[senderId]++;

  if (isAdminBox) {
    return;
  }

  if (Date.now() - phoneSendTime[senderId] < 60 * 1000) {
    if (phoneSendCount[senderId] > 2) {
      await blockUser(api, message, threadId, senderId, senderName);
      return;
    }
  } else {
    phoneSendCount[senderId] = 1;
    phoneSendTime[senderId] = Date.now();
  }

  await sendWarningMessage(api, message, senderId, senderName, phoneSendCount[senderId], deleteSuccess);
}

async function blockUser(api, message, threadId, senderId, senderName) {
  try {
    await api.blockUsers(threadId, [senderId]);
    const groupInfo = await getGroupInfoData(api, threadId);
    const userInfo = await getUserInfoData(api, senderId);
    const imagePath = await cv.createBlockSpamImage(
      userInfo,
      groupInfo.name,
      groupInfo.groupType,
      userInfo.gender
    );


    try {
 
    } catch (error) {}

    await cv.clearImagePath(imagePath);
  } catch (error) {}
  finally {
    delete phoneSendCount[senderId];
    delete phoneSendTime[senderId];
  }
}

async function sendWarningMessage(api, message, senderId, senderName, count) {
  let caption = `⚠️ Cảnh cáo ${senderName}!\nỞ đây cấm gửi số điện thoại`;
  switch (count) {
    case 2:
      caption = `⚠️ Cảnh cáo ${senderName}!\nNgừng gửi số điện thoại, trước khi, mọi chuyện dần tồi tệ hơn!`;
      break;
  }
  
  await api.sendMessage(
    {
      msg: caption,
      mentions: [
        MessageMention(senderId, senderName.length, "⚠️ Cảnh cáo ".length),
      ],
      quote: message,
      ttl: 300000,
    },
    message.threadId,
    MessageType.GroupMessage
  );
}

schedule.scheduleJob("*/30 * * * *", () => {
  const currentTime = Date.now();
  for (const senderId in phoneSendTime) {
    if (currentTime - phoneSendTime[senderId] > 60 * 1000 * 30) {
      delete phoneSendCount[senderId];
      delete phoneSendTime[senderId];
    }
  }
});