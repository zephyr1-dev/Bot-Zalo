import fetch from "node-fetch";
import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";
import { BACKGROUND_RESOURCE_PATH_TEMP, tempDir } from "../../../utils/io-json.js";
import { deleteFile } from "../../../utils/util.js";
import * as cv from "../../../utils/canvas/index.js";
import { getGlobalPrefix } from "../../service.js";
import { removeMention } from "../../../utils/format-util.js";

// Khóa API cho các dịch vụ thời tiết
const TOMORROW_API_KEY = "mdTWQAInBIDB3mHiDtkwuTlwhVB50rqn";
const OPENWEATHER_API_KEY = "e707d13f116e5f7ac80bd21c37883e5e";
const WEATHERAPI_KEY = "fe221e3a25734f0297994922240611";

// Hàm xử lý tên người dùng
export function hanldeNameUser(name) {
  const words = name.split(" ");
  let line1 = "";
  let line2 = "";

  if (name.length <= 16) {
    return [name, ""];
  }

  if (words.length === 1) {
    line1 = name.substring(0, 16);
    line2 = name.substring(16);
  } else {
    for (let i = 0; i < words.length; i++) {
      if ((line1 + " " + words[i]).trim().length <= 16) {
        line1 += (line1 ? " " : "") + words[i];
      } else {
        line2 = words.slice(i).join(" ");
        break;
      }
    }
  }

  return [line1.trim(), line2.trim()];
}

// Hàm xử lý tên dài
export function handleNameLong(name, lengthLine = 16) {
  const words = name.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= lengthLine) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) {
        lines.push(currentLine.trim());
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine.trim());
  }

  if (lines.length === 0) {
    lines.push(name);
  }

  return { lines, totalLines: lines.length };
}

// Để tương thích với các phiên bản cũ hơn, sử dụng tên hàm đúng
export const handleNameUser = hanldeNameUser;

// Hàm vẽ văn bản tự động xuống dòng
function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  const lines = [];
  let currentY = y;

  for (const word of words) {
    const testLine = line + (line ? " " : "") + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      lines.push(line);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY);
    lines.push(line);
  }
  return lines.length;
}

// Hàm xử lý lệnh thời tiết
export async function weatherCommand(api, message) {
  const content = removeMention(message);
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();

  const location = content.replace(`${prefix}thoitiet`, "").trim();

  if (!location) {
    await getOverallWeather(api, message, threadId);
  } else {
    await getLocalWeather(api, message, threadId, location);
  }
}

// Hàm lấy thời tiết tổng quan
async function getOverallWeather(api, message, threadId) {
  try {
    const majorCities = ["Hà Nội", "Hồ Chí Minh", "Đà Nẵng", "Cần Thơ", "Huế"];
    const randomCity = majorCities[Math.floor(Math.random() * majorCities.length)];
    await getLocalWeather(api, message, threadId, randomCity, true);
  } catch (error) {
    console.error("Lỗi khi lấy thông tin thời tiết tổng quan:", error);
    await api.sendMessage(
      { msg: "Đã xảy ra lỗi khi lấy thông tin thời tiết tổng quan. Vui lòng thử lại sau.", quote: message },
      threadId,
      message.type
    );
  }
}

