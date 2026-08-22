import { createCanvas, loadImage } from "canvas";
import fs from "fs/promises";
import path from "path";
import { loadImageBuffer } from "../util.js";

// Hàm vẽ thumbnail mặc định
function drawDefaultThumbnail(ctx, x, y, size) {
  ctx.fillStyle = "#fff3cd";
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 - 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#dc3545";
  ctx.lineWidth = 4;
  const padding = size * 0.2;
  ctx.beginPath();
  ctx.moveTo(x + padding, y + padding);
  ctx.lineTo(x + size - padding, y + size - padding);
  ctx.moveTo(x + size - padding, y + padding);
  ctx.lineTo(x + padding, y + size - padding);
  ctx.stroke();
}

export async function createSearchResultImage(data) {
  // Giới hạn tối đa 30 bài hát
  const limitedData = data.slice(0, 30);
  console.log("Số bài hát đầu vào (sau giới hạn):", limitedData.length);

  // Tạo canvas tạm để tính toán độ dài text
  const tempCanvas = createCanvas(1, 1);
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.font = "bold 24px BeVietnamPro";

  // Tìm độ dài thực tế lớn nhất của các tiêu đề
  const maxTitleWidth = limitedData.reduce((maxWidth, song) => {
    const title = song.title.length > 36 ? song.title.slice(0, 36) + "..." : song.title;
    const titleWidth = tempCtx.measureText(title).width;
    return Math.min(titleWidth, 300); // Giới hạn maxTitleWidth để tránh cột quá rộng
  }, 0);

  // Tính toán width cho mỗi cột
  const thumbnailSize = 120;
  const padding = 20;
  const numberWidth = 50; // Độ rộng phần số thứ tự
  const separatorWidth = 30; // Độ rộng thanh ngăn cách + padding
  const extraPadding = padding * 4; // Padding bổ sung
  const columnWidth = numberWidth + thumbnailSize + separatorWidth + maxTitleWidth + extraPadding;

  // Tính số cột dựa trên số bài hát
  const maxRows = 10; // Mỗi cột tối đa 10 bài
  const numColumns = Math.min(Math.ceil(limitedData.length / maxRows), 3); // Tối đa 3 cột
  const columnSpacing = 40; // Khoảng cách giữa các cột
  const finalWidth = columnWidth * numColumns + columnSpacing * (numColumns - 1) + padding * 2; // Bỏ giới hạn 1600px

  // Log kích thước để debug
//   console.log("Thông số canvas:");
//   console.log(`- maxTitleWidth: ${maxTitleWidth}`);
//   console.log(`- columnWidth: ${columnWidth}`);
//   console.log(`- numColumns: ${numColumns}`);
//   console.log(`- finalWidth: ${finalWidth}`);
//   console.log("Số cột sẽ vẽ:", numColumns);

  // Tạo canvas chính
  const canvas = createCanvas(finalWidth, maxRows * 150 + 30);
  const ctx = canvas.getContext("2d");

  try {
    // Tải thumbnail
    const thumbnailPromises = limitedData.map(async (song) => {
      try {
        const processedThumbnail = await loadImageBuffer(song.thumbnailM);
        if (processedThumbnail) {
          return await loadImage(processedThumbnail);
        }
        return null;
      } catch (error) {
        console.error(`Lỗi tải thumbnail cho bài hát ${song.title}:`, error);
        return null;
      }
    });
    const thumbnails = await Promise.all(thumbnailPromises);

    // Vẽ nền gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, maxRows * 150 + 30);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.8)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.9)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, finalWidth, maxRows * 150 + 30);

    // Chia dữ liệu thành các cột
    const columns = [];
    for (let i = 0; i < limitedData.length; i += maxRows) {
      columns.push(limitedData.slice(i, i + maxRows));
    }

    // Hàm vẽ một cột
    const drawColumn = (column, startX, columnIndex) => {
      console.log(`Vẽ cột ${columnIndex + 1} tại startX: ${startX}`);
      let yPos = padding;
      for (let i = 0; i < column.length; i++) {
        const song = column[i];
        const index = columnIndex * maxRows + i + 1; // Số thứ tự

        // Vẽ nền cho mỗi dòng
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.beginPath();
        ctx.roundRect(startX, yPos, columnWidth - padding, 130, 10);
        ctx.fill();

        // Vẽ số thứ tự
        ctx.save();
        ctx.fillStyle = "#4CAF50";
        ctx.beginPath();
        ctx.roundRect(startX, yPos, 50, 40, [10, 0, 10, 0]);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 24px BeVietnamPro";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${index}`, startX + 25, yPos + 20);
        ctx.restore();

        // Vẽ thumbnail
        ctx.save();
        const thumbX = startX + padding + 5;
        const thumbY = yPos + 5;
        const radius = thumbnailSize / 2;
        ctx.beginPath();
        ctx.arc(thumbX + radius, thumbY + radius, radius + 3, 0, Math.PI * 2);
        const gradient = ctx.createLinearGradient(thumbX, thumbY, thumbX + thumbnailSize, thumbY + thumbnailSize);
        gradient.addColorStop(0, "rgba(255, 255, 255, 0.5)");
        gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.2)");
        gradient.addColorStop(1, "rgba(255, 255, 255, 0.5)");
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(thumbX + radius, thumbY + radius, radius - 3, 0, Math.PI * 2);
        ctx.clip();
        if (thumbnails[index - 1]) {
          ctx.drawImage(thumbnails[index - 1], thumbX, thumbY, thumbnailSize, thumbnailSize);
        } else {
          drawDefaultThumbnail(ctx, thumbX, thumbY, thumbnailSize);
        }
        ctx.restore();

        // Vẽ thanh ngăn cách
        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fillRect(thumbX + thumbnailSize + padding, thumbY + 15, 3, 90);
        ctx.restore();

        // Vẽ tiêu đề và nghệ sĩ
        const textX = thumbX + thumbnailSize + padding * 2;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const maxTitleWidthCalc = columnWidth - (numberWidth + thumbnailSize + separatorWidth + padding * 2);

        ctx.font = "bold 24px BeVietnamPro";
        ctx.fillStyle = "#ffffff";
        let title = song.title;
        if (ctx.measureText(title).width > maxTitleWidthCalc) {
          while (ctx.measureText(title + "...").width > maxTitleWidthCalc && title.length > 0) {
            title = title.slice(0, -1);
          }
          title += "...";
        }
        ctx.fillText(title, textX, thumbY + 10);

        ctx.font = "20px BeVietnamPro";
        ctx.fillStyle = "#cccccc";
        let artist = song.artistsNames;
        if (ctx.measureText(artist).width > maxTitleWidthCalc) {
          while (ctx.measureText(artist + "...").width > maxTitleWidthCalc && artist.length > 0) {
            artist = artist.slice(0, -1);
          }
          artist += "...";
        }
        ctx.fillText(artist, textX, thumbY + 45);

        // Vẽ thống kê
        const stats = [];
        if (song.rankChart || song.rank) stats.push(`🏆 Top ${song.rankChart || song.rank}`);
        if (song.view) stats.push(`👀 ${song.view.toLocaleString()}`);
        if (song.listen) stats.push(`🎧 ${song.listen.toLocaleString()}`);
        if (song.like) stats.push(`❤️ ${song.like.toLocaleString()}`);
        if (song.comment) stats.push(`💬 ${song.comment.toLocaleString()}`);
        if (song.usage) stats.push(`🔄 ${song.usage.toLocaleString()}`);
        if (song.isOfficial) stats.push(`✅ Official`);
        if (song.isHD) stats.push(`🎥 HD`);
        if (song.publishedTime) stats.push(`🕒 ${song.publishedTime}`);
        if (song.isPremium) stats.push(`💳 [ Premium ]`);

        ctx.font = "18px BeVietnamPro";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(stats.join(" • "), textX, thumbY + 80);

        yPos += 150;
      }
    };

    // Vẽ từng cột
    for (let i = 0; i < columns.length; i++) {
      const startX = padding + i * (columnWidth + columnSpacing);
      drawColumn(columns[i], startX, i);
    }

    // Lưu hình ảnh
    const filePath = path.resolve(`./assets/temp/search_result_${Date.now()}.png`);
    await fs.writeFile(filePath, canvas.toBuffer());
    return filePath;

  } catch (error) {
    console.error("Lỗi khi tạo ảnh kết quả tìm kiếm:", error);
    throw error;
  }
}