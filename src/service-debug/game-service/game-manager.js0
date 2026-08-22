import fs from "fs/promises";
import path from "path";
import schedule from "node-schedule";
import chalk from "chalk";
import { initializeGameBauCua } from "./bau-cua/bau-cua.js";
import { initializeGameChanLe } from "./chan-le/chan-le.js";
import { initializeGameTaiXiu } from "./tai-xiu/tai-xiu.js";
import { initializeGameVietlott655 } from "./vietlott/vietlott655.js";
import { getBotInfo } from "../../utils/env.js";

const botInfo = await getBotInfo();
const DATA_FILE_PATH = botInfo.DATA_GAME_FILE_PATH;

// Biến quản lý data game toàn cục
export const gameState = {
  data: {
    taixiu: {
      players: {},
      activeThreads: [],
      history: [],
      jackpot: "1000000"
    },
    chanle: {
      jackpot: "1000000",
      history: []
    },
    baucua: {
      jackpot: "1000000", 
      history: []
    },
    vietlott655: {
      players: {},
      activeThreads: [],
      jackpot: "1000000",
      history: []
    }
  },
  changes: {
    taixiu: false,
    chanle: false, 
    baucua: false,
    vietlott655: false
  }
};

// Hàm đọc data từ file
async function loadGameData() {
  try {
    const data = JSON.parse(await fs.readFile(DATA_FILE_PATH, "utf8"));
    gameState.data = data;
    console.log(chalk.magentaBright("Đã nạp dữ liệu game từ file thành công"));
  } catch (error) {
    console.error("Lỗi khi đọc file data game:", error);
  }
}

// Hàm lưu data vào file
async function saveGameData() {
  try {
    await fs.writeFile(DATA_FILE_PATH, JSON.stringify(gameState.data, null, 2));
  } catch (error) {
    console.error("Lỗi khi ghi file data game:", error);
  }
}

// Hàm kiểm tra và lưu thay đổi
async function checkAndSaveChanges() {
  const hasChanges = Object.values(gameState.changes).some(change => change);
  
  if (hasChanges) {
    await saveGameData();
    // Reset tất cả changes về false
    Object.keys(gameState.changes).forEach(key => {
      gameState.changes[key] = false;
    });
  }
}

// Khởi tạo service
export async function initializeGameDataManager(api) {
  await loadGameData();
  await Promise.all([
    initializeGameBauCua(),
    initializeGameChanLe(),
    initializeGameTaiXiu(api),
    initializeGameVietlott655(api),
  ]);
  
  schedule.scheduleJob("*/5 * * * * *", async () => {
    await checkAndSaveChanges();
  });
  
  console.log(chalk.magentaBright("Khởi động service quản lý data game hoàn tất"));
}