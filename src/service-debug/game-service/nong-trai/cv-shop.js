import { createCanvas, loadImage } from "canvas";
import path from "path";
import fs from "fs";
import { SHOP_ITEMS, CROPS } from "./data-nongtrai.js";
import { formatCurrency } from "../../../utils/format-util.js";

const ITEMS_PER_ROW = 4;
const ITEM_WIDTH = 280;
const ITEM_HEIGHT = 330;
const PADDING = 20;
const IMAGE_SIZE = 100;
const SECTION_PADDING = 30; // Padding giữa 2 khu vực
const HEADER_HEIGHT = 60; // Chiều cao cho tiêu đề khu vực

// Cache cho images
const imageCache = new Map();

async function loadProductImage(code) {
  if (imageCache.has(code)) {
    return imageCache.get(code);
  }

  try {
    const imagePath = path.join(
      process.cwd(),
      "src",
      "service-debug",
      "game-service",
      "nong-trai",
      "res",
      "shop",
      `${code}.png`
    );

    if (fs.existsSync(imagePath)) {
      const image = await loadImage(imagePath);
      imageCache.set(code, image);
      return image;
    }
  } catch (error) {
    console.error(`Lỗi load ảnh sản phẩm ${code}:`, error);
  }
  return null;
}

function drawSectionHeader(ctx, text, x, y, width) {
  // Vẽ background cho header
  ctx.save();
  const gradient = ctx.createLinearGradient(x, y, x + width, y);
  gradient.addColorStop(0, '#4a90e2');
  gradient.addColorStop(1, '#357abd');
  ctx.fillStyle = gradient;
  
  ctx.beginPath();
  ctx.roundRect(x, y, width, HEADER_HEIGHT, 10);
  ctx.fill();

  // Tăng font size header lên 28px
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + width/2, y + HEADER_HEIGHT/2);
  ctx.restore();
}

