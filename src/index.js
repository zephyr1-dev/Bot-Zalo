import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Zalo, ZaloApiError } from "./api-zalo/index.js";
import { ensureLogFiles, logManagerBot } from "./utils/io-json.js";
import { getBotName } from "./utils/env.js";
import { isTemporaryAdmin } from "./utils/temp-admin.js";
import { messagesUser } from "./automations/event-send-msg.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const projectRoot = path.resolve(process.env.PROJECT_ROOT || path.join(__dirname, ".."));
export const configPath = path.resolve(process.env.CONFIG_PATH || path.join(projectRoot, "assets", "config.json"));

let botId = null;
let commandConfig = {};
let prophylacticUploadAttachment = {};
let client = null;
let api = null;

export const admins = (() => {
  try {
    const file = path.join(projectRoot, "assets", "data", "list_admin.json");
    const values = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(values) ? values.map(String) : [];
  } catch {
    return [];
  }
})();

export function setBotId(id) { botId = id; }
export function getBotId() { return botId; }
export function getCommandConfig() { return commandConfig; }
export function reloadCommandConfig() {
  const file = path.join(projectRoot, "assets", "json-data", "command-config.json");
  try { commandConfig = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { commandConfig = {}; console.warn(`[config] command-config.json: ${e.message}`); }
  return commandConfig;
}
export function setProphylacticUploadAttachment(value) { prophylacticUploadAttachment = value ?? {}; }
export function getProphylacticUploadAttachment() { return prophylacticUploadAttachment; }
export function checkConfigUploadAttachment() { return true; }

export function isAdmin(userId) {
  const file = path.join(projectRoot, "assets", "data", "list_admin.json");
  try {
    const admins = JSON.parse(fs.readFileSync(file, "utf8"));
    return (Array.isArray(admins) && admins.map(String).includes(String(userId))) || isTemporaryAdmin(userId);
  } catch { return false; }
}
export function isAdminLevelHighest(userId) { return isAdmin(userId); }
export function checkDisableProphylacticConfig() { return false; }
export function getClient() { return client; }
export function getApi() { return api; }

function readConfig() {
  if (!fs.existsSync(configPath)) throw new Error(`Không tìm thấy config: ${configPath}`);
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!config.cookie || !config.imei || !config.userAgent) {
    throw new Error("Config thiếu cookie, imei hoặc userAgent");
  }
  return config;
}

async function start() {
  ensureLogFiles();
  reloadCommandConfig();
  const config = readConfig();

  console.log(`Đang đăng nhập ${getBotName()}...`);
  client = new Zalo(config, { selfListen: false, checkUpdate: false });
  api = await client.login();

  if (api?.listener) {
    api.listener.on("connected", () => console.log("Zalo listener connected"));
    api.listener.on("closed", () => console.warn("Zalo listener closed"));
    api.listener.on("error", (error) => console.error("Zalo listener error:", error));
    api.listener.onMessage((message) => {
      messagesUser(api, message).catch((error) => {
        console.error("Message handler failed:", error?.stack || error);
      });
    });
    api.listener.start();
  }

  console.log(`Bot khởi động thành công. UID: ${getBotId()}`);
  logManagerBot(`Bot started. UID=${getBotId()}`);
  return api;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  start().catch((error) => {
    console.error("Bot startup failed:", error?.stack || error);
    logManagerBot(`Startup failed: ${error?.stack || error}`);
    process.exitCode = 1;
  });
}

export { Zalo, ZaloApiError };
