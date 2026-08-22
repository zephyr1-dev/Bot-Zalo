import fs from "fs";
import path from "path";
import { handleDownloadCommand, handleDownloadReply, MEDIA_TYPES } from "./aio-downlink.js";
import { removeMention } from "../../../utils/format-util.js";
import { getGlobalPrefix } from "../../service.js";
import { sendMessageStateQuote } from "../../chat-zalo/chat-style/chat-style.js";
import { sendReactionWaitingCountdown } from "../../../commands/manager-command/check-countdown.js";
import { sleep } from "../../../utils/util.js";
const configPath = path.join(process.cwd(), "assets/json-data/command-config.json");
const activeCooldowns = new Set();
const commandUsage = {};
const pendingRequests = {};
function loadCommandJson() {
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ commands: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function saveCommandJson(data) {
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

function getCommandCountdown(name) {
  const config = loadCommandJson();
  return config.commands.find(c => c.name === name)?.countdown || 0;
}

function setCommandCountdown(name, seconds) {
  const config = loadCommandJson();
  const command = config.commands.find(c => c.name === name);
  if (command) {
    command.countdown = seconds;
  } else {
    config.commands.push({ name, countdown: seconds });
  }
  saveCommandJson(config);
}

function extractValidUrl(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = text.match(urlRegex);
    if (!urls) return null;
  
    for (const url of urls) {
      const lower = url.toLowerCase();
      if (Object.keys(MEDIA_TYPES).some(domain => lower.includes(domain))) {
        return url;
      }
    }
    return null;
  }

export async function handleAutoDownloadCommand(api, message, aliasCommand, groupSettings) {
  const prefix = getGlobalPrefix();
  const threadId = message.threadId;
  const content = removeMention(message).trim().toLowerCase();
  const query = content.replace(`${prefix}${aliasCommand}`, "").trim();
  const args = query.split(/\s+/);
  const command = args[0];

  if (!groupSettings[threadId]) groupSettings[threadId] = {};

  if (command === "setcountdown") {
    if (args.length < 2) {
      await api.sendMessage({ msg: "⚠️ Bạn cần nhập số giây!", quote: message, tll: 30000 }, threadId, message.type);
      return true;
    }
  
    const seconds = parseInt(args[1]);
    if (isNaN(seconds) || seconds < 0) {
      await api.sendMessage({ msg: "❌ Vui lòng nhập số giây hợp lệ!", quote: message, tll: 30000 }, threadId, message.type);
      return true;
    }
  
    setCommandCountdown("download", seconds);
    await api.sendMessage({
      msg: `✅ Đã cập nhật countdown cho lệnh download: ${seconds} giây`,
      quote: message,
      tll: 30000,
    }, threadId, message.type);
    return true;
  }

  if (command === "on") {
    groupSettings[threadId].enableDownload = true;
  } else if (command === "off") {
    groupSettings[threadId].enableDownload = false;
  } else {
    groupSettings[threadId].enableDownload = !groupSettings[threadId].enableDownload;
  }

  const status = groupSettings[threadId].enableDownload;
  await sendMessageStateQuote(api, message, `Chức năng download tự động đã được ${status ? "bật" : "tắt"}!`, status, 30000);
  return true;
}

export async function handleDownloadZalo(api, message, groupSettings, isSelf) {
    const threadId = message.threadId;
    const userId = message.data?.uidFrom;
    const prefix = getGlobalPrefix();
  
    const rawContent =
      message.body?.trim() ||
      message.data?.content?.title?.trim() ||
      (typeof message.data?.content === "string" ? message.data.content.trim() : "");
    if (!rawContent) return false;
  
    const content = removeMention(message).trim();
    if (content.toLowerCase().startsWith(prefix.toLowerCase())) return false;
    const replyHandled = await handleDownloadReply(api, message);
    if (replyHandled) return true;
  
    const validUrl = extractValidUrl(rawContent);
    if (!validUrl) return false;
  
    if (!groupSettings[threadId]?.enableDownload) return false;
  
    const commandName = "download";
    const cooldown = getCommandCountdown(commandName) * 1000;
    const cooldownKey = `${userId}:${commandName}`;
    const currentTime = Date.now();
    const lastUsage = commandUsage[userId]?.[commandName] || 0;
    const timeLeft = cooldown - (currentTime - lastUsage);
  
    if (timeLeft > 0) {
      pendingRequests[cooldownKey] = { api, message, validUrl };
  
      if (activeCooldowns.has(cooldownKey)) return true;
  
      activeCooldowns.add(cooldownKey);
      const remaining = Math.ceil(timeLeft / 1000);
      await sendReactionWaitingCountdown(api, message, remaining);
      await sleep(timeLeft + 1900);
      activeCooldowns.delete(cooldownKey);
  
      const lastRequest = pendingRequests[cooldownKey];
      if (lastRequest) {
        delete pendingRequests[cooldownKey];
        await api.addReaction("CUOIBITMIENG", lastRequest.message);
        const fakeMsg = { ...lastRequest.message, body: lastRequest.validUrl };
        await handleDownloadCommand(api, fakeMsg, null);
      }
  
      return true;
    }
  
    if (!commandUsage[userId]) commandUsage[userId] = {};
    commandUsage[userId][commandName] = Date.now();
  
    await api.addReaction("CUOIBITMIENG", message);

    const fakeMessage = { ...message, body: validUrl };
    const success = await handleDownloadCommand(api, fakeMessage, null);  
    if (!success) {
    }
    return true;
  }