async function getLocalWeather(api, message, threadId, location, isOverall = false) {
  try {
    // Lấy tọa độ địa lý
    const geoResponse = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=vi&format=json`
    );
    const geoData = await geoResponse.json();

    if (!geoData.results || geoData.results.length === 0) {
      await api.sendMessage(
        { msg: "Không tìm thấy thành phố. Vui lòng kiểm tra lại tên thành phố.", quote: message },
        threadId,
        message.type
      );
      return;
    }

    const { latitude, longitude, name, admin1, country } = geoData.results[0];

    // Lấy dữ liệu thời tiết từ các API
    const [tomorrowData, openWeatherData, weatherApiData] = await Promise.all([
      getTomorrowWeather(latitude, longitude),
      getOpenWeatherData(latitude, longitude),
      getWeatherApiData(latitude, longitude)
    ]);

    // Chuẩn bị dữ liệu cho ảnh thời tiết
    const weatherImageData = {
      name,
      admin1,
      country,
      current: openWeatherData,
      hourly: tomorrowData.timelines.hourly.slice(0, 7).map(h => ({
        time: new Date(h.time).getHours(),
        temp: h.values.temperature,
        precipProb: h.values.precipitationProbability,
        icon: getWeatherIcon(h.values.weatherCode)
      })),
      forecast: weatherApiData.forecast.forecastday.map(d => ({
        day: d.day,
        icon: getWeatherIcon(d.day.condition.code)
      }))
    };

    // Tạo và gửi ảnh thời tiết với TTL
    await createWeatherImage(api, message, weatherImageData, `weather_${Date.now()}.png`, threadId);
  } catch (error) {
    console.error("Lỗi khi lấy thông tin thời tiết địa phương:", error);
    await api.sendMessage(
      { msg: `Đã xảy ra lỗi khi xử lý thông tin thời tiết: ${error.message}`, quote: message },
      threadId,
      message.type
    );
  }
}

// Hàm lấy cảnh báo thời tiết
async function getWeatherWarnings() {
  try {
    const response = await fetch(
      `http://api.weatherapi.com/v1/alerts.json?key=${WEATHERAPI_KEY}&q=Vietnam&lang=vi`
    );
    const data = await response.json();

    if (data.alerts && data.alerts.alert.length > 0) {
      return data.alerts.alert.map(alert => `• ${alert.headline}\n  ${alert.desc}`).join('\n');
    }
    return null;
  } catch (error) {
    console.error("Lỗi khi lấy cảnh báo thời tiết:", error);
    return null;
  }
}

// Hàm lấy dữ liệu từ Tomorrow.io
async function getTomorrowWeather(lat, lon) {
  const response = await fetch(
    `https://api.tomorrow.io/v4/weather/forecast?location=${lat},${lon}&apikey=${TOMORROW_API_KEY}`
    );
  return await response.json();
}

// Hàm lấy dữ liệu từ OpenWeatherMap
async function getOpenWeatherData(lat, lon) {
  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=vi`
  );
  return await response.json();
}

// Hàm lấy dữ liệu từ WeatherAPI
async function getWeatherApiData(lat, lon) {
  const response = await fetch(
    `http://api.weatherapi.com/v1/forecast.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}&days=3&aqi=yes&lang=vi`
  );
  return await response.json();
}

// Hàm định dạng thông tin thời tiết (chỉ dùng để tạo ảnh)
function formatWeatherInfo(name, admin1, country, tomorrow, openWeather, weatherApi, isOverall) {
  const daily = tomorrow.timelines.daily[0].values;
  const current = openWeather;
  const forecast = weatherApi.forecast.forecastday;

  const uvIndex = weatherApi.current.uv;
  const uvLevel = getUVLevel(uvIndex);

  const currentWeather = current.weather[0];
  const currentTemp = current.main;
  const currentWind = current.wind;
  const currentRain = current.rain ? current.rain["1h"] || 0 : 0;

  const tomorrowWeatherCode = daily.weatherCodeMax || daily.weatherCodeMin;
  const weatherDesc = getWeatherDescription(tomorrowWeatherCode);

  return `` +
    `📍 ${isOverall ? "Tổng Quan" : name + (admin1 ? `, ${admin1}` : "") + (country ? `, ${country}` : "")}\n` +
    `⏰ Cập nhật: ${new Date(current.dt * 1000).toLocaleString('vi-VN')}\n\n` +
    `🌡️ NHIỆT ĐỘ & ĐỘ ẨM\n` +
    `• Hiện tại: ${currentTemp.temp}°C (Cảm giác: ${currentTemp.feels_like}°C)\n` +
    `• Thấp Nhất: ${currentTemp.temp_min}°C\n` +
    `• Cao Nhất: ${currentTemp.temp_max}°C\n` +
    `• Độ ẩm: ${currentTemp.humidity}%\n\n` +
    `🌤️ ĐIỀU KIỆN THỜI TIẾT\n` +
    `• Hiện tại: ${currentWeather.description}\n` +
    `• Dự báo: ${weatherDesc}\n` +
    `• Mây che phủ: ${current.clouds.all}%\n` +
    `• Tầm nhìn: ${(current.visibility / 1000).toFixed(1)}km\n\n` +
    `🌧️ LƯỢNG MƯA & KHẢ NĂNG MƯA\n` +
    `• Lượng mưa (1h qua): ${currentRain}mm\n` +
    `• ${getPrecipitationForecast(tomorrow.timelines.hourly)}\n`;
}

