import fs from "fs";
import path from "path";
import { removeMention } from "../../../utils/format-util.js";
import { getGlobalPrefix } from "../../service.js";
import { sendMessageStateQuote } from "../../chat-zalo/chat-style/chat-style.js";
import { chatGeminiHandle } from "./gemini.js";
import { appContext } from "../../../api-zalo/context.js";
import { sendReactionWaitingCountdown } from "../../../commands/manager-command/check-countdown.js";
import { sleep } from "../../../utils/util.js";

const configPath = path.join(process.cwd(), "assets/json-data/command-config.json");
const activeCooldowns = new Set();
const commandUsage = {};

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
  return config.commands.find(c => c.name === name)?.countdown || 30; // Mặc định 30 giây
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

export async function handleAutoReplyCommand(api, message, aliasCommand, groupSettings) {
  const prefix = getGlobalPrefix();
  const threadId = message.threadId;
  const content = removeMention(message).trim().toLowerCase();
  const query = content.replace(`${prefix}${aliasCommand}`, "").trim();
  const args = query.split(/\s+/);
  const command = args[0];

  if (!groupSettings[threadId]) groupSettings[threadId] = {};

  if (command === "setcountdown") {
    if (args.length < 2) {
      await api.sendMessage({ msg: "⚠️ Bạn cần nhập số giây!", ttl: 30000 }, threadId, message.type);
      return true;
    }

    const seconds = parseInt(args[1]);
    if (isNaN(seconds) || seconds < 0) {
      await api.sendMessage({ msg: "❌ Vui lòng nhập số giây hợp lệ!", ttl: 30000 }, threadId, message.type);
      return true;
    }

    setCommandCountdown("autoreply", seconds);
    await api.sendMessage({
      msg: `✅ Đã cập nhật countdown cho Auto-AI: ${seconds} giây`,
      ttl: 30000,
    }, threadId, message.type);
    return true;
  }

  if (command === "on") {
    groupSettings[threadId].autoReplyCommand = true;
  } else if (command === "off") {
    groupSettings[threadId].autoReplyCommand = false;
  } else {
    groupSettings[threadId].autoReplyCommand = !groupSettings[threadId].autoReplyCommand;
  }

  const status = groupSettings[threadId].autoReplyCommand;
  const countdown = getCommandCountdown("autoreply");
  await sendMessageStateQuote(api, message, `Chức năng Auto-AI đã được ${status ? "bật" : "tắt"}!`, status, 30000);
  return true;
}

export async function handleAutoReplyGemini(api, message, groupSettings, isSelf) {
  if (isSelf) return false;
  const threadId = message.threadId;
  if (!groupSettings[threadId]?.autoReplyCommand) return false;
  const mentions = message.data?.mentions;
  if (!Array.isArray(mentions) || mentions.length === 0) return false;
  const botMentioned = mentions.some(m => m.uid === appContext.uid);
  const info = api.getUserInfo(appContext.uid);
  console.debug(info);
  if (!botMentioned) return false;
  const content = removeMention(message).trim();
  if (!content) return false;

  const commandName = "autoreply";
  const cooldown = getCommandCountdown(commandName) * 1000;
  const cooldownKey = `${threadId}:${commandName}`;
  const currentTime = Date.now();
  const lastUsage = commandUsage[cooldownKey] || 0;
  const timeLeft = cooldown - (currentTime - lastUsage);

  if (timeLeft > 0) {
    if (activeCooldowns.has(cooldownKey)) return true;

    activeCooldowns.add(cooldownKey);
    const remaining = Math.ceil(timeLeft / 1000);
    await sendReactionWaitingCountdown(api, message, remaining);
    await sleep(timeLeft + 1900);
    activeCooldowns.delete(cooldownKey);
  }

  commandUsage[cooldownKey] = Date.now();

  try {
    const reply = await chatGeminiHandle(api, message);
    if (reply) {
      const isQuoteSupported = !["webchat", "group.poll"].includes(message?.data?.msgType);
      const payload = { msg: reply, ttl: 60000 }; // TTL 60s
      if (isQuoteSupported) {
        payload.quote = message;
      }
      await api.sendMessage(payload, threadId, message.type);
    }
  } catch (err) {
    console.error("Lỗi gọi Gemini:", err);
    await api.sendMessage({ msg: "Lỗi xử lý AI", ttl: 60000 }, threadId, message.type);
  }

  return true;
}
