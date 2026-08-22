import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const tempDir = path.resolve(process.env.TEMP_DIR || path.join(process.cwd(), "tmp"));
const logDir = path.resolve(process.env.LOG_DIR || path.join(process.cwd(), "logs"));

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function jsonPath(name) {
  ensureDir(path.join(process.cwd(), "assets", "data"));
  return path.join(process.cwd(), "assets", "data", name);
}

export function ensureLogFiles() {
  ensureDir(logDir);
  ensureDir(tempDir);
}

export function logManagerBot(message) {
  ensureLogFiles();
  const line = `[${new Date().toISOString()}] ${String(message)}\n`;
  fs.appendFileSync(path.join(logDir, "manager-bot.log"), line, "utf8");
}

export function logMessageToFile(message, name = "message") {
  ensureLogFiles();
  const safe = String(name).replace(/[^a-z0-9_-]/gi, "_") || "message";
  fs.appendFileSync(path.join(logDir, `${safe}.log`), String(message) + "\n", "utf8");
}

export function pushMessageToWebLog(message) {
  logMessageToFile(message, "web");
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`[io-json] Failed reading ${file}: ${error.message}`);
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file);
  return value;
}

export function readGroupSettings() {
  const file = path.join(process.cwd(), "assets", "data", "group_settings.json");
  return readJson(file, {});
}

export function writeGroupSettings(data) {
  return writeJson(path.join(process.cwd(), "assets", "data", "group_settings.json"), data ?? {});
}

export function readManagerFile(name = "manager-bot.json") {
  return readJson(path.join(process.cwd(), "assets", "json-data", name), {});
}

export function writeManagerFile(data, name = "manager-bot.json") {
  return writeJson(path.join(process.cwd(), "assets", "json-data", name), data ?? {});
}

export function writeCommandConfig(data) {
  return writeJson(path.join(process.cwd(), "assets", "json-data", "command-config.json"), data ?? {});
}

// New: readWebConfig and writeWebConfig used by web-service modules.
export function readWebConfig() {
  // return a sensible default shape used by web UI and services
  return readJson(path.join(process.cwd(), "assets", "json-data", "web-config.json"), { selectedFriends: {}, selectedGroups: {} });
}

export function writeWebConfig(data) {
  return writeJson(path.join(process.cwd(), "assets", "json-data", "web-config.json"), data ?? { selectedFriends: {}, selectedGroups: {} });
}

export default {
  tempDir, ensureLogFiles, logManagerBot, logMessageToFile, pushMessageToWebLog,
  readGroupSettings, writeGroupSettings, readManagerFile, writeManagerFile, writeCommandConfig,
  readWebConfig, writeWebConfig
};
