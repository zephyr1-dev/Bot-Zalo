import { SOIL_STATUS, CROPS } from "./data-nongtrai.js";
import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";

const PLOT_SIZE = 80; // Giảm kích thước mỗi ô đất xuống
const GRASS_HEIGHT = 20; // Giảm chiều cao cỏ
const MAX_PLOTS_PER_ROW = 12; // Tăng số ô đất trên mỗi hàng lên 12

// Thêm biến để lưu cache image
let soilImage = null;

// Thêm biến cache cho ảnh cây trồng
let cropImages = {};

// Hàm lấy mã số ảnh theo loại cây
function getCropImageCode(cropType) {
  const cropInfo = CROPS[cropType];
  return cropInfo?.cropImageCode || 1;
}

// Hàm load và cache ảnh cây
async function getCropImage(cropType, stage) {
  const imageCode = getCropImageCode(cropType);
  if (!imageCode) return null;

  const cacheKey = `${imageCode}_${stage}`;
  if (!cropImages[cacheKey]) {
    try {
      let imagePath;
      switch (stage) {
        case "seed":
          imagePath = `gieohat.png`;
          break;
        case "young":
          imagePath = `${imageCode}.png`;
          break;
        case "growing":
          imagePath = `${imageCode}-uong.png`;
          break;
        case "ripe":
          imagePath = `${imageCode}-chin.png`;
          break;
      }
      cropImages[cacheKey] = await loadImage(
        path.join(process.cwd(), "src", "service-debug", "game-service", "nong-trai", "res", "caytrong", imagePath)
      );
    } catch (error) {
      console.error(`Lỗi load ảnh cây ${cropType} stage ${stage}:`, error);
      return null;
    }
  }
  return cropImages[cacheKey];
}

// Thêm hàm load và cache image
async function getSoilImage() {
  if (!soilImage) {
    soilImage = await loadImage(path.join(process.cwd(), "src", "service-debug", "game-service", "nong-trai", "res", "dat", "dat_tot.png"));
  }
  return soilImage;
}

