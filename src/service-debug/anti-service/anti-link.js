import { MessageMention, MessageType } from "zlbotdqt";
import { getBotId } from "../../index.js";
import { sendMessageStateQuote } from "../chat-zalo/chat-style/chat-style.js";
import { createBlockSpamLinkImage } from "../../utils/canvas/event-image.js";
import { clearImagePath } from "../../utils/canvas/index.js";
import { getGroupInfoData } from "../info-service/group-info.js";
import { getUserInfoData } from "../info-service/user-info.js";
import { isInWhiteList } from "./white-list.js";
import { removeMention } from "../../utils/format-util.js";
import { getAntiState } from "./index.js";
import { scanQRCode } from "../utilities/qr-scan.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LINK_WHITELIST_FILE = path.join(__dirname, "link-whitelist.json");
const CACHE_TTL = 5 * 60 * 1000;
let linkSettingsCache = {};
let lastCacheUpdate = 0;

async function loadLinkRegex() {
  try {
    const antiState = getAntiState();
    if (!antiState.data.linkRegex) {
      antiState.data.linkRegex =
        "(?:https?:\\/\\/|www\\.)\\S+|(?<!\\w)[a-zA-Z0-9-]+[.,](?:com|net|org|vn|info|biz|io|xyz|me|tv|online|store|club|site|app|blog|dev|tech|cloud|game|shop|click|space|asia|fun|tokyo|xyz|website|zpg|link|co|gov|edu)(?:\\/\\S*)?(?!\\w)";
    }
    return new RegExp(antiState.data.linkRegex, "gi");
  } catch (error) {
    return null;
  }
}

const linkRegex = await loadLinkRegex();

let linkSendCount = {};
let linkSendTime = {};

async function readLinkSettings() {
  const now = Date.now();
  if (now - lastCacheUpdate < CACHE_TTL) {
    return linkSettingsCache;
  }

  try {
    const data = await fs.readFile(LINK_WHITELIST_FILE, "utf8");
    const parsedData = JSON.parse(data) || {};
    
    Object.keys(parsedData).forEach(groupId => {
      if (!parsedData[groupId].patterns) {
        parsedData[groupId] = {
          patterns: Array.isArray(parsedData[groupId]) ? parsedData[groupId] : []
        };
      }
    });

    linkSettingsCache = parsedData;
    lastCacheUpdate = now;
    return parsedData;
  } catch (error) {
    if (error.code === "ENOENT") {
      const emptyObject = {};
      await fs.mkdir(path.dirname(LINK_WHITELIST_FILE), { recursive: true });
      await fs.writeFile(LINK_WHITELIST_FILE, JSON.stringify(emptyObject, null, 2));
      return emptyObject;
    }
    return {};
  }
}

async function writeLinkSettings(settings) {
  try {
    await fs.writeFile(LINK_WHITELIST_FILE, JSON.stringify(settings, null, 2));
    linkSettingsCache = settings;
    lastCacheUpdate = Date.now();
  } catch (error) {
  }
}

function normalizeLink(link) {
  if (!link || typeof link !== 'string') return '';
  return link.replace(/[\s\u200B-\u200D\uFEFF]/g, '')
             .replace(/[^\w\-.:\/]/g, '')
             .toLowerCase();
}

function isWhitelisted(link, whitelistedPatterns) {
  if (!whitelistedPatterns.length) return false;
  return whitelistedPatterns.some(pattern => normalizeLink(link).includes(pattern.toLowerCase()));
}

function checkLink(content) {
  if (!content || typeof content !== 'string') return false;
  return linkRegex.test(content);
}

export async function antiLink(
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

  if (
    isSelf ||
    isAdminBox ||
    !botIsAdminBox ||
    !groupSettings[threadId]?.removeLinks
  ) {
    return false;
  }

  return await handleLinkMessage(
    api,
    message,
    groupSettings,
    isAdminBox,
    threadId,
    senderId,
    senderName
  );
}

