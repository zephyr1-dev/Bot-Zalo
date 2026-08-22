import fs from "fs";
import path from "path";
import chalk from "chalk";
import { mkdir } from "fs/promises";

import { getTimeToString, getTimeNow } from "./format-util.js";

const adminFilePath = path.resolve("./assets/data/list_admin.json");
const groupSettingsPath = path.resolve("./assets/data/group_settings.json");
const configFilePath = path.resolve("./assets/config.json");
const commandFilePath = path.resolve("./assets/json-data/command.json");

export function readConfig() {
  let config = {};
  try {
    const data = fs.readFileSync(configFilePath, "utf-8");
    config = JSON.parse(data);
  } catch (error) {
    console.error("Lỗi đọc tệp config.json:", error);
    config = {};
  }
  return config;
}

export function readAdmins() {
  let admins = [];
  try {
    const data = fs.readFileSync(adminFilePath, "utf-8");
    admins = JSON.parse(data);
  } catch (error) {
    console.error("Lỗi đọc tệp admin:", error);
    admins = [];
  }
  return admins;
}

const logDir = path.join(process.cwd(), "logs");
export const resourceDir = path.join(process.cwd(), "assets", "resources");
export const tempDir = path.join(process.cwd(), "assets", "temp");
export const dataGifPath = path.join(process.cwd(), "assets", "resources", "gif");

const logManagerBotFilePath = path.join(logDir, "bot-manager.log");
const loggingMessageFilePath = path.join(logDir, "message.txt");
const loggingMessageJsonPath = path.join(logDir, "message.json");
const dataGamePath = path.join(process.cwd(), "assets", "json-data", "data-game.json");

export async function ensureLogFiles() {
  try {
    await mkdir(logDir, { recursive: true });
    await mkdir(resourceDir, { recursive: true });
    await mkdir(tempDir, { recursive: true });
    await mkdir(dataGifPath, { recursive: true });
    if (!fs.existsSync(logManagerBotFilePath)) {
      fs.writeFileSync(logManagerBotFilePath, "");
    }
    if (!fs.existsSync(loggingMessageFilePath)) {
      fs.writeFileSync(loggingMessageFilePath, "");
    }
    if (!fs.existsSync(loggingMessageJsonPath)) {
      fs.writeFileSync(loggingMessageJsonPath, "{}");
    }
    if (!fs.existsSync(dataGamePath)) {
      fs.writeFileSync(dataGamePath, "{}");
    }
  } catch (err) {
    console.error("Lỗi khi tạo thư mục hoặc file log:", err);
  }
}

export function mkdirRecursive(dirPath) {
  if (fs.existsSync(dirPath)) return;

  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }
}

export function logManagerBot(message) {
  const timestamp = getTimeToString(getTimeNow());
  const logEntry = `${timestamp} - ${message}\n`;
  fs.appendFileSync(logManagerBotFilePath, logEntry);
}

export function logMessageToFile(data, type = "message") {
  const timestamp = getTimeToString(getTimeNow());
  const logData = `${data}\n`;

  fs.appendFileSync(loggingMessageFilePath, logData + "\n", "utf8");
  if (type === "group") {
    console.log(chalk.yellowBright.bold(`[${timestamp}]\n`), chalk.yellowBright(logData));
  } else {
    console.log(chalk.blueBright.bold(`[${timestamp}]\n`), chalk.blueBright(logData));
  }
}

export function readGroupSettings() {
  try {
    const data = fs.readFileSync(groupSettingsPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Lỗi khi đọc file group_settings.json:", error);
    return {};
  }
}

export function writeGroupSettings(settings) {
  try {
    fs.writeFileSync(groupSettingsPath, JSON.stringify(settings, null, 2), "utf-8");
  } catch (error) {
    console.error("Lỗi khi ghi file group_settings.json:", error);
  }
}

export function readCommandConfig() {
  try {
    const data = fs.readFileSync(commandFilePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Lỗi khi đọc file command.json:", error);
    return { commands: [] };
  }
}

export function writeCommandConfig(config) {
  try {
    fs.writeFileSync(commandFilePath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error("Lỗi khi ghi file command.json:", error);
  }
}

const WEB_CONFIG_PATH = path.join(process.cwd(), "assets", "web-config", "web-config.json");
export function readWebConfig() {
  try {
    const data = fs.readFileSync(WEB_CONFIG_PATH, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Lỗi khi đọc file web-config.json:", error);
    return {};
  }
}

export function writeWebConfig(config) {
  fs.writeFileSync(WEB_CONFIG_PATH, JSON.stringify(config, null, 2));
}

const MANAGER_FILE_PATH = path.join(process.cwd(), "assets", "json-data", "manager-bot.json");

export function readManagerFile() {
  try {
    const data = fs.readFileSync(MANAGER_FILE_PATH, "utf8");
    let parsedData = JSON.parse(data);
    if (!parsedData) {
      parsedData = {};
    }
    return parsedData;
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    console.error("Lỗi khi đọc file block:", error);
    return {};
  }
}

export function writeManagerFile(data) {
  fs.writeFileSync(MANAGER_FILE_PATH, JSON.stringify(data, null, 2));
}

export function pushMessageToWebLog(io, nameType, senderName, content, avtGroup) {
  if (io) {
    const messageData = { nameType, senderName, content, avtGroup };
    io.emit("newMessage", messageData);
  }
}

const PROPHYLACTIC_CONFIG_PATH = path.join(process.cwd(), "assets", "json-data", "prophylactic.json");

export function readProphylacticConfig() {
  try {
    const data = fs.readFileSync(PROPHYLACTIC_CONFIG_PATH, "utf8");
    const parsedData = JSON.parse(data);
    return parsedData;
  } catch (error) {
    console.error("Lỗi khi đọc file prophylactic.json:", error);
    return {
      prophylacticUploadAttachment: {
        enable: false,
        lastBlocked: "",
        numRequestZalo: 0,
      },
    };
  }
}

export function writeProphylacticConfig(data) {
  try {
    fs.writeFileSync(PROPHYLACTIC_CONFIG_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Lỗi khi ghi file prophylactic.json:", error);
  }
}
