import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "assets", "data");
const DATA_FILE = path.join(DATA_DIR, "temp_admin.json");

function ensureFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "{}", "utf8");
}

function readStore() {
  ensureFile();
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch (error) {
    console.warn(`[temp-admin] Không đọc được ${DATA_FILE}: ${error.message}`);
    return {};
  }
}

function writeStore(data) {
  ensureFile();
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE);
}

function cleanupExpired(data, now = Date.now()) {
  let changed = false;
  for (const uid of Object.keys(data)) {
    const expiresAt = Number(data[uid]?.expiresAt ?? data[uid]);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
      delete data[uid];
      changed = true;
    }
  }
  return changed;
}

export function setTemporaryAdmin(userId, days = 5) {
  const uid = String(userId ?? "").trim();
  const duration = Number(days);
  if (!uid) throw new TypeError("userId không được rỗng");
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new TypeError("days phải là số lớn hơn 0");
  }

  const data = readStore();
  cleanupExpired(data);
  const expiresAt = Date.now() + duration * 24 * 60 * 60 * 1000;
  data[uid] = { expiresAt };
  writeStore(data);
  return expiresAt;
}

export function isTemporaryAdmin(userId) {
  const uid = String(userId ?? "").trim();
  if (!uid) return false;

  const data = readStore();
  const changed = cleanupExpired(data);
  if (changed) writeStore(data);

  const entry = data[uid];
  if (!entry) return false;
  const expiresAt = Number(entry?.expiresAt ?? entry);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export function getTemporaryAdminExpiry(userId) {
  const uid = String(userId ?? "").trim();
  if (!uid) return null;

  const data = readStore();
  const changed = cleanupExpired(data);
  if (changed) writeStore(data);

  const entry = data[uid];
  if (!entry) return null;
  const expiresAt = Number(entry?.expiresAt ?? entry);
  return Number.isFinite(expiresAt) && expiresAt > Date.now() ? expiresAt : null;
}

export function removeTemporaryAdmin(userId) {
  const uid = String(userId ?? "").trim();
  if (!uid) return false;
  const data = readStore();
  if (!(uid in data)) return false;
  delete data[uid];
  writeStore(data);
  return true;
}

export default {
  setTemporaryAdmin,
  isTemporaryAdmin,
  getTemporaryAdminExpiry,
  removeTemporaryAdmin,
};