export async function drawFarm(farm) {
  const plots = farm.plots;
  const plotsCount = plots.length;

  // Tính số hàng và số cột
  const cols = Math.min(plotsCount, MAX_PLOTS_PER_ROW);
  const rows = Math.ceil(plotsCount / MAX_PLOTS_PER_ROW);

  // Tính kích thước canvas
  const grassRowsCount = rows * 2 + 1; // 2 hàng cỏ cho mỗi hàng đất + 1 hàng cuối
  const width = cols * PLOT_SIZE + 2 * GRASS_HEIGHT; // Thêm viền cỏ 2 bên
  const height = rows * PLOT_SIZE + grassRowsCount * GRASS_HEIGHT;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#90EE90";
  ctx.fillRect(0, 0, width, height);

  // Vẽ các bông hoa tuyết
  drawSnowflowers(ctx, width, height);

  // Vẽ các ô đất
  for (let i = 0; i < plotsCount; i++) {
    const row = Math.floor(i / MAX_PLOTS_PER_ROW);
    const col = i % MAX_PLOTS_PER_ROW;

    const x = col * PLOT_SIZE + GRASS_HEIGHT; // Thêm lề cỏ bên trái
    const y = row * PLOT_SIZE + (row * 2 + 1) * GRASS_HEIGHT - 6; // Thêm khoảng cách cho các hàng cỏ

    await drawPlot(ctx, x, y, plots[i], i);
  }

  const filePath = path.resolve(`./assets/temp/nongtrai_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}

function drawSnowflowers(ctx, width, height) {
  const flowerCount = Math.floor((width * height) / 5000); // Số lượng hoa dựa vào diện tích

  ctx.fillStyle = "#FFFFFF";
  for (let i = 0; i < flowerCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = 2 + Math.random() * 2;

    // Vẽ hoa tuyết 6 cánh
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
      const x1 = x + Math.cos(angle) * size;
      const y1 = y + Math.sin(angle) * size;
      ctx.beginPath();
      ctx.arc(x1, y1, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vẽ tâm hoa
    ctx.beginPath();
    ctx.arc(x, y, 1, 0, Math.PI * 2);
    ctx.fill();
  }
}

async function drawPlot(ctx, x, y, plot, plotIndex) {
  const soil = await getSoilImage();
  const BAR_HEIGHT = 5;
  const BAR_WIDTH = PLOT_SIZE * 0.8;
  const BAR_MARGIN = 5;

  ctx.save();

  // Chỉ vẽ đất nếu Không có cây trồng
  if (!plot.crop) {
    ctx.drawImage(soil, x, y, PLOT_SIZE, PLOT_SIZE);
  }

  ctx.restore();

  // Nếu có cây trồng
  if (plot.crop) {
    const now = Date.now();
    const cropInfo = CROPS[plot.crop];
    const growthTime = cropInfo.growthTime * 1000;
    const timePassed = now - plot.plantedAt;
    const progress = timePassed / growthTime;

    let stage;
    if (progress >= 1) {
      stage = "ripe";
    } else if (progress >= 0.66) {
      stage = "growing";
    } else if (progress >= 0.33) {
      stage = "young";
    } else {
      stage = "seed";
    }

    // Vẽ thanh tiến trình phát triển của cây (ở trên cùng)
    const growthBarX = x + (PLOT_SIZE - BAR_WIDTH) / 2;
    const growthBarY = y + BAR_MARGIN;

    // Vẽ nền thanh tiến trình (màu đen)
    ctx.fillStyle = "#000000";
    ctx.fillRect(growthBarX, growthBarY, BAR_WIDTH, BAR_HEIGHT);

    // Vẽ tiến trình phát triển với gradient từ đỏ sang xanh lá
    const growthBarFillWidth = BAR_WIDTH * Math.min(progress, 1);
    const gradient = ctx.createLinearGradient(growthBarX, 0, growthBarX + BAR_WIDTH, 0);
    gradient.addColorStop(0, "#FF0000"); // Đỏ
    gradient.addColorStop(0.5, "#FFFF00"); // Vàng
    gradient.addColorStop(1, "#00FF00"); // Xanh lá
    ctx.fillStyle = gradient;
    ctx.fillRect(growthBarX, growthBarY, growthBarFillWidth, BAR_HEIGHT);

    // Vẽ ảnh cây (ở giữa)
    const cropImage = await getCropImage(plot.crop, stage);
    if (cropImage) {
      const cropSize = PLOT_SIZE;
      const cropX = x + (PLOT_SIZE - cropSize) / 2;
      const cropY = y + (PLOT_SIZE - cropSize) / 2;
      ctx.drawImage(cropImage, cropX, cropY, cropSize, cropSize);
    }
  }

  // Vẽ biểu tượng giọt nước và thanh độ ẩm ở dưới cùng
  const waterBarX = x + (PLOT_SIZE - BAR_WIDTH) / 2;
  const waterBarY = y + PLOT_SIZE - BAR_HEIGHT - BAR_MARGIN + 20;

  // Vẽ biểu tượng giọt nước
  ctx.fillStyle = "#1E90FF";
  const dropSize = BAR_HEIGHT * 3;
  const dropX = waterBarX - dropSize;
  const dropY = waterBarY - dropSize/3;
  
  // Vẽ giọt nước to hơn
  ctx.beginPath();
  ctx.moveTo(dropX + dropSize/2, dropY);
  ctx.bezierCurveTo(
    dropX + dropSize/2, dropY - dropSize*0.7,
    dropX + dropSize, dropY,
    dropX + dropSize/2, dropY + dropSize*0.7
  );
  ctx.bezierCurveTo(
    dropX, dropY,
    dropX + dropSize/2, dropY - dropSize*0.7,
    dropX + dropSize/2, dropY
  );
  ctx.fill();

  // Vẽ nền thanh độ ẩm (màu đen)
  ctx.fillStyle = "#000000";
  ctx.fillRect(waterBarX, waterBarY, BAR_WIDTH, BAR_HEIGHT);

  // Vẽ độ ẩm hiện tại (màu xanh da trời)
  const waterProgress = plot.waterLevel / 100;
  const waterBarFillWidth = BAR_WIDTH * waterProgress;
  ctx.fillStyle = "#1E90FF";
  ctx.fillRect(waterBarX, waterBarY, waterBarFillWidth, BAR_HEIGHT);

  // Vẽ số thứ tự ô đất
  ctx.fillStyle = "#000000";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  const plotNumberY = waterBarY + BAR_HEIGHT + 15;
  ctx.fillText(`#${plotIndex + 1}`, x + PLOT_SIZE/2, plotNumberY);
}

export async function drawFarmBackground() {
  const buildingImages = [
    'nhakho.png',
    'farm.png',
    'bxh.png', 
    'cuahangfarm.png',
    'atm.png'
  ];

  try {
    // Load tất cả ảnh
    const images = await Promise.all(
      buildingImages.map(img => 
        loadImage(path.join(process.cwd(), 'src', 'service-debug', 'game-service', 'nong-trai', 'res', 'zone', img))
      )
    );

    // Tính toán kích thước canvas dựa trên ảnh
    const spacing = 20; // Khoảng cách giữa các ảnh
    const totalWidth = images.reduce((sum, img) => sum + img.width, 0) + 
                      (spacing * (images.length - 1));
    
    // Thêm padding 2 bên
    const padding = 40;
    const width = totalWidth + (padding * 2);
    
    // Chiều cao canvas dựa trên ảnh cao nhất
    const maxImageHeight = Math.max(...images.map(img => img.height));
    const height = maxImageHeight * 2; // Gấp đôi chiều cao ảnh lớn nhất

    // Tạo canvas với kích thước đã tính
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Vẽ bầu trời (60% chiều cao)
    const skyHeight = Math.floor(height * 0.6);
    const skyGradient = ctx.createLinearGradient(0, 0, 0, skyHeight);
    skyGradient.addColorStop(0, '#87CEEB');
    skyGradient.addColorStop(1, '#B0E0E6');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, skyHeight);

    // Vẽ bãi cỏ (40% chiều cao)
    const grassHeight = height - skyHeight;
    const grassGradient = ctx.createLinearGradient(0, skyHeight, 0, height);
    grassGradient.addColorStop(0, '#90EE90');
    grassGradient.addColorStop(1, '#32CD32');
    ctx.fillStyle = grassGradient;
    ctx.fillRect(0, skyHeight, width, grassHeight);

    // Vẽ đường đất ngang
    const roadHeight = Math.floor(grassHeight * 0.3); // Chiều cao đường = 30% chiều cao bãi cỏ
    const roadY = skyHeight + Math.floor((grassHeight - roadHeight) / 2); // Căn giữa đường trong bãi cỏ
    ctx.fillStyle = '#DEB887';
    ctx.fillRect(0, roadY, width, roadHeight);

    // Vẽ viền đường ngang
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, roadY);
    ctx.lineTo(width, roadY);
    ctx.moveTo(0, roadY + roadHeight);
    ctx.lineTo(width, roadY + roadHeight);
    ctx.stroke();

    // Vẽ các công trình - căn chỉnh để chân công trình chạm viền cỏ
    let currentX = padding;
    const buildingY = skyHeight - 10; // Điều chỉnh vị trí Y để chân công trình chạm viền cỏ

    images.forEach((img, index) => {
      // Tính toán vị trí Y để chân công trình chạm viền cỏ
      const y = buildingY - img.height + 16;
      ctx.drawImage(img, currentX, y, img.width, img.height);
      currentX += img.width + spacing;
    });

    const filePath = path.resolve(`./assets/temp/nongtrai_${Date.now()}.png`);
    const out = fs.createWriteStream(filePath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    return new Promise((resolve, reject) => {
      out.on("finish", () => resolve(filePath));
      out.on("error", reject);
    });
  } catch (error) {
    console.error('Lỗi khi load ảnh công trình:', error);
    throw error;
  }
}
