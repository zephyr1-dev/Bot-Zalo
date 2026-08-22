import { createCanvas, loadImage } from "canvas";
import path from "path";
import fs from "fs/promises";
import { sendMessageFromSQL, sendMessageFromSQLImage, sendMessageImageNotQuote } from "../../service-debug/chat-zalo/chat-style/chat-style.js";
import { getUserInfoData } from "../../service-debug/info-service/user-info.js";
import { getGlobalPrefix } from "../../service-debug/service.js";
import { removeMention } from "../format-util.js";
import { deleteFile } from "../util.js";
import { threadId } from "worker_threads";

async function createStatusImage(text, userInfo) {
	const width = 900;
	const tempCanvas = createCanvas(width, 1);
	const tempCtx = tempCanvas.getContext("2d");
	tempCtx.font = "bold 48px Arial";

	const paragraphs = text.split("\n");
	let lines = [];

	paragraphs.forEach(paragraph => {
		if (!paragraph.trim()) {
			lines.push("");
			return;
		}

		const words = paragraph.split(" ");
		let currentLine = "";

		for (let i = 0; i < words.length; i++) {
			let word = words[i];
			const maxWidth = width - 100;

			while (word.length > 0) {
				const testLine = currentLine ? currentLine + " " + word : word;
				const lineWidth = tempCtx.measureText(testLine).width;

				if (lineWidth < maxWidth) {
					currentLine = testLine;
					word = "";
				} else if (!currentLine) {
					let partialWord = word;
					while (tempCtx.measureText(partialWord).width >= maxWidth) {
						partialWord = partialWord.slice(0, -1);
					}
					if (partialWord.length > 0) {
						lines.push(partialWord);
						word = word.slice(partialWord.length);
					} else {
						lines.push(word.charAt(0));
						word = word.slice(1);
					}
					currentLine = "";
				} else {
					lines.push(currentLine);
					currentLine = "";
				}
			}
		}

		if (currentLine) {
			lines.push(currentLine);
		}
	});

	const headerHeight = 150;
	const lineHeight = 60;
	const totalTextHeight = lines.length * lineHeight;
	const minContentHeight = 480;

	const contentPadding = 80;
	const contentHeight = Math.max(minContentHeight, totalTextHeight + (contentPadding * 2));
	const height = headerHeight + contentHeight;

	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext("2d");

	if (userInfo.cover) {
		try {
			const cover = await loadImage(userInfo.cover);

			ctx.save();
			ctx.beginPath();
			ctx.rect(0, headerHeight, width, height - headerHeight);
			ctx.clip();

			const scale = Math.max(
				width / cover.width,
				(height - headerHeight) / cover.height
			);
			const coverWidth = cover.width * scale;
			const coverHeight = cover.height * scale;
			const x = (width - coverWidth) / 2;
			const y = headerHeight + ((height - headerHeight) - coverHeight) / 2;

			ctx.drawImage(cover, x, y, coverWidth, coverHeight);

			ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
			ctx.fillRect(0, headerHeight, width, height - headerHeight);
			ctx.restore();
		} catch (error) {
			console.error("Lỗi load cover:", error);
			const contentGradient = ctx.createLinearGradient(0, headerHeight, width, height);
			contentGradient.addColorStop(0, "#E91E63");
			contentGradient.addColorStop(1, "#2196F3");
			ctx.fillStyle = contentGradient;
			ctx.fillRect(0, headerHeight, width, height - headerHeight);
		}
	} else {
		const contentGradient = ctx.createLinearGradient(0, headerHeight, width, height);
		contentGradient.addColorStop(0, "#E91E63");
		contentGradient.addColorStop(1, "#2196F3");
		ctx.fillStyle = contentGradient;
		ctx.fillRect(0, headerHeight, width, height - headerHeight);
	}

	ctx.fillStyle = "#FFFFFF";
	ctx.fillRect(0, 0, width, headerHeight);

	const avatarSize = 100;
	const avatarX = 40;
	const separatorX = avatarX + avatarSize + 30;

	try {
		const avatar = await loadImage(userInfo.avatar);
		const avatarY = (headerHeight - avatarSize) / 2;
		const borderWidth = 5;
		const borderPadding = 5;
		const borderRadius = avatarSize / 2 + borderWidth + borderPadding;

		ctx.beginPath();
		ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, borderRadius, 0, Math.PI * 2);
		ctx.fillStyle = "#2196F3";
		ctx.fill();

		ctx.beginPath();
		ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + borderPadding, 0, Math.PI * 2);
		ctx.fillStyle = "#FFFFFF";
		ctx.fill();

		ctx.save();
		ctx.beginPath();
		ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
		ctx.clip();
		ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
		ctx.restore();

		const separatorHeight = 80;
		const separatorY = (headerHeight - separatorHeight) / 2;

		ctx.beginPath();
		ctx.moveTo(separatorX, separatorY);
		ctx.lineTo(separatorX, separatorY + separatorHeight);
		ctx.lineWidth = 6;
		ctx.strokeStyle = "#E0E0E0";
		ctx.stroke();

	} catch (error) {
		console.error("Lỗi khi load avatar:", error);
	}

	const textX = separatorX + 26;
	const nameY = headerHeight / 2 - 10;
	const timeY = headerHeight / 2 + 30;

	ctx.font = "bold 38px BeVietnamPro";
	ctx.fillStyle = "#000000";
	ctx.textAlign = "left";
	ctx.fillText(userInfo.name, textX, nameY);

	const now = new Date();
	const timeStr = now.toLocaleString("vi-VN");
	ctx.font = "26px Arial";
	ctx.fillStyle = "#666666";
	ctx.fillText(timeStr + " 🌍", textX, timeY);

	ctx.font = "bold 48px Arial";
	ctx.fillStyle = "#FFFFFF";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";

	const contentStartY = headerHeight;
	const contentEndY = height;
	const contentCenterY = (contentStartY + contentEndY) / 2;
	const textStartY = contentCenterY - (totalTextHeight / 2);

	lines.forEach((line, index) => {
		if (line === "") return;
		const lineY = textStartY + (index * lineHeight);
		ctx.fillText(line, width / 2, lineY);
	});

	const filePath = path.resolve(`./assets/temp/status_${Date.now()}.png`);
	await fs.writeFile(filePath, canvas.toBuffer());
	return filePath;
}

export async function handleCommandStatusPost(api, message, aliasCommand) {
	const prefix = getGlobalPrefix();
	const content = message.data.content;
	let stringCommand = content.replace(`${prefix}${aliasCommand}`, "").trim();
	if (!stringCommand) {
		const result = {
			success: false,
			message: `Vui lòng nhập nội dung mà bạn muốn tạo trạng thái!`
		};
		await sendMessageFromSQL(api, message, result, false, 15000);
		return;
	}

	const senderId = message.data.uidFrom;
	const userInfo = await getUserInfoData(api, senderId);
	let imagePath = null;

	try {
		imagePath = await createStatusImage(stringCommand, userInfo);
		await api.sendMessage({
			msg: "",
			attachments: [imagePath]
		}, message.threadId, message.type)

	} catch (error) {
		console.error("Lỗi khi tạo ảnh bài đăng trạng thái:", error);
		const result = {
			success: false,
			message: "Đã xảy ra lỗi khi tạo ảnh trạng thái!"
		};
		await sendMessageFromSQL(api, message, result, false);
	} finally {
		await deleteFile(imagePath);
	}
}

