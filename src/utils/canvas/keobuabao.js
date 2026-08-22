import { createCanvas, loadImage, registerFont } from "canvas";
import path from "path";
import fs from "fs/promises";
import { formatBigNumber } from "../format-util.js";

// Đăng ký font chữ
registerFont("./assets/fonts/SVN-Transformer.ttf", { family: "Transformer" });
registerFont("./assets/fonts/BeVietnamPro-Bold.ttf", { family: "BeVietnamPro" });

const WIDTH = 1000;
const HEIGHT = 520;
const IMAGE_SIZE = 260;

const IMAGE_PATH = path.resolve(`./assets/resources/game/keobuabao`);

export async function createKBBResultImage(playerChoice, botChoice, betAmount, isWin) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // Vẽ background với gradient đẹp hơn
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, "#000428");
  gradient.addColorStop(1, "#004e92");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Thêm hiệu ứng ánh sáng
  const glowGradient = ctx.createRadialGradient(
    WIDTH/2, HEIGHT/2, 0,
    WIDTH/2, HEIGHT/2, WIDTH/2
  );
  glowGradient.addColorStop(0, "rgba(255, 255, 255, 0.2)");
  glowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glowGradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  try {

    const y = HEIGHT / 2 - IMAGE_SIZE / 2 - 30;
    // Load và vẽ hình ảnh lựa chọn của người chơi với shadow
    const playerImg = await loadImage(
      path.resolve(`${IMAGE_PATH}/${playerChoice.key}-left.png`)
    );
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 10;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(
      playerImg,
      WIDTH / 4 - IMAGE_SIZE / 2,
      y,
      IMAGE_SIZE,
      IMAGE_SIZE
    );
    ctx.restore();

    // Load và vẽ hình ảnh lựa chọn của bot với shadow
    const botImg = await loadImage(
      path.resolve(`${IMAGE_PATH}/${botChoice.key}-right.png`) 
    );
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = -10;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(
      botImg,
      (WIDTH * 3) / 4 - IMAGE_SIZE / 2,
      y,
      IMAGE_SIZE,
      IMAGE_SIZE
    );
    ctx.restore();

    // Vẽ chữ VS với font Transformer
    ctx.font = "bold 150px Transformer";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Tạo nhiều lớp outline cho hiệu ứng 3D
    const outlineColors = ["#ff0000", "#cc0000", "#990000"];
    outlineColors.forEach((color, index) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 12 - index * 3;
      ctx.strokeText("VS", WIDTH / 2, HEIGHT / 2);
    });

    // Tạo gradient màu cho chữ VS
    const vsGradient = ctx.createLinearGradient(
      WIDTH / 2 - 50,
      HEIGHT / 2 - 50,
      WIDTH / 2 + 50,
      HEIGHT / 2 + 50
    );
    vsGradient.addColorStop(0, "#ffd700");
    vsGradient.addColorStop(0.5, "#ff4500");
    vsGradient.addColorStop(1, "#ff0000");
    ctx.fillStyle = vsGradient;
    ctx.fillText("VS", WIDTH / 2, HEIGHT / 2);

    // Thêm hiệu ứng glow cho chữ VS
    ctx.shadowColor = "#ff4500";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillText("VS", WIDTH / 2, HEIGHT / 2);

    // Thêm tên người chơi và bot với font BeVietnamPro
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 10;
    ctx.font = "bold 48px BeVietnamPro";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Player", WIDTH / 4, HEIGHT - 100);
    ctx.fillText("Bot", (WIDTH * 3) / 4, HEIGHT - 100);

    // Thêm hiển thị tiền cược
    ctx.font = "bold 36px BeVietnamPro";
    if (isWin === "win") {
      ctx.fillStyle = "#00ff00"; // Màu xanh lá cho thắng
      ctx.fillText(`+${formatBigNumber(betAmount)} VND`, WIDTH / 2, HEIGHT - 30);
    } else if (isWin === "lose") {
      ctx.fillStyle = "#ff0000"; // Màu đỏ cho thua
      ctx.fillText(`-${formatBigNumber(betAmount)} VND`, WIDTH / 2, HEIGHT - 30);
    }

    // Lưu canvas thành file ảnh
    const fileName = `kbb_result_${Date.now()}.png`;
    const filePath = path.resolve(`./assets/temp/${fileName}`);
    await fs.writeFile(filePath, canvas.toBuffer());

    return filePath;
  } catch (error) {
    console.error("Lỗi khi tạo ảnh kết quả KBB:", error);
    return null;
  }
} 