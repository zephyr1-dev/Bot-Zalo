import fs from "fs";
import path from "path";

export function getBotName() {
  return process.env.BOT_NAME || "admin";
}

export function getBotInfo(name = getBotName()) {
  const file = path.join(process.cwd(), "mybot", "bots", `${name}.json`);
  if (fs.existsSync(file)) {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  }
  return { name };
}
