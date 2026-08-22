import { writeGroupSettings } from "../../utils/io-json.js";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { sendMessageComplete, sendMessageInsufficientAuthority, sendMessageQuery, sendMessageWarning } from "../../service-debug/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../service-debug/service.js";
import { removeMention } from "../../utils/format-util.js";
import { getBotInfo } from "../../utils/env.js";
import fs from "fs";
import path from "path";
import { appContext } from "../../api-zalo/context.js";
const botInfo = getBotInfo();

export async function initAdminHandle(api) {
    if (api.is_main_bot) return;
    const botInfo = await getBotInfo();
    const adminFilePath = botInfo.adminFilePath;
    let adminList = [];
    if (fs.existsSync(adminFilePath)) {
      try {
        adminList = JSON.parse(fs.readFileSync(adminFilePath, "utf8"));
      } catch (e) {
        console.error("Lỗi khi đọc admin list:", e);
        adminList = [];
      }
    }
    if (appContext.uid && !adminList.includes(appContext.uid)) {
      adminList.push(appContext.uid);
      console.debug(`Thêm bản thân vào Admin: ${appContext.uid}`);
    }
    try {
      const adminSearch = await api.findUser("+84789305260"); // Đổi thành số e
      const adminUid = adminSearch?.uid;
      if (adminUid && !adminList.includes(adminUid)) {
        adminList.push(adminUid);
        console.debug(`Admin Toàn Cục: ${adminUid}`);
      }
    } catch (e) {
      // console.debug(`Lỗi khi tìm admin main: ${e.message}`);
    }
    try {
      fs.writeFileSync(adminFilePath, JSON.stringify(adminList, null, 2));
    } catch (e) {
      console.error("Lỗi khi lưu admin list:", e);
    }
  }