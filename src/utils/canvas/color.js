// Màu ngẫu nhiên
function getRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// Màu ngẫu nhiên gradient
function getRandomGradient(ctx, width) {
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  for (let i = 0; i <= 1; i += 0.25) {
    gradient.addColorStop(i, getRandomBrightColor());
  }
  return gradient;
}

// Màu ngẫu nhiên gradient 2
function getRandomGradient2(ctx, x0, x1) {
  const gradient = ctx.createLinearGradient(x0, 0, x1, 0);
  for (let i = 0; i <= 1; i += 0.25) {
    gradient.addColorStop(i, getRandomBrightColor());
  }
  return gradient;
}

// Thêm hàm vẽ hiệu ứng nền động
function drawAnimatedBackground(ctx, width, height) {
  const time = Date.now() * 0.001;
  for (let i = 0; i < 100; i++) {
    const x = Math.sin(i * 0.1 + time) * width * 0.5 + width * 0.5;
    const y = Math.cos(i * 0.1 + time) * height * 0.5 + height * 0.5;
    const radius = Math.sin(i * 0.05 + time) * 2 + 3;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + Math.sin(i) * 0.05})`;
    ctx.fill();
  }
}

// Thêm hàm vẽ nền gradient động mới
function drawGradientGreenBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  const colors = ["#0097b2", "#7ed957"];
  colors.forEach((color, index) => {
    gradient.addColorStop(index / (colors.length - 1), color);
  });

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Thêm hiệu ứng hạt sáng
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = Math.random() * 3 + 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.5 + 0.5})`;
    ctx.fill();
  }
}

// Thêm hàm vẽ nền gradient động mới
function drawGradientGreenNextground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  const colors = ["#7ed957", "#0097b2"];
  colors.forEach((color, index) => {
    gradient.addColorStop(index / (colors.length - 1), color);
  });

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Thêm hiệu ứng hạt sáng
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = Math.random() * 3 + 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.5 + 0.5})`;
    ctx.fill();
  }
}

// Thêm hàm vẽ nền gradient động mới
function drawDynamicGradientBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  const colors = ["#6a3093", "#a044ff", "#5f2c82", "#49a09d", "#5f2c82"];
  colors.forEach((color, index) => {
    gradient.addColorStop(index / (colors.length - 1), color);
  });

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Thêm hiệu ứng hạt sáng
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = Math.random() * 3 + 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.5 + 0.5})`;
    ctx.fill();
  }
}

function getRandomBrightColor() {
  const colors = [
    60,  // Vàng
    120, // Xanh lá
    180, // Xanh ngọc
    200, // Xanh lam
  ];
  const hue = colors[Math.floor(Math.random() * colors.length)];
  const saturation = Math.floor(Math.random() * 5) + 95;
  const lightness = Math.floor(Math.random() * 5) + 80;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function getRandomRainbowColor() {
  const rainbowColors = [
    "#FF0000", // Đỏ
    "#FF7F00", // Cam
    "#FFFF00", // Vàng
    "#00FF00", // Lục
    "#0000FF", // Lam
    "#4B0082", // Chàm
    "#9400D3", // Tím
  ];
  return rainbowColors[Math.floor(Math.random() * rainbowColors.length)];
}

function getRandomRainbowGradient(ctx, width) {
  const rainbowColors = [
    "#FF0000", // Đỏ
    "#FF7F00", // Cam
    "#FFFF00", // Vàng
    "#00FF00", // Lục
    "#0000FF", // Lam
    "#4B0082", // Chàm
    "#9400D3", // Tím
  ];

  // Xáo trộn mảng màu sắc
  const shuffledColors = [...rainbowColors].sort(() => Math.random() - 0.5);

  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  shuffledColors.forEach((color, index) => {
    gradient.addColorStop(index / (shuffledColors.length - 1), color);
  });

  return gradient;
}

function getPinkWhiteGradient(ctx, width) {
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, "#FFC0CB"); // Màu hồng nhạt
  gradient.addColorStop(0.5, "#FFB6C1"); // Màu hồng nhạt hơn
  gradient.addColorStop(1, "#FFFFFF"); // Màu trắng
  return gradient;
}

function getBlueBlackGradient(ctx, width) {
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, "#000051"); // Màu xanh nhạt
  gradient.addColorStop(0.5, "#000051"); // Màu xanh nhạt hơn
  gradient.addColorStop(1, "#000000"); // Màu trắng
  return gradient;
}

function getDarkGradient(ctx, width) {
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, "#000000"); // Màu đen
  gradient.addColorStop(1, "#434343"); // Màu xám đậm
  return gradient;
}

// Export tất cả các hàm ở cuối file
export {
  getRandomColor,
  getRandomGradient,
  getRandomGradient2,
  drawAnimatedBackground,
  drawGradientGreenBackground,
  drawGradientGreenNextground,
  drawDynamicGradientBackground,
  getRandomBrightColor,
  getRandomRainbowColor,
  getRandomRainbowGradient,
  getPinkWhiteGradient,
  getBlueBlackGradient,
  getDarkGradient,
};