// Hàm tạo và gửi ảnh thời tiết với TTL
async function createWeatherImage(api, message, weatherData, fileName, threadId) {
  const width = 1080;
  const height = 1920;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Tải ảnh nền
  let bgImage = null;
  const imageDir = path.join(BACKGROUND_RESOURCE_PATH_TEMP, "1080x1920");
  let providers = [];
  try {
    if (fs.existsSync(imageDir)) {
      const files = fs.readdirSync(imageDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
      if (files.length > 0) {
        const file = files[Math.floor(Math.random() * files.length)];
        providers = [path.join(imageDir, file)];
      }
    }
  } catch (e) {
    console.warn("Lỗi khi tải danh sách ảnh nền cục bộ:", e.message);
  }
  if (!providers.length) providers = [`https://picsum.photos/${width}/${height}`];

  try {
    for (const provider of providers) {
      try {
        let imageBuffer = null;
        if (/^https?:\/\//i.test(provider)) {
          const resp = await fetch(provider, { headers: { Accept: "image/*" } });
          if (!resp.ok) throw new Error(`Lỗi HTTP ${resp.status}`);
          imageBuffer = Buffer.from(await resp.arrayBuffer());
        } else {
          imageBuffer = fs.readFileSync(provider);
        }
        bgImage = await loadImage(imageBuffer);
        break;
      } catch (err) {
        console.warn("Lỗi khi tải ảnh nền từ nguồn:", provider, err.message);
      }
    }
  } catch (err) {
    console.warn("Lỗi khi tải ảnh nền:", err.message);
  }

  // Vẽ ảnh nền
  if (bgImage) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.drawImage(bgImage, 0, 0, width, height);
    ctx.restore();
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(0, 0, width, height);
  } else {
    console.warn("Không tải được ảnh nền, sử dụng màu mặc định");
    ctx.fillStyle = "#3B82F6";
    ctx.fillRect(0, 0, width, height);
  }

  // Cài đặt kích thước và kiểu chữ
  const fontSizeTitle = 52;
  const fontSizeTemp = 168;
  const fontSizeDesc = 42;
  const fontSizeLabel = 40;
  const fontSizeData = 36;
  const paddingX = 40;
  const paddingY = 22;
  const cardGap = 8;
  const radius = 12;

  // Thẻ tiêu đề: Địa điểm và ngày giờ
  const titleText = `${weatherData.name}, ${weatherData.admin1 || ""}, ${weatherData.country || "VN"}`;
  const dateText = `Thời tiết - ${new Date().toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
  let cardY = (0.1 / 24) * height;

  ctx.save();
  ctx.font = `bold ${fontSizeTitle}px Tahoma, sans-serif`;
  const titleW = ctx.measureText(titleText).width;
  const dateW = ctx.measureText(dateText).width;
  const titleCardW = Math.min(width * 0.9, Math.max(titleW, dateW) + paddingX * 2);
  const titleCardX = (width - titleCardW) / 2;
  const titleCardH = fontSizeTitle * 2 + fontSizeTitle + 6 + paddingY * 2;

  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.beginPath();
  ctx.moveTo(titleCardX + radius, cardY);
  ctx.lineTo(titleCardX + titleCardW - radius, cardY);
  ctx.quadraticCurveTo(titleCardX + titleCardW, cardY, titleCardX + titleCardW, cardY + radius);
  ctx.lineTo(titleCardX + titleCardW, cardY + titleCardH - radius);
  ctx.quadraticCurveTo(titleCardX + titleCardW, cardY + titleCardH, titleCardX + titleCardW - radius, cardY + titleCardH);
  ctx.lineTo(titleCardX + radius, cardY + titleCardH);
  ctx.quadraticCurveTo(titleCardX, cardY + titleCardH, titleCardX, cardY + titleCardH - radius);
  ctx.lineTo(titleCardX, cardY + radius);
  ctx.quadraticCurveTo(titleCardX, cardY, titleCardX + radius, cardY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${fontSizeTitle}px Tahoma, sans-serif`;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 8;
  const lines = drawWrappedText(ctx, titleText, width / 2, cardY + paddingY, titleCardW - paddingX * 2, fontSizeTitle + 6);
  ctx.fillText(dateText, width / 2, cardY + paddingY + lines * (fontSizeTitle + 6));
  ctx.restore();

  // Thẻ thời tiết hiện tại
  cardY += titleCardH + cardGap;
  const tempText = `${weatherData.current.main.temp}°C`;
  const descText = weatherData.current.weather[0].description || "Nhiều mây";
  const feelsLikeText = `Cảm giác: ${weatherData.current.main.feels_like}°C`;

  ctx.save();
  ctx.font = `bold ${fontSizeTemp}px Tahoma, sans-serif`;
  const tempW = ctx.measureText(tempText).width;
  ctx.font = `bold ${fontSizeDesc}px Tahoma, sans-serif`;
  const descW = ctx.measureText(descText).width;
  ctx.font = `bold ${fontSizeData}px Tahoma, sans-serif`;
  const feelsLikeW = ctx.measureText(feelsLikeText).width;
  const currentCardW = Math.min(width * 0.9, Math.max(tempW, descW, feelsLikeW) + paddingX * 2);
  const currentCardX = (width - currentCardW) / 2;
  const currentCardH = fontSizeTemp + fontSizeDesc + fontSizeData + paddingY * 3 + 16;

  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.beginPath();
  ctx.moveTo(currentCardX + radius, cardY);
  ctx.lineTo(currentCardX + currentCardW - radius, cardY);
  ctx.quadraticCurveTo(currentCardX + currentCardW, cardY, currentCardX + currentCardW, cardY + radius);
  ctx.lineTo(currentCardX + currentCardW, cardY + currentCardH - radius);
  ctx.quadraticCurveTo(currentCardX + currentCardW, cardY + currentCardH, currentCardX + currentCardW - radius, cardY + currentCardH);
  ctx.lineTo(currentCardX + radius, cardY + currentCardH);
  ctx.quadraticCurveTo(currentCardX, cardY + currentCardH, currentCardX, cardY + currentCardH - radius);
  ctx.lineTo(currentCardX, cardY + radius);
  ctx.quadraticCurveTo(currentCardX, cardY, currentCardX + radius, cardY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `bold ${fontSizeTemp}px Tahoma, sans-serif`;
  const tempGradient = cv.getRandomGradient2 ? cv.getRandomGradient2(ctx, width / 2 - tempW / 2, width / 2 + tempW / 2) : ctx.createLinearGradient(width / 2 - tempW / 2, 0, width / 2 + tempW / 2, 0);
  if (!cv.getRandomGradient2) {
    tempGradient.addColorStop(0, "#ff8a80");
    tempGradient.addColorStop(1, "#ff5252");
  }
  ctx.fillStyle = tempGradient;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 10;
  ctx.fillText(tempText, width / 2, cardY + paddingY);
  ctx.font = `bold ${fontSizeDesc}px Tahoma, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(descText, width / 2, cardY + paddingY + fontSizeTemp + 8);
  ctx.font = `bold ${fontSizeData}px Tahoma, sans-serif`;
  ctx.fillText(feelsLikeText, width / 2, cardY + paddingY + fontSizeTemp + fontSizeDesc + 16);
  ctx.restore();

  // Thẻ dự báo theo giờ
  cardY += currentCardH + cardGap;
  const hourlyTitle = "Dự Báo Theo Giờ";
  const hourlyItems = weatherData.hourly.slice(0, 6).map(h => ({
    time: `${h.time}:00`,
    temp: `${h.temp}°C`,
    icon: h.icon || "☁️"
  }));

  ctx.save();
  ctx.font = `bold ${fontSizeLabel}px Tahoma, sans-serif`;
  const hourlyTitleW = ctx.measureText(hourlyTitle).width;
  ctx.font = `bold ${fontSizeData}px Tahoma, sans-serif`;
  const maxItemW = Math.max(...hourlyItems.map(item => ctx.measureText(`${item.time} ${item.temp} ${item.precip}`).width));
  const hourlyCardW = Math.min(width * 0.9, Math.max(hourlyTitleW, maxItemW) + paddingX * 2);
  const hourlyCardX = (width - hourlyCardW) / 2;
  const hourlyCardH = fontSizeLabel + (fontSizeData + 8) * hourlyItems.length + paddingY * 2 + 8;

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.beginPath();
  ctx.moveTo(hourlyCardX + radius, cardY);
  ctx.lineTo(hourlyCardX + hourlyCardW - radius, cardY);
  ctx.quadraticCurveTo(hourlyCardX + hourlyCardW, cardY, hourlyCardX + hourlyCardW, cardY + radius);
  ctx.lineTo(hourlyCardX + hourlyCardW, cardY + hourlyCardH - radius);
  ctx.quadraticCurveTo(hourlyCardX + hourlyCardW, cardY + hourlyCardH, hourlyCardX + hourlyCardW - radius, cardY + hourlyCardH);
  ctx.lineTo(hourlyCardX + radius, cardY + hourlyCardH);
  ctx.quadraticCurveTo(hourlyCardX, cardY + hourlyCardH, hourlyCardX, cardY + hourlyCardH - radius);
  ctx.lineTo(hourlyCardX, cardY + radius);
  ctx.quadraticCurveTo(hourlyCardX, cardY, hourlyCardX + radius, cardY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `bold ${fontSizeLabel}px Tahoma, sans-serif`;
  const titleGradient = cv.getRandomGradient2 ? cv.getRandomGradient2(ctx, hourlyCardX + paddingX, hourlyCardX + hourlyCardW - paddingX) : ctx.createLinearGradient(hourlyCardX + paddingX, 0, hourlyCardX + hourlyCardW - paddingX, 0);
  if (!cv.getRandomGradient2) {
    titleGradient.addColorStop(0, "#ff8a80");
    titleGradient.addColorStop(1, "#ff5252");
  }
  ctx.fillStyle = titleGradient;
  ctx.fillText(hourlyTitle, width / 2, cardY + paddingY);
  ctx.font = `bold ${fontSizeData}px Tahoma, sans-serif`;
  ctx.fillStyle = "#ffffff";
  hourlyItems.forEach((item, index) => {
    const y = cardY + paddingY + fontSizeLabel + 8 + index * (fontSizeData + 8);
    ctx.textAlign = "left";
    ctx.fillText(`${item.time} ${item.icon} ${item.temp}`, hourlyCardX + paddingX, y);
  });
  ctx.restore();

  // Thẻ dự báo 3 ngày
  cardY += hourlyCardH + cardGap;
  const dailyTitle = "Dự Báo 3 Ngày";
  const dailyItems = weatherData.forecast.slice(0, 3).map((d, i) => ({
    day: i === 0 ? "Hôm nay" : i === 1 ? "Chủ Nhật" : "Thứ Hai",
    maxTemp: `${d.day.maxtemp_c}°C`,
    minTemp: `${d.day.mintemp_c}°C`,
    icon: d.icon || "🌧️"
  }));

  ctx.save();
  ctx.font = `bold ${fontSizeLabel}px Tahoma, sans-serif`;
  const dailyTitleW = ctx.measureText(dailyTitle).width;
  ctx.font = `bold ${fontSizeData}px Tahoma, sans-serif`;
  const maxDailyW = Math.max(...dailyItems.map(item => ctx.measureText(`${item.day} ${item.maxTemp}/${item.minTemp}`).width));
  const dailyCardW = Math.min(width * 0.9, Math.max(dailyTitleW, maxDailyW) + paddingX * 2);
  const dailyCardX = (width - dailyCardW) / 2;
  const dailyCardH = fontSizeLabel + (fontSizeData + 8) * dailyItems.length + paddingY * 2 + 8;

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.beginPath();
  ctx.moveTo(dailyCardX + radius, cardY);
  ctx.lineTo(dailyCardX + dailyCardW - radius, cardY);
  ctx.quadraticCurveTo(dailyCardX + dailyCardW, cardY, dailyCardX + dailyCardW, cardY + radius);
  ctx.lineTo(dailyCardX + dailyCardW, cardY + dailyCardH - radius);
  ctx.quadraticCurveTo(dailyCardX + dailyCardW, cardY + dailyCardH, dailyCardX + dailyCardW - radius, cardY + dailyCardH);
  ctx.lineTo(dailyCardX + radius, cardY + dailyCardH);
  ctx.quadraticCurveTo(dailyCardX, cardY + dailyCardH, dailyCardX, cardY + dailyCardH - radius);
  ctx.lineTo(dailyCardX, cardY + radius);
  ctx.quadraticCurveTo(dailyCardX, cardY, dailyCardX + radius, cardY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `bold ${fontSizeLabel}px Tahoma, sans-serif`;
  const dailyGradient = ctx.createLinearGradient(dailyCardX + paddingX, 0, dailyCardX + dailyCardW - paddingX, 0);
  dailyGradient.addColorStop(0, "#ff8a80");
  dailyGradient.addColorStop(1, "#ff5252");
  ctx.fillStyle = dailyGradient;
  ctx.fillText(dailyTitle, width / 2, cardY + paddingY);
  ctx.font = `bold ${fontSizeData}px Tahoma, sans-serif`;
  ctx.fillStyle = "#ffffff";
  dailyItems.forEach((item, index) => {
    const y = cardY + paddingY + fontSizeLabel + 8 + index * (fontSizeData + 8);
    ctx.textAlign = "left";
    ctx.fillText(`${item.day} ${item.icon} ${item.maxTemp}/${item.minTemp}`, dailyCardX + paddingX, y);
  });
  ctx.restore();

  // Thẻ thông tin thời tiết chi tiết
  cardY += dailyCardH + cardGap;
  const detailTitle = "Thông Tin Chi Tiết";
  const detailText = formatWeatherInfo(
    weatherData.name,
    weatherData.admin1,
    weatherData.country,
    { timelines: { daily: [{ values: { weatherCodeMax: weatherData.hourly[0]?.icon || 1102 } }], hourly: weatherData.hourly } },
    weatherData.current,
    { current: { uv: 5 }, forecast: { forecastday: weatherData.forecast } },
    false
  );

  ctx.save();
  ctx.font = `bold ${fontSizeLabel}px Tahoma, sans-serif`;
  const detailTitleW = ctx.measureText(detailTitle).width;
  ctx.font = `bold ${fontSizeData}px Tahoma, sans-serif`;
  const detailLines = detailText.split('\n');
  const maxDetailW = Math.max(...detailLines.map(line => ctx.measureText(line).width));
  const detailCardW = Math.min(width * 0.9, Math.max(detailTitleW, maxDetailW) + paddingX * 2);
  const detailCardX = (width - detailCardW) / 2;
  ctx.font = `bold ${fontSizeData}px Tahoma, sans-serif`;
  const lineHeight = fontSizeData + 8;
  let totalLines = 0;
  detailLines.forEach(line => {
    totalLines += drawWrappedText(ctx, line, detailCardX + paddingX, 0, detailCardW - paddingX * 2, lineHeight);
  });
  const detailCardH = fontSizeLabel + totalLines * lineHeight + paddingY * 2 + 8;

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.beginPath();
  ctx.moveTo(detailCardX + radius, cardY);
  ctx.lineTo(detailCardX + detailCardW - radius, cardY);
  ctx.quadraticCurveTo(detailCardX + detailCardW, cardY, detailCardX + detailCardW, cardY + radius);
  ctx.lineTo(detailCardX + detailCardW, cardY + detailCardH - radius);
  ctx.quadraticCurveTo(detailCardX + detailCardW, cardY + detailCardH, detailCardX + detailCardW - radius, cardY + detailCardH);
  ctx.lineTo(detailCardX + radius, cardY + detailCardH);
  ctx.quadraticCurveTo(detailCardX, cardY + detailCardH, detailCardX, cardY + detailCardH - radius);
  ctx.lineTo(detailCardX, cardY + radius);
  ctx.quadraticCurveTo(detailCardX, cardY, detailCardX + radius, cardY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `bold ${fontSizeLabel}px Tahoma, sans-serif`;
  const detailGradient = ctx.createLinearGradient(detailCardX + paddingX, 0, detailCardX + detailCardW - paddingX, 0);
  detailGradient.addColorStop(0, "#ff8a80");
  detailGradient.addColorStop(1, "#ff5252");
  ctx.fillStyle = detailGradient;
  ctx.fillText(detailTitle, width / 2, cardY + paddingY);
  ctx.font = `bold ${fontSizeData}px Tahoma, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  totalLines = 0;
  detailLines.forEach(line => {
    totalLines += drawWrappedText(
      ctx,
      line,
      detailCardX + paddingX,
      cardY + paddingY + fontSizeLabel + 8 + totalLines * lineHeight,
      detailCardW - paddingX * 2,
      lineHeight
    );
  });
  ctx.restore();

  // Kiểm tra nếu nội dung vượt quá chiều cao canvas
  if (cardY + detailCardH > height) {
    console.warn("Cảnh báo: Nội dung vượt quá chiều cao canvas. Hãy điều chỉnh kích thước hoặc font chữ.");
  }

  // Lưu và gửi ảnh
  const filePath = path.join(tempDir, fileName);
  //console.log("Lưu ảnh vào:", filePath);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);

  return new Promise((resolve, reject) => {
    out.on("finish", async () => {
      //console.log("Lưu ảnh thành công:", filePath);
      try {
        // Kiểm tra file tồn tại
        if (!fs.existsSync(filePath)) {
          throw new Error("Không tìm thấy file ảnh tại: " + filePath);
        }
        const stats = fs.statSync(filePath);
        //console.log("Kích thước file ảnh:", stats.size, "bytes");

        // Kiểm tra quyền đọc file
        try {
          fs.accessSync(filePath, fs.constants.R_OK);
          //console.log("File ảnh có thể đọc được");
        } catch (err) {
          throw new Error("Không thể đọc file ảnh: " + err.message);
        }

        // Tải ảnh lên Zalo API
        //console.log("Tải ảnh lên Zalo API");
        const dataUpload = await api.uploadAttachment([filePath], threadId, message.type);
        //console.log("Kết quả tải lên:", JSON.stringify(dataUpload, null, 2));

        if (!dataUpload || !dataUpload[0] || !(dataUpload[0].fileUrl || dataUpload[0].normalUrl)) {
          throw new Error("Tải ảnh thất bại: Phản hồi tải lên không hợp lệ");
        }

        const imageUrl = dataUpload[0].fileUrl || dataUpload[0].normalUrl;
        //console.log("URL ảnh:", imageUrl);

        // Gửi ảnh với TTL (6000000 ms = 100 phút)
        //console.log("Gửi ảnh qua api.sendImage với TTL 6000000 ms");
        const sendResult = await api.sendImage(imageUrl, message, "", 6000000);
        //console.log("Kết quả gửi qua api.sendImage:", JSON.stringify(sendResult, null, 2));

        // Thử fallback với api.sendMessage nếu api.sendImage thất bại
        if (!sendResult || sendResult.error) {
          console.warn("api.sendImage thất bại, thử api.sendMessage với TTL 6000000 ms");
          const sendMessageResult = await api.sendMessage(
            {
              attachment: fs.createReadStream(filePath),
              quote: message,
              ttl: 6000000
            },
            threadId,
            message.type
          );
          console.log("Kết quả gửi qua api.sendMessage:", JSON.stringify(sendMessageResult, null, 2));
        }

        // Xóa file tạm
        deleteFile(filePath);
        //console.log("Xóa file tạm thành công:", filePath);
        resolve(filePath);
      } catch (err) {
        console.error("Lỗi khi gửi ảnh thời tiết:", err);
        deleteFile(filePath); // Xóa file tạm ngay cả khi lỗi
        reject(new Error(`Gửi ảnh thất bại: ${err.message}`));
      }
    });
    out.on("error", (err) => {
      //onsole.error("Lỗi khi lưu file ảnh:", err);
      reject(new Error(`Lưu file ảnh thất bại: ${err.message}`));
    });
  });
}

// Hàm lấy mức độ UV
function getUVLevel(index) {
  if (index <= 2) return "Thấp";
  if (index <= 5) return "Trung bình";
  if (index <= 7) return "Cao";
  if (index <= 10) return "Rất cao";
  return "Nguy hiểm";
}

// Hàm lấy hướng gió
function getWindDirection(degrees) {
  const directions = ["Bắc", "Đông Bắc", "Đông", "Đông Nam", "Nam", "Tây Nam", "Tây", "Tây Bắc"];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

// Hàm định dạng thời gian
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// Hàm định dạng ngày
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Hàm dự báo lượng mưa
function getPrecipitationForecast(hourlyData) {
  if (!Array.isArray(hourlyData)) return "Không có dữ liệu dự báo mưa";

  const next24Hours = hourlyData.slice(0, 24);
  const rainHour = next24Hours.find(hour => hour && hour.values && hour.values.precipitationProbability > 50);

  if (!rainHour) {
    const lightRainHour = next24Hours.find(hour => hour && hour.values && hour.values.precipitationProbability > 30);
    if (lightRainHour) return "Có thể có mưa nhỏ trong 24 giờ tới";
    return "Dự kiến Không có mưa trong 24 giờ tới";
  }

  const time = new Date(rainHour.time);
  const hour = time.getHours();
  const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayName = dayNames[time.getDay()];

  let timeOfDay;
  if (hour >= 5 && hour < 12) timeOfDay = "sáng";
  else if (hour >= 12 && hour < 18) timeOfDay = "chiều";
  else if (hour >= 18 && hour < 22) timeOfDay = "tối";
  else timeOfDay = "đêm";

  const intensity = getRainIntensity(rainHour.values.rainIntensity || 0);

  return `Dự báo ${intensity} vào ${timeOfDay} ${dayName}`;
}

// Hàm lấy cường độ mưa
function getRainIntensity(intensity) {
  if (intensity === 0) return "Không mưa";
  if (intensity < 2.5) return "mưa nhỏ";
  if (intensity < 7.6) return "mưa vừa";
  if (intensity < 15.2) return "mưa to";
  if (intensity < 30.4) return "mưa rất to";
  return "mưa đặc biệt to";
}

// Hàm lấy mô tả thời tiết
function getWeatherDescription(code) {
  const weatherCodes = {
    1000: "Quang đãng",
    1100: "Có mây nhẹ",
    1101: "Có mây",
    1102: "Nhiều mây",
    1001: "Âm u",
    2000: "Sương mù",
    2100: "Sương mù nhẹ",
    4000: "Mưa nhỏ",
    4001: "Mưa",
    4200: "Mưa nhẹ",
    4201: "Mưa vừa",
    4202: "Mưa to",
    5000: "Tuyết",
    5001: "Tuyết rơi nhẹ",
    5100: "Mưa tuyết nhẹ",
    6000: "Mưa đá",
    6200: "Mưa đá nhẹ",
    6201: "Mưa đá nặng",
    7000: "Sấm sét",
    7101: "Sấm sét mạnh",
    7102: "Giông bão",
    8000: "Một vài cơn mưa rào"
  };
  return weatherCodes[code] || "Không rõ";
}

// Hàm lấy biểu tượng thời tiết
function getWeatherIcon(code) {
  const icons = {
    1000: "☀️",
    1100: "🌤️",
    1101: "⛅",
    1102: "☁️",
    4000: "🌧️",
    4001: "🌦️",
    4200: "🌦️",
    4201: "🌧️",
    4202: "⛈️"
  };
  return icons[code] || "🌍";
}