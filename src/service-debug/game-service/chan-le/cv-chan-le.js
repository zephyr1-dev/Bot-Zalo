import fs from "fs/promises";
import path from "path";
import { createCanvas, loadImage } from "canvas";
import { formatCurrency } from "../../../utils/format-util.js";
import { nameServer } from "../../../database/index.js";

// Hàm tạo hiệu ứng chữ nổi với viền, bóng đổ và gradient từ tâm
function drawTextWithEffects(ctx, text, x, y, fontSize, fontWeight, gradientColors, outlineColor, outlineWidth, shadowColor, shadowBlur) {
  ctx.save();
  ctx.font = `${fontWeight} ${fontSize}px 'Bebas Neue', 'Oswald', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Thêm bóng đổ
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Tạo gradient cho chữ từ tâm ra hai phía
  const textWidth = ctx.measureText(text).width;
  const gradient = ctx.createLinearGradient(x - textWidth / 2, y, x + textWidth / 2, y);
  gradientColors.forEach((color, index) => {
    const stop = index / (gradientColors.length - 1);
    gradient.addColorStop(stop, color);
  });

  // Vẽ viền
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = outlineWidth;
  ctx.strokeText(text, x, y);

  // Vẽ chữ với gradient
  ctx.fillStyle = gradient;
  ctx.fillText(text, x, y);

  ctx.restore();
}

// Thêm hàm mới cho chẵn lẻ
export async function createChanLeResultImage(diceResults, total, playerChoice, betAmount, isJackpot, recentResults = [], winnings = null) {
  const width = 800;
  const height = 300;
  const widthCenter = width / 2;
  const heightCenter = height / 2;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Thay đổi màu gradient background dựa vào isJackpot
  const gradient = ctx.createRadialGradient(widthCenter, heightCenter, 0, widthCenter, heightCenter, width / 2);
  if (isJackpot) {
    // Gradient vàng cho jackpot
    gradient.addColorStop(0, "#FFD700"); // Vàng sáng ở tâm
    gradient.addColorStop(0.7, "#DAA520"); // Vàng đậm ở giữa
    gradient.addColorStop(1, "#B8860B"); // Vàng nâu ở ngoài
  } else {
    // Gradient xanh mặc định
    gradient.addColorStop(0, "#000066");
    gradient.addColorStop(0.7, "#000033");
    gradient.addColorStop(1, "#000022");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Điều chỉnh hiệu ứng ánh sáng cho jackpot
  const lightGradient = ctx.createRadialGradient(widthCenter, heightCenter, 0, widthCenter, heightCenter, width / 2);
  if (isJackpot) {
    lightGradient.addColorStop(0, "rgba(255, 255, 255, 0.3)");
    lightGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.1)");
    lightGradient.addColorStop(1, "rgba(255, 255, 255, 0.05)");
  } else {
    lightGradient.addColorStop(0, "rgba(255, 255, 255, 0.15)");
    lightGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
    lightGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  }
  ctx.fillStyle = lightGradient;
  ctx.fillRect(0, 0, width, height);

  // Thêm nhiều hiệu ứng lấp lánh hơn cho jackpot
  const sparkleCount = isJackpot ? 120 : 70;
  for (let i = 0; i < sparkleCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = Math.random() * (isJackpot ? 2 : 1.5);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * (isJackpot ? 0.9 : 0.7)})`;
    ctx.fill();
  }

  // Điều chỉnh kích thước và vị trí hình vuông
  const squareSize = 220; // Tăng kích thước
  const squareX = width * 0.23 - squareSize / 2; // Di chuyển sang trái
  const squareY = heightCenter - squareSize / 2;
  ctx.beginPath();
  ctx.rect(squareX, squareY, squareSize, squareSize);
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Điều chỉnh vị trí đĩa tròn
  const diskCenterX = width * 0.23; // Tâm đĩa ở 1/4 chiều rộng
  ctx.beginPath();
  ctx.arc(diskCenterX, heightCenter, squareSize / 2 - 10, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Tính toán vị trí ngẫu nhiên cho 3 xúc sắc trong phạm vi đĩa
  const diceSize = 45; // Giảm kích thước xúc sắc
  const radius = squareSize / 2 - diceSize; // Bán kính an toàn để xúc sắc Không ra ngoài đĩa
  const dicePositions = [];

  // Hàm kiểm tra xúc sắc mới có đè lên xúc sắc cũ Không
  const isOverlapping = (x, y, positions) => {
    const minDistance = diceSize * 1.2; // Khoảng cách tối thiểu giữa các xúc sắc
    return positions.some((pos) => {
      const distance = Math.sqrt(Math.pow(pos.x - x, 2) + Math.pow(pos.y - y, 2));
      return distance < minDistance;
    });
  };

  // Tạo vị trí ngẫu nhiên cho 3 xúc sắc
  for (let i = 0; i < 3; i++) {
    let x, y;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      // Tạo góc ngẫu nhiên
      const angle = Math.random() * 2 * Math.PI;
      // Tạo bán kính ngẫu nhiên (Không quá gần tâm)
      const r = (Math.random() * 0.6 + 0.3) * radius; // Từ 30% đến 90% bán kính tối đa
      x = diskCenterX + r * Math.cos(angle);
      y = heightCenter + r * Math.sin(angle);
      attempts++;
    } while (isOverlapping(x, y, dicePositions) && attempts < maxAttempts);

    dicePositions.push({ x, y });
  }

  // Vẽ xúc sắc tại các vị trí đã tính
  for (let i = 0; i < diceResults.length; i++) {
    const diceValue = diceResults[i];
    const { x, y } = dicePositions[i];

    const imagePath = path.join(process.cwd(), "assets", "resources", "game", "taixiu", `dice_${diceValue}.png`);

    try {
      const img = await loadImage(imagePath);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.random() * 2 * Math.PI);
      ctx.drawImage(img, -diceSize / 2, -diceSize / 2, diceSize, diceSize);
      ctx.restore();
    } catch (error) {
      console.error(`Không tìm thấy hình ảnh cho xúc sắc ${diceValue}`);
    }
  }

  // Màu gradient cho kết quả thắng/thua
  const gradientWin = ["#FFFF00", "#FFD700", "#FFA500"];
  const gradientLose = ["#A9A9A9", "#808080", "#696969"];
  const resultIsEven = total % 2 === 0;
  const playerWin = (resultIsEven && playerChoice === "chan") || (!resultIsEven && playerChoice === "le");

  // Định nghĩa resultText và các gradient tương ứng
  const resultText = resultIsEven ? "CHẴN" : "LẺ";
  const resultGradient = resultIsEven
    ? ["#00FF00", "#32CD32", "#00FF00"] // Xanh lá cho chẵn
    : ["#FF69B4", "#FF1493", "#FF69B4"]; // Hồng cho lẻ

  // Điều chỉnh vị trí text sang phải
  const textCenterX = width * 0.66;

  if (isJackpot) {
    // Vẽ 4 hàng khi có Jackpot
    const spacing = 45;
    const startY = height * 0.2;

    // Dòng 1: JACKPOT - Màu vàng sáng
    drawTextWithEffects(
      ctx,
      "JACKPOT!",
      textCenterX,
      startY,
      40,
      "bold",
      ["#FFD700", "#FFF000", "#FFD700"],
      "#000000",
      5,
      "rgba(0,0,0,0.5)",
      15
    );

    // Dòng 2: Kết quả (Chẵn/Lẻ) - Giữ nguyên màu xanh/hồng
    drawTextWithEffects(
      ctx,
      resultText,
      textCenterX,
      startY + spacing,
      35,
      "bold",
      resultGradient,
      "#000000",
      4,
      "rgba(0,0,0,0.5)",
      10
    );

    // Dòng 3: Tổng điểm - Màu trắng sáng
    drawTextWithEffects(
      ctx,
      `Tổng: ${total}`,
      textCenterX,
      startY + spacing * 2,
      30,
      "bold",
      ["#FFFFFF", "#F8F8F8", "#FFFFFF"],
      "#000000",
      4,
      "rgba(0,0,0,0.5)",
      10
    );

    // Dòng 4: Số tiền thắng (đã bao gồm cả tiền jackpot) - Màu vàng sáng
    const netWinnings = winnings.minus(betAmount);
    const winText = `Thắng: ${formatCurrency(netWinnings, 999_999_999_999)} VNĐ`;
    drawTextWithEffects(
      ctx,
      winText,
      textCenterX,
      startY + spacing * 3,
      30,
      "bold",
      ["#FFD700", "#FFF000", "#FFD700"],
      "#000000",
      3,
      "rgba(0,0,0,0.3)",
      5
    );
  } else {
    // Vẽ 3 hàng khi Không có Jackpot
    const spacing = 50;
    const startY = height * 0.2;

    // Dòng 1: Kết quả (Chẵn/Lẻ) - Giữ nguyên màu xanh/hồng
    drawTextWithEffects(
      ctx,
      resultText,
      textCenterX,
      startY,
      40,
      "bold",
      resultGradient,
      "#000000",
      4,
      "rgba(0,0,0,0.5)",
      10
    );

    // Dòng 2: Tổng điểm - Màu trắng sáng
    drawTextWithEffects(
      ctx,
      `Tổng: ${total}`,
      textCenterX,
      startY + spacing,
      35,
      "bold",
      ["#FFFFFF", "#F8F8F8", "#FFFFFF"],
      "#000000",
      4,
      "rgba(0,0,0,0.5)",
      10
    );

    // Dòng 3: Thắng/Thua - Màu vàng cho thắng, bạc sáng cho thua
    const netWinnings = winnings.minus(betAmount);
    const resultMoneyText = playerWin 
      ? `Thắng: ${formatCurrency(netWinnings, 999_999_999_999)} VNĐ`
      : `Thua: ${formatCurrency(betAmount, 999_999_999_999)} VNĐ`;
    drawTextWithEffects(
      ctx,
      resultMoneyText,
      textCenterX,
      startY + spacing * 2,
      30,
      "bold",
      playerWin 
        ? ["#FFD700", "#FFF000", "#FFD700"] // Vàng sáng hơn cho thắng
        : ["#E0E0E0", "#D0D0D0", "#E0E0E0"], // Bạc sáng hơn cho thua
      "#000000",
      3,
      "rgba(0,0,0,0.3)",
      5
    );
  }

  // Thay phần vẽ lịch sử giả bằng dữ liệu thực
  if (recentResults.length > 0) {
    const historyX = width * 0.56;
    const historyY = height - 48;

    // Vẽ khung chứa lịch sử với độ bo góc
    const cornerRadius = 18; // Độ bo góc 10px
    const historyBoxWidth = 350;
    const historyBoxHeight = 36;
    const historyBoxX = historyX - 100;
    const historyBoxY = historyY - 25;

    // Vẽ hình chữ nhật có bo góc
    ctx.beginPath();
    ctx.moveTo(historyBoxX + cornerRadius, historyBoxY);
    ctx.lineTo(historyBoxX + historyBoxWidth - cornerRadius, historyBoxY);
    ctx.arcTo(historyBoxX + historyBoxWidth, historyBoxY, historyBoxX + historyBoxWidth, historyBoxY + cornerRadius, cornerRadius);
    ctx.lineTo(historyBoxX + historyBoxWidth, historyBoxY + historyBoxHeight - cornerRadius);
    ctx.arcTo(historyBoxX + historyBoxWidth, historyBoxY + historyBoxHeight, historyBoxX + historyBoxWidth - cornerRadius, historyBoxY + historyBoxHeight, cornerRadius);
    ctx.lineTo(historyBoxX + cornerRadius, historyBoxY + historyBoxHeight);
    ctx.arcTo(historyBoxX, historyBoxY + historyBoxHeight, historyBoxX, historyBoxY + historyBoxHeight - cornerRadius, cornerRadius);
    ctx.lineTo(historyBoxX, historyBoxY + cornerRadius);
    ctx.arcTo(historyBoxX, historyBoxY, historyBoxX + cornerRadius, historyBoxY, cornerRadius);
    ctx.closePath();

    // Tô màu nền
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fill();

    // Vẽ viền
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Vẽ chữ "Lịch sử" sáng hơn
    ctx.font = "bold 20px BeVietnamPro";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.fillText("Lịch sử: ", historyX - 88, historyY);

    // Vẽ các kết quả với màu sáng hơn
    ctx.font = "16px Tahoma";
    const displayResults = recentResults.slice(-10);
    const startX = historyX - 8;
    const spacing = 25;
    const historyYDisplay = historyY - 1;

    displayResults.forEach((result, index) => {
      let emoji = result.total % 2 === 0 ? "⚫" : "⚪";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(emoji, startX + index * spacing, historyYDisplay);
    });
  }

  // Lưu canvas thành file ảnh
  const filePath = path.resolve(`./assets/temp/chanle_result_${Date.now()}.png`);
  await fs.writeFile(filePath, canvas.toBuffer());

  return filePath;
}