export async function handleAntiLinkCommand(
  api,
  message,
  groupSettings
) {
  const threadId = message.threadId;
  let isChangeSetting = false;
  const content = removeMention(message);
  const parts = content.split(" ");
  const subcommand = parts[1]?.toLowerCase();
  const linkSettings = await readLinkSettings();
  if (!linkSettings[threadId]) {
    linkSettings[threadId] = {
      patterns: []
    };
  }

  if (subcommand === "add" && parts[2]) {
    const pattern = parts[2].toLowerCase();
    if (!linkSettings[threadId].patterns.includes(pattern)) {
      linkSettings[threadId].patterns.push(pattern);
      await writeLinkSettings(linkSettings);
      await sendMessageStateQuote(api, message, `Đã thêm "${pattern}" vào danh sách trắng link.`, true, 300000);
      isChangeSetting = true;
    } else {
      await sendMessageStateQuote(api, message, `"${pattern}" đã có trong danh sách trắng link.`, false, 300000);
    }
  } else if (subcommand === "remove" && parts[2]) {
    const pattern = parts[2].toLowerCase();
    if (linkSettings[threadId].patterns.includes(pattern)) {
      linkSettings[threadId].patterns = linkSettings[threadId].patterns.filter(p => p !== pattern);
      if (linkSettings[threadId].patterns.length === 0) {
        delete linkSettings[threadId];
      }
      await writeLinkSettings(linkSettings);
      await sendMessageStateQuote(api, message, `Đã xóa "${pattern}" khỏi danh sách trắng link.`, true, 300000);
      isChangeSetting = true;
    } else {
      await sendMessageStateQuote(api, message, `"${pattern}" không tồn tại trong danh sách trắng link.`, false, 300000);
    }
  } else if (subcommand === "list") {
    const patterns = linkSettings[threadId]?.patterns || [];
    const caption = patterns.length > 0
      ? `Danh sách link bỏ qua:\n${patterns.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
      : "Hiện không có link nào trong danh sách trắng.";
    await sendMessageStateQuote(api, message, caption, patterns.length > 0, 300000);
  } else if (subcommand === "clearall") {
    if (linkSettings[threadId]?.patterns?.length > 0) {
      linkSettings[threadId].patterns = [];
      delete linkSettings[threadId];
      await writeLinkSettings(linkSettings);
      await sendMessageStateQuote(api, message, `Đã xóa tất link khỏi danh sách trắng.`, true, 300000);
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
          : !groupSettings[threadId].removeLinks;
    groupSettings[threadId].removeLinks = newStatus;
    isChangeSetting = true;
    const statusText = newStatus ? "bật" : "tắt";
    const caption = `Chức năng xóa link đã được ${statusText}!`;
    await sendMessageStateQuote(api, message, caption, newStatus, 300000);
  }

  return isChangeSetting;
}

async function handleLinkMessage(
  api,
  message,
  groupSettings,
  isAdminBox,
  threadId,
  senderId,
  senderName
) {
  let content = message.data.content;
  content = content.title ? content.title : content;
  const isRecommendedMessage = message.data.msgType === "chat.recommended";
  const isImage = message.data.msgType === "chat.photo";
  const isPlainText = typeof content === "string";
  let isDeleteLink = false;
  const botId = getBotId();
  const isUserWhiteList = isInWhiteList(groupSettings, threadId, senderId);
  const linkSettings = await readLinkSettings();
  const whitelistedPatterns = linkSettings[threadId]?.patterns || [];

  if (isUserWhiteList) {
    return isDeleteLink;
  }

  if (isRecommendedMessage) {
    if (content && isWhitelisted(content, whitelistedPatterns)) {
      return isDeleteLink;
    }
    const deleteResult = await api.deleteMessage(message, false).catch(() => null);
    if (deleteResult && deleteResult.status === 0) {
      isDeleteLink = true;
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

  if (!isDeleteLink && isImage) {
    const linkImage = message.data?.content?.href;
    if (linkImage) {
      const result = await scanQRCode(linkImage).catch(() => ({ success: false }));
      if (result.success) {
        const deleteResult = await api.deleteMessage(message, false).catch(() => null);
        if (deleteResult && deleteResult.status === 0) {
          isDeleteLink = true;
          await blockUser(api, message, threadId, senderId, senderName);
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
  }

  const hasLink = isPlainText && checkLink(content);

  if (!isDeleteLink && hasLink) {
    const matches = content.match(linkRegex);
    if (matches && !matches.some(link => isWhitelisted(link, whitelistedPatterns))) {
      const deleteResult = await api.deleteMessage(message, false).catch(() => null);
      if (deleteResult && deleteResult.status === 0) {
        isDeleteLink = true;
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

  if (isDeleteLink && !isUserWhiteList) {
    await updateLinkCount(
      api,
      message,
      threadId,
      senderId,
      senderName,
      botId,
      isAdminBox
    );
  }
  return isDeleteLink;
}

async function updateLinkCount(
  api,
  message,
  threadId,
  senderId,
  senderName,
  botId,
  isAdminBox
) {
  if (!linkSendCount[senderId]) {
    linkSendCount[senderId] = 0;
    linkSendTime[senderId] = Date.now();
  }

  linkSendCount[senderId]++;

  if (isAdminBox && senderId !== botId) {
    return;
  }

  if (Date.now() - linkSendTime[senderId] < 60 * 1000) {
    if (linkSendCount[senderId] > 2) {
      await blockUser(api, message, threadId, senderId, senderName);
      return;
    }
  } else {
    linkSendCount[senderId] = 1;
    linkSendTime[senderId] = Date.now();
  }

  await sendWarningMessage(api, message, senderId, senderName, linkSendCount[senderId]);
}

async function blockUser(api, message, threadId, senderId, senderName) {
  try {
    await api.blockUsers(threadId, [senderId]);
    const groupInfo = await getGroupInfoData(api, threadId);
    const userInfo = await getUserInfoData(api, senderId);
    const imagePath = await createBlockSpamLinkImage(
      userInfo,
      groupInfo.name,
      groupInfo.groupType,
      userInfo.gender
    );

    await api.sendMessage(
      {
        msg: "",
        attachments: imagePath ? [imagePath] : [],
        quote: message,
      },
      threadId,
      MessageType.GroupMessage
    );

    await clearImagePath(imagePath);
  } catch (error) {
  }
}

async function sendWarningMessage(api, message, senderId, senderName, count) {
  try {
    let caption = `⚠️ Cảnh cáo ${senderName}!\nỞ đây cấm gửi link`;
    switch (count) {
      case 2:
        caption = `⚠️ Cảnh cáo ${senderName}!\nNgừng gửi link, trước khi, mọi chuyện dần tồi tệ hơn!`;
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
  } catch (error) {
  }
}