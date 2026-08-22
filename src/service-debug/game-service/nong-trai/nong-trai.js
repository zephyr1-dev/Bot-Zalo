import fs from "fs/promises";
import path from "path";
import schedule from "node-schedule";
import chalk from "chalk";
import { sendMessageFromSQL } from "../../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../service.js";
import { CROPS, PRODUCT_CODES, SHOP_ITEMS, SOIL_STATUS } from "./data-nongtrai.js";
import { checkBeforeJoinGame, checkPlayerBanned } from "../index.js";
import { getPlayerInfo } from "../../../database/player.js";
import { calculateLandPrice, formatShopItems, handleBuyProduct, handleSellProduct } from "./shop-nongtrai.js";
import { drawFarm, drawFarmBackground } from "./cv-nongtrai.js";
import { clearImagePath } from "../../../utils/canvas/index.js";
import { handleCuocDatCommand, handleSendStatusCommand, handleWaterPlotCommand, sendFarmImage, useItem } from "./farm.js";
import { handleUseItemCommand } from "./farm.js";
import { handleGieoHatCommand, handleXoaHatCommand, handlePhaCayCommand } from "./farm.js";
import { handleHarvestCommand } from "./farm.js";
import { drawShopCanvas } from "./cv-shop.js";

import { getBotInfo } from "../../../utils/env.js";
const botInfo = await getBotInfo();
const DATA_FILE_PATH = botInfo.DATA_NT_PATH;

// const DATA_FILE_PATH = path.join(process.cwd(), "assets", "json-data", "nong-trai.json");
export const TIME_TO_LIVE = 10800000;

// Thêm biến để lưu job update
let gameStateUpdateJob = null;

// Thêm biến global để lưu trữ game state
const gameState = {
  dataGame: {},
  hasChange: false,
};

// Hàm khởi tạo game state
async function initializeGameState() {
  try {
    const data = await readDataFile();
    gameState.dataGame = data;
    gameState.hasChange = false;
    return gameState;
  } catch (error) {
    console.error("Lỗi khi khởi tạo game state:", error);
    gameState.dataGame = {};
    gameState.hasChange = false;
    return gameState;
  }
}

// Hàm xử lý cập nhật data game
async function handleGameStateUpdate() {
  if (gameState.hasChange) {
    await writeDataFile(gameState.dataGame);
    gameState.hasChange = false;
  }
}

// Cập nhật hàm khởi tạo farm service
export async function initializeFarmService() {
  // Hủy job cũ nếu có
  if (gameStateUpdateJob) gameStateUpdateJob.cancel();

  // Khởi tạo game state
  await initializeGameState();

  // Tạo job kiểm tra và lưu thay đổi mỗi 5 giây
  gameStateUpdateJob = schedule.scheduleJob("*/5 * * * * *", async () => {
    try {
      await handleGameStateUpdate();
      await updateFarms();
    } catch (error) {
      console.error("Lỗi khi update nông trại:", error);
    }
  });

  console.log(chalk.magentaBright("Khởi động và nạp dữ liệu minigame nông trại hoàn tất"));
}

// Hàm xử lý tương tác với game state
export function getGameState() {
  return gameState;
}

// Hàm cập nhật trạng thái có thay đổi
export function setHasChangeState(hasChange) {
  gameState.hasChange = hasChange;
}

// Hàm cập nhật game state
export function updateGameState(newData, shouldSave = true) {
  gameState.dataGame = newData;
  if (shouldSave) {
    gameState.hasChange = true;
  }
}

// Hàm xử lý update tất cả nông trại
async function updateFarms() {}

async function initializeFarm(userName) {
  const gameData = gameState.dataGame;

  if (!gameData.nongtrai) {
    gameData.nongtrai = {};
  }

  if (!gameData.nongtrai[userName]) {
    gameData.nongtrai[userName] = {
      bag: {},
      plots: Array(4)
        .fill()
        .map(() => ({
          crop: null,
          plantedAt: null,
          waterLevel: 100,
          lastWateredAt: Date.now(),
          status: SOIL_STATUS.GOOD,
          fertilized: [],
        })),
    };
    gameState.hasChange = true;
  } else if (!gameData.nongtrai[userName].plots) {
    gameData.nongtrai[userName].plots = Array(4)
      .fill()
      .map(() => ({
        crop: null,
        plantedAt: null,
        waterLevel: 100,
        lastWateredAt: Date.now(),
        status: SOIL_STATUS.GOOD,
        fertilized: [],
      }));
    gameState.hasChange = true;
  } else if (!gameData.nongtrai[userName].bag) {
    gameData.nongtrai[userName].bag = {};
    gameState.hasChange = true;
  }

  return gameData.nongtrai[userName];
}

export async function readDataFile() {
  try {
    const data = await fs.readFile(DATA_FILE_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

export async function writeDataFile(data) {
  try {
    await fs.writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Lỗi khi ghi file data-game:", error);
  }
}

async function updateSoilStatus(farm) {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000; // 1 giờ tính bằng milliseconds
  let hasChanges = false;

  farm.plots.forEach((plot) => {
    if (!plot.lastWateredAt) return;

    const timeSinceLastWatered = now - plot.lastWateredAt;
    const hoursElapsed = Math.floor(timeSinceLastWatered / oneHour);

    // Cập nhật độ ẩm dựa trên số giờ đã trôi qua
    // Giảm 10% độ ẩm mỗi giờ
    const waterLevelReduction = Math.min(hoursElapsed * 10, 100);
    const newWaterLevel = Math.max(0, 100 - waterLevelReduction);

    // Cập nhật trạng thái dựa trên độ ẩm mới
    let newStatus;
    if (newWaterLevel <= 0) {
      newStatus = SOIL_STATUS.DRY;
    } else if (newWaterLevel <= 40) {
      newStatus = SOIL_STATUS.LOW_WATER;
    } else {
      newStatus = SOIL_STATUS.GOOD;
    }

    // Chỉ cập nhật nếu có thay đổi
    if (plot.waterLevel !== newWaterLevel || plot.status !== newStatus) {
      plot.waterLevel = newWaterLevel;
      plot.status = newStatus;
      hasChanges = true;
    }
  });

  if (hasChanges) {
    gameState.hasChange = true;
  }
}

// Thêm hàm mới để quản lý túi đồ
export async function updatePlayerBagHasSetting(farm, itemKey, quantity) {
  if (!farm.bag[itemKey]) {
    farm.bag[itemKey] = 0;
  }
  farm.bag[itemKey] += quantity;

  // Xóa item nếu số lượng = 0
  if (farm.bag[itemKey] <= 0) {
    delete farm.bag[itemKey];
  }

  setHasChangeState(true);
  return farm.bag[itemKey] || 0;
}

export function parseSlotRanges(rangeStr) {
  const slots = new Set();

  // Tách các phần tử bởi dấu cách
  const parts = rangeStr.split(/\s+/);

  for (const part of parts) {
    // Kiểm tra nếu là phạm vi (có dấu -)
    if (part.includes("-")) {
      const [start, end] = part.split("-").map((num) => parseInt(num));
      if (!isNaN(start) && !isNaN(end)) {
        // Thêm tất cả các số trong phạm vi
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          slots.add(i - 1); // Trừ 1 vì index bắt đầu từ 0
        }
      }
    } else {
      // Nếu là số đơn lẻ
      const num = parseInt(part);
      if (!isNaN(num)) {
        slots.add(num - 1);
      }
    }
  }

  return Array.from(slots);
}

// Thêm hàm kiểm tra số lượng vật phẩm
export async function checkItemQuantity(farm, itemKey) {
  return farm.bag?.[itemKey] || 0;
}

// Thêm hàm mới để xử lý lệnh mybag
export async function handleMyBagCommand(api, message, groupSettings) {
  const threadId = message.threadId;
  if (groupSettings) {
    const activeGame = groupSettings[threadId].activeGame;
    if (activeGame === false) return;
  }

  const senderId = message.data.uidFrom;

  // Kiểm tra người chơi đã đăng nhập
  const playerInfo = await getPlayerInfo(senderId);
  if (playerInfo === null) {
    const result = {
      success: false,
      message: `Bạn chưa đăng nhập tài khoản game nào trên zalo này để xem túi đồ.`,
    };
    await sendMessageFromSQL(api, message, result);
    return;
  }

  if (await checkPlayerBanned(api, message, threadId, senderId)) {
    return;
  }

  const userName = playerInfo.username;
  const farm = await initializeFarm(userName);
  const playerBag = farm.bag;
  let bagMsg = "🎒 TÚI ĐỒ CỦA BẠN 🎒\n\n";

  if (Object.keys(playerBag).length === 0) {
    bagMsg += "Túi đồ trống!";
  } else {
    const seeds = [];
    const products = [];
    const items = [];

    for (const [itemCode, quantity] of Object.entries(playerBag)) {
      const productInfo = PRODUCT_CODES[itemCode];
      if (productInfo) {
        switch (productInfo.type) {
          case "CROP":
            const cropInfo = CROPS[productInfo.key];
            seeds.push(`${cropInfo.icon} [${itemCode}] ${cropInfo.name} (Hạt giống): ${quantity}`);
            break;
          case "PRODUCT":
            const harvestInfo = CROPS[productInfo.key];
            products.push(`${harvestInfo.icon} [${itemCode}] ${harvestInfo.name} (Thu hoạch): ${quantity}`);
            break;
          case "ITEM":
            const itemInfo = SHOP_ITEMS[productInfo.key];
            items.push(`${itemInfo.icon} [${itemCode}] ${itemInfo.name}: ${quantity}`);
            break;
        }
      }
    }

    if (seeds.length > 0) bagMsg += "🌱 HẠT GIỐNG:\n" + seeds.join("\n") + "\n\n";
    if (products.length > 0) bagMsg += "🌾 THÀNH PHẨM:\n" + products.join("\n") + "\n\n";
    if (items.length > 0) bagMsg += "🛠️ VẬT PHẨM:\n" + items.join("\n");
  }

  await api.sendMessage({ msg: bagMsg, quote: message, ttl: TIME_TO_LIVE }, threadId, message.type);
}

async function handleShopCommand(api, message, farm, args) {
  const threadId = message.threadId;
  if (args.length >= 2) {
    const buyProductCode = args[1].toUpperCase();
    const quantity = args[2] ? parseInt(args[2]) : 1;
    await handleBuyProduct(api, message, farm, buyProductCode, quantity);
  } else {
    const landPrice = calculateLandPrice(farm.plots.length);
    const shopMsg = formatShopItems(landPrice);
    const shopCanvas = await drawShopCanvas(landPrice);
    await api.sendMessage(
      { msg: "", attachments: [shopCanvas], ttl: TIME_TO_LIVE, isUseProphylactic: true },
      threadId,
      message.type
    );
    await clearImagePath(shopCanvas);
  }
}

async function handleBuyProductCommand(api, message, farm, args) {
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();

  if (args.length < 2) {
    await api.sendMessage(
      { msg: `Vui lòng nhập mã sản phẩm cần mua. Ví dụ: ${prefix}nongtrai buy W1`, quote: message },
      threadId,
      message.type
    );
    return;
  }

  const buyProductCode = args[1].toUpperCase();
  const quantity = args[2] ? parseInt(args[2]) : 1;
  if (!Number.isInteger(quantity) || quantity < 1) return api.sendMessage({ msg: "Số lượng mua phải là số nguyên dương lớn hơn 1", quote: message, ttl: 6000 }, threadId, message.type);
  await handleBuyProduct(api, message, farm, buyProductCode, quantity);
}

export function groupConsecutiveResults(results) {
  const grouped = [];
  let currentGroup = {
    start: results[0].plotIndex,
    message: results[0].message,
    success: results[0].success,
  };

  for (let i = 1; i <= results.length; i++) {
    if (
      i < results.length &&
      results[i].message === currentGroup.message &&
      results[i].success === currentGroup.success &&
      results[i].plotIndex === results[i - 1].plotIndex + 1
    ) {
      // Kiểm tra tính liên tục
      continue;
    }

    const startPlot = currentGroup.start + 1; // Số thứ tự bắt đầu từ 1
    const endPlot = i < results.length ? results[i - 1].plotIndex + 1 : results[i - 1].plotIndex + 1;

    if (startPlot === endPlot) {
      grouped.push(`Ô ${startPlot}: ${currentGroup.success ? "✅" : "❌"} ${currentGroup.message}`);
    } else {
      grouped.push(`Ô ${startPlot}->${endPlot}: ${currentGroup.success ? "✅" : "❌"} ${currentGroup.message}`);
    }

    if (i < results.length) {
      currentGroup = {
        start: results[i].plotIndex,
        message: results[i].message,
        success: results[i].success,
      };
    }
  }

  return grouped.join("\n\n");
}

export async function handleNongTraiCommand(api, message, groupSettings) {
  if (!(await checkBeforeJoinGame(api, message, groupSettings, true))) return;

  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const prefix = getGlobalPrefix();
  const content = message.data.content.toLowerCase().trim();

  // Kiểm tra người chơi đã đăng nhập
  const playerInfo = await getPlayerInfo(senderId);
  if (playerInfo === null) {
    const result = {
      success: false,
      message: `Bạn chưa đăng nhập tài khoản game nào trên zalo này để tham gia trò chơi nông trại.`,
    };
    await sendMessageFromSQL(api, message, result);
    return;
  }

  if (await checkPlayerBanned(api, message, threadId, senderId)) {
    return;
  }

  // Xử lý lệnh !mybag bằng hàm riêng
  if (content === `${prefix}mybag`) {
    return handleMyBagCommand(api, message, groupSettings);
  }

  const args = content.split(/\s+/);
  args.shift(); // Bỏ lệnh !nongtrai

  // Nếu chưa có args hoặc xem help
  if (args.length === 0 || args[0] === "help") {
    const background = await drawFarmBackground();
    let helpMsg =
      `🌾 HƯỚNG DẪN NÔNG TRẠI 🌾\n\n` +
      `1. ${prefix}nongtrai farm - Xem trạng thái nông trại\n` +
      `2. ${prefix}nongtrai cuocdat [các slot đất] - Cuốc đất\n` +
      `3. ${prefix}nongtrai tuoinuoc [các slot đất] - Tưới nước\n` +
      `4. ${prefix}nongtrai gieohat [mã hạt giống] [các slot đất] - Trồng hạt giống\n` +
      `5. ${prefix}nongtrai use [mã SP] [các slot đất] - Sử dụng vật phẩm\n` +
      `6. ${prefix}nongtrai thuhoach [các slot đất] - Thu hoạch\n` +
      `7. ${prefix}nongtrai shop - Xem cửa hàng\n` +
      `8. ${prefix}nongtrai buy [mã SP] [SL] - Mua vật phẩm\n` +
      `9. ${prefix}nongtrai kho - Xem vật phẩm trong kho\n` +
      `10. ${prefix}nongtrai sell [mã SP] [SL] - Bán sản phẩm\n` +
      `11. ${prefix}nongtrai xoahat [các slot đất] - Xoá bỏ hạt đang trồng\n` +
      `12. ${prefix}nongtrai phacay [các slot đất] - Phá bỏ cây đang trồng\n\n` +
      `Lưu ý:\n` +
      `- Đất sẽ thiếu nước sau 4h Không tưới\n` +
      `- Đất sẽ khô cằn sau 8h Không tưới\n` +
      `- Đất khô cằn cần cuốc trước khi tưới\n` +
      `- Dùng lệnh ntr nếu bn thấy nongtrai là quá dài!!!`;

    await api.sendMessage(
      { msg: helpMsg, attachments: [background], ttl: TIME_TO_LIVE, isUseProphylactic: true },
      threadId,
      message.type
    );
    await clearImagePath(background);

    return;
  }

  // Khởi tạo hoặc lấy dữ liệu nông trại
  const userName = playerInfo.username;
  const farm = await initializeFarm(userName);
  await updateSoilStatus(farm);

  // Xử lý các lệnh khác
  switch (args[0]) {
    case "farm":
    case "check":
    case "f":
      await handleSendStatusCommand(api, message, farm);
      break;

    case "tuoinuoc":
    case "tn":
      await handleWaterPlotCommand(api, message, farm, args);
      break;

    case "cuocdat":
    case "cd":
      await handleCuocDatCommand(api, message, farm, args);
      break;

    case "shop":
    case "cuahang":
      await handleShopCommand(api, message, farm, args);
      break;

    case "buy":
    case "b":
    case "mua":
      await handleBuyProductCommand(api, message, farm, args);
      break;

    case "use":
    case "u":
      await handleUseItemCommand(api, message, farm, args);
      break;

    case "kho":
    case "bag":
      return handleMyBagCommand(api, message, groupSettings);

    case "thuhoach":
    case "th":
      await handleHarvestCommand(api, message, farm, args);
      break;

    case "sell":
      await handleSellProduct(api, message, farm, args);
      break;

    case "gieohat":
    case "gh":
      await handleGieoHatCommand(api, message, farm, args);
      break;
    
    case "xoahat":
    case "bohat":
    case "xh":
      await handleXoaHatCommand(api, message, farm, args);
      break;
    
    case "phacay":
    case "pc":
      await handlePhaCayCommand(api, message, farm, args);
      break;

    default:
      await api.sendMessage(
        { msg: `Lệnh Không hợp lệ. Sử dụng ${prefix}nongtrai help để xem hướng dẫn.`, quote: message },
        threadId,
        message.type
      );
  }
}