export async function drawShopCanvas(landPrice) {
  const tools = Object.entries(SHOP_ITEMS);
  const seeds = Object.entries(CROPS);

  // Tính toán kích thước cho mỗi section
  const toolRows = Math.ceil(tools.length / ITEMS_PER_ROW);
  const seedRows = Math.ceil(seeds.length / ITEMS_PER_ROW);

  const width = (ITEM_WIDTH + PADDING) * ITEMS_PER_ROW + PADDING;
  const height = (ITEM_HEIGHT + PADDING) * (toolRows + seedRows) + PADDING * 3 + HEADER_HEIGHT * 2 + SECTION_PADDING;

  // Tạo canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Vẽ background
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#f6f7f9");
  gradient.addColorStop(1, "#e9ebee");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Vẽ header cho khu vực dụng cụ
  drawSectionHeader(ctx, "🛠️ KHU VỰC DỤNG CỤ 🛠️", PADDING, PADDING, width - PADDING * 2);
  
  // Vẽ các dụng cụ
  let currentY = PADDING + HEADER_HEIGHT + PADDING;
  for (let i = 0; i < tools.length; i++) {
    const row = Math.floor(i / ITEMS_PER_ROW);
    const col = i % ITEMS_PER_ROW;
    const x = col * (ITEM_WIDTH + PADDING) + PADDING;
    const y = currentY + row * (ITEM_HEIGHT + PADDING);

    await drawItem(ctx, tools[i], x, y, landPrice);
  }

  // Vẽ header cho khu vực hạt giống
  currentY += toolRows * (ITEM_HEIGHT + PADDING) + SECTION_PADDING;
  drawSectionHeader(ctx, "🌱 KHU VỰC HẠT GIỐNG 🌱", PADDING, currentY, width - PADDING * 2);
  
  // Vẽ các hạt giống
  currentY += HEADER_HEIGHT + PADDING;
  for (let i = 0; i < seeds.length; i++) {
    const row = Math.floor(i / ITEMS_PER_ROW);
    const col = i % ITEMS_PER_ROW;
    const x = col * (ITEM_WIDTH + PADDING) + PADDING;
    const y = currentY + row * (ITEM_HEIGHT + PADDING);

    await drawItem(ctx, seeds[i], x, y, landPrice);
  }

  // Lưu canvas thành file
  const filePath = path.resolve(`./assets/temp/shop_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}

async function drawItem(ctx, [key, item], x, y, landPrice) {
  // Vẽ background cho item với gradient và shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  
  const itemGradient = ctx.createLinearGradient(x, y, x, y + ITEM_HEIGHT);
  itemGradient.addColorStop(0, '#ffffff');
  itemGradient.addColorStop(1, '#f8f9fa');
  ctx.fillStyle = itemGradient;
  
  ctx.beginPath();
  ctx.roundRect(x, y, ITEM_WIDTH, ITEM_HEIGHT, 15);
  ctx.fill();
  ctx.restore();

  // Vẽ border
  ctx.strokeStyle = "#e1e4e8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, ITEM_WIDTH, ITEM_HEIGHT, 15);
  ctx.stroke();

  // Load và vẽ ảnh sản phẩm nếu có
  let imageY = y + 40;
  let actualImageHeight = 0;
  const productCode = item.cropImageCode || item.code;
  
  if (productCode) {
    const productImage = await loadProductImage(productCode);
    if (productImage) {
      const scale = Math.min(IMAGE_SIZE / productImage.width, IMAGE_SIZE / productImage.height);
      const imageWidth = productImage.width * scale;
      const imageHeight = productImage.height * scale;
      actualImageHeight = imageHeight;

      const imageX = x + (ITEM_WIDTH - imageWidth) / 2;
      const productY = y + 30;
      
      ctx.drawImage(productImage, imageX, productY, imageWidth, imageHeight);
      imageY = y + actualImageHeight + 50;
    } else {
      imageY = imageY + 120;
    }
  }

  // Thiết lập font
  ctx.textAlign = "center";

  if (item.seedPrice) { // Là hạt giống
    // Vẽ tên với padding phù hợp từ ảnh
    ctx.font = "bold 22px Arial";
    ctx.fillStyle = "#2c3e50";
    ctx.fillText(`${item.name}`, x + ITEM_WIDTH/2, imageY);
    
    // Điều chỉnh khoảng cách các thông tin tiếp theo
    ctx.font = "bold 24px tahoma";
    ctx.fillStyle = "#2c3e50";
    ctx.fillText(`Mã: ${item.code}`, x + ITEM_WIDTH/2, imageY + 35);
    
    ctx.font = "20px Arial";
    ctx.fillStyle = "#e74c3c";
    ctx.fillText(`💰 ${item.seedPrice.toLocaleString()}đ`, x + ITEM_WIDTH/2, imageY + 70);
    
    ctx.fillStyle = "#3498db";
    ctx.fillText(`⏱️ ${item.growthTime/60} phút`, x + ITEM_WIDTH/2, imageY + 105);
    
    ctx.fillStyle = "#27ae60";
    ctx.fillText(`💎 ${item.harvestValue.toLocaleString()}đ`, x + ITEM_WIDTH/2, imageY + 140);

  } else { // Là vật phẩm
    // Tương tự điều chỉnh cho vật phẩm
    ctx.font = "bold 22px Arial";
    ctx.fillStyle = "#2c3e50";
    ctx.fillText(`${item.name}`, x + ITEM_WIDTH/2, imageY);
    
    ctx.font = "bold 24px tahoma";
    ctx.fillStyle = "#2c3e50";
    ctx.fillText(`Mã: ${item.code}`, x + ITEM_WIDTH/2, imageY + 35);
    
    ctx.font = "20px Arial";
    ctx.fillStyle = "#e74c3c";
    const price = key === "LAND" ? landPrice : item.price;
    ctx.fillText(`💰 ${formatCurrency(price, 999_999_999_999)} VND`, x + ITEM_WIDTH/2, imageY + 70);
    
    // Vẽ mô tả với khoảng cách phù hợp
    ctx.font = "18px Arial";
    ctx.fillStyle = "#7f8c8d";
    const words = item.description.split(' ');
    let line = '';
    let yPos = imageY + 105;
    
    for (const word of words) {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > ITEM_WIDTH - 40) {
        ctx.fillText(line, x + ITEM_WIDTH/2, yPos);
        line = word + ' ';
        yPos += 30;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x + ITEM_WIDTH/2, yPos);
  }
} 