import { createCanvas, loadImage } from "canvas";
import fs from "fs/promises";
import path from "path";
import { loadImageBuffer } from "../../../utils/util.js";

// Hàm vẽ thumbnail mặc định
function drawDefaultThumbnail(ctx, x, y, size) {
	// Vẽ nền màu vàng nhạt
	ctx.fillStyle = "#fff3cd";
	ctx.beginPath();
	ctx.arc(x + size/2, y + size/2, size/2 - 3, 0, Math.PI * 2);
	ctx.fill();

	// Vẽ dấu X màu đỏ
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
	// Tạo canvas tạm để tính toán độ dài text
	const tempCanvas = createCanvas(1, 1);
	const tempCtx = tempCanvas.getContext('2d');
	tempCtx.font = "bold 24px BeVietnamPro";

	// Tìm độ dài thực tế lớn nhất của các tiêu đề
	const maxTitleWidth = data.reduce((maxWidth, song) => {
		const title = song.title.length > 36 ? song.title.slice(0, 36) + "..." : song.title;
		const titleWidth = tempCtx.measureText(title).width;
		return titleWidth > maxWidth ? titleWidth : maxWidth;
	}, 0);

	// Tính toán width tổng cần thiết
	const thumbnailSize = 120;
	const padding = 20;
	const numberWidth = 50; // Độ rộng phần số thứ tự
	const separatorWidth = 30; // Độ rộng thanh ngăn cách + padding
	const extraPadding = padding * 4; // Padding bổ sung

	// Tính width tổng: số thứ tự + thumbnail + thanh ngăn + text + padding
	const width = numberWidth + thumbnailSize + separatorWidth + maxTitleWidth + extraPadding;

	// Đảm bảo width nằm trong khoảng hợp lý (600-1200px)
	const finalWidth = Math.max(680, Math.min(width, 1200));
	const height = data.length * 150 + 30;
	
	// Tạo canvas chính với kích thước đã tính
	const canvas = createCanvas(finalWidth, height);
	const ctx = canvas.getContext("2d");

	try {
		const thumbnailPromises = data.map(async (song) => {
			try {
				const processedThumbnail = await loadImageBuffer(song.thumbnailM);
				if (processedThumbnail) {
					return await loadImage(processedThumbnail);
				}
				return null;
			} catch (error) {
				return null;
			}
		});

		const thumbnails = await Promise.all(thumbnailPromises);

		const gradient = ctx.createLinearGradient(0, 0, 0, height);
		gradient.addColorStop(0, "rgba(0, 0, 0, 0.8)");
		gradient.addColorStop(1, "rgba(0, 0, 0, 0.9)");
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, finalWidth, height);

		const thumbnailSize = 120;
		const padding = 20;
		let yPos = padding;

		for (let i = 0; i < data.length; i++) {
			const song = data[i];
			
			ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
			ctx.beginPath();
			ctx.roundRect(padding, yPos, finalWidth - padding * 2, 130, 10);
			ctx.fill();

			ctx.save();
			ctx.fillStyle = "#4CAF50";
			ctx.beginPath();
			ctx.roundRect(padding, yPos, 50, 40, [10, 0, 10, 0]);
			ctx.fill();

			ctx.fillStyle = "#ffffff";
			ctx.font = "bold 24px BeVietnamPro";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(`${i + 1}`, padding + 25, yPos + 20);
			ctx.restore();

			ctx.save();

			ctx.beginPath();
			const thumbX = padding * 2 + 5;
			const thumbY = yPos + 5;
			const radius = thumbnailSize/2;
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

			if (thumbnails[i]) {
				ctx.drawImage(thumbnails[i], thumbX, thumbY, thumbnailSize, thumbnailSize);
			} else {
				drawDefaultThumbnail(ctx, thumbX, thumbY, thumbnailSize);
			}
			
			ctx.restore();

			ctx.save();
			ctx.fillStyle = "rgba(255, 255, 255, 0.2)"; 
			ctx.fillRect(thumbX + thumbnailSize + padding, thumbY + 15, 3, 90);
			ctx.restore();

			ctx.textAlign = "left";
			ctx.textBaseline = "top";

			const textX = thumbX + thumbnailSize + padding * 2;

			ctx.font = "bold 24px BeVietnamPro";
			ctx.fillStyle = "#ffffff";
			
			const maxTitleWidth = finalWidth - textX - padding * 3;
			let title = song.title;
			if (ctx.measureText(title).width > maxTitleWidth) {
				while (ctx.measureText(title + "...").width > maxTitleWidth && title.length > 0) {
					title = title.slice(0, -1);
				}
				title += "...";
			}
			ctx.fillText(title, textX, thumbY + 10);

			ctx.font = "20px BeVietnamPro";
			ctx.fillStyle = "#cccccc";

			let artist = song.artistsNames;
			if (ctx.measureText(artist).width > maxTitleWidth) {
				while (ctx.measureText(artist + "...").width > maxTitleWidth && artist.length > 0) {
					artist = artist.slice(0, -1);
				}
				artist += "...";
			}
			ctx.fillText(artist, textX, thumbY + 45);

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

		const filePath = path.resolve(`./assets/temp/search_result_${Date.now()}.png`);
		await fs.writeFile(filePath, canvas.toBuffer());
		return filePath;

	} catch (error) {
		console.error("Lỗi khi tạo ảnh kết quả tìm kiếm:", error);
		throw error;
	}
}
