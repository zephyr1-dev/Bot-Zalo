import fs from "fs";
import path from "path";
const projectRoot = path.resolve(process.cwd());
const myBotDir = path.join(projectRoot, "mybot");
const myBotsPath = path.join(myBotDir, "mybots.json");
const configsDir = path.join(myBotDir, "configs");
const defaultCommand = path.join(myBotDir, "defaultCommand.json");
const botsDir = path.join(myBotDir, "bots");
const adminListPath = path.join("assets", "json-data", "list_admin.json");
const launcherPath = path.join(projectRoot, "index.js");
import { checkPM2Status, updateBotStatus, stopPM2Process } from "../System/pm2-manager.js";
export async function initCheckCommand(api) {
  if (api.is_main_bot) {
    return;
  }
  try {
    if (!fs.existsSync(defaultCommand)) {
      console.error("File cấu hình lệnh không tồn tại");
      return;
    }
    if (!fs.existsSync(myBotsPath)) {
      console.error("Không có data dữ liệu");
      return;
    }
    const defaultCommandsData = JSON.parse(fs.readFileSync(defaultCommand, "utf8"));
    const defaultCommands = defaultCommandsData.commands && Array.isArray(defaultCommandsData.commands)
      ? defaultCommandsData.commands
      : [];

    if (defaultCommands.length === 0) {
      console.warn("Không có lệnh nào");
      return;
    }
    const myBots = JSON.parse(fs.readFileSync(myBotsPath, "utf8"));
    for (const [uid, botInfo] of Object.entries(myBots)) {
      const botConfigPath = path.join(botsDir, `${uid}.json`);
      if (!fs.existsSync(botConfigPath)) {
        console.error(`Data lệnh của ${uid} không tồn tại`);
        continue;
      }
      const botConfig = JSON.parse(fs.readFileSync(botConfigPath, "utf8"));
      const botCommandPath = path.join(projectRoot, botConfig.commandFilePath);
      if (!fs.existsSync(botCommandPath)) {
        console.error(`Data lệnh của ${uid} không tồn tại`);
        continue;
      }
      let botCommandsData = JSON.parse(fs.readFileSync(botCommandPath, "utf8"));
      let botCommands = Array.isArray(botCommandsData)
        ? botCommandsData
        : botCommandsData.commands && Array.isArray(botCommandsData.commands)
          ? botCommandsData.commands
          : [];
      let newCommandsAdded = false;
      for (const command of defaultCommands) {
        if (!command.name) {
          console.warn(`Lệnh không hợp lệ: ${JSON.stringify(command)}`);
          continue;
        }

        if (!botCommands.some(existingCmd => existingCmd.name === command.name)) {
          botCommands.push(command);
          newCommandsAdded = true;
          console.log(`Vừa thêm ${command.name} vào Data hoàn chỉnh cho bot ${uid}:\n${JSON.stringify(command, null, 2)}`);
        }
      }

      if (newCommandsAdded) {
        try {
          const updatedCommandsData = Array.isArray(botCommandsData)
            ? botCommands
            : { ...botCommandsData, commands: botCommands };
          
          fs.writeFileSync(botCommandPath, JSON.stringify(updatedCommandsData, null, 2), "utf-8");
          console.log(`Đã cập nhật file lệnh cho bot ${uid}`);
        } catch (error) {
          console.error(`Không thể cập nhật file lệnh cho bot ${uid}: ${error.message}`);
        }
      } else {
        console.log(`Không có lệnh mới cần thêm cho bot ${uid}`);
      }
    }
  } catch (error) {
    console.error(`Lỗi khi kiểm tra lệnh mới: ${error.message}`);
  }
}
export async function initCheckTime() {
  try {
    if (!fs.existsSync(myBotsPath)) {
      console.error("File mybots.json không tồn tại");
      return;
    }
    const myBots = JSON.parse(fs.readFileSync(myBotsPath, "utf8"));
    const currentTime = new Date();
    for (const [uid, botInfo] of Object.entries(myBots)) {
      if (botInfo.expiryAt === "-1") {
        const pm2Status = await checkPM2Status(uid);
        if (pm2Status.running && botInfo.status !== "running") {
          await updateBotStatus(uid, "running");
          console.log(`Bot ${uid} trạng thái cập nhật thành 'running' (vô thời hạn).`);
        } else if (!pm2Status.running && botInfo.status === "running") {
          await updateBotStatus(uid, "stopped");
          console.log(`Bot ${uid} trạng thái cập nhật thành 'stopped' (PM2 không chạy, vô thời hạn).`);
        }
        continue; 
      }
      const expiryTime = new Date(botInfo.expiryAt);
      const pm2Status = await checkPM2Status(uid);
      if (expiryTime < currentTime) {
        if (botInfo.status !== "expired") {
          console.log(`Bot ${uid} đã hết hạn vào ${formatDateTime(expiryTime)}. Đang tắt bot...`);
          if (pm2Status.running) {
            const stopSuccess = await stopPM2Process(uid);
            if (stopSuccess) {
              console.log(`Bot ${uid} đã được dừng thành công do hết hạn.`);
            } else {
              console.warn(`Không thể dừng PM2 process cho bot ${uid}.`);
            }
          }
          await updateBotStatus(uid, "expired");
          console.log(`Bot ${uid} trạng thái cập nhật thành 'expired'.`);
        }
      } else {
        if (pm2Status.running && botInfo.status !== "running") {
          await updateBotStatus(uid, "running");
          console.log(`Bot ${uid} trạng thái cập nhật thành 'running' (vẫn trong thời hạn: ${formatDateTime(expiryTime)}).`);
        } else if (!pm2Status.running && botInfo.status === "running") {
          await updateBotStatus(uid, "stopped");
          console.log(`Bot ${uid} trạng thái cập nhật thành 'stopped' (PM2 không chạy, vẫn trong thời hạn: ${formatDateTime(expiryTime)}).`);
        }
      }
    }
  } catch (error) {
    console.error(`Lỗi kiểm tra thời gian bot: ${error.message}`);
  }
}
export function startPeriodicCheckTime(api) {
  if (!api.is_main_bot) {
    return;
  }
  if (!startPeriodicCheckTime.intervalId) {
    startPeriodicCheckTime.intervalId = setInterval(async () => {
      await initCheckTime();
    }, 60000);
    console.log("Đã khởi động mô hình quản lý BOT");
  } else {
    console.log("Kiểm tra thời gian bot định kỳ đã được khởi động trước đó.");
  }
}
function formatDateTime(date) {
  const options = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  };
  return date.toLocaleString("vi-VN", options);
}
startPeriodicCheckTime.intervalId = null;