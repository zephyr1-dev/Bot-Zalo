import { createCanvas, loadImage } from "canvas";
import * as cv from "./index.js";
import path from "path";
import fsPromises from "fs/promises";
import { loadImageBuffer } from "../util.js";
import { formatStatistic } from "../format-util.js";

const dataIconPlatform = {
    "zingmp3": {
        "linkIcon": "https://static-zmp3.zmdcdn.me/skins/zmp3-mobile-v5.2/images/favicon192.png",
        "shape": "circle"
    },
    "youtube": {
        "linkIcon": "https://www.youtube.com/s/desktop/c01ea7e3/img/logos/favicon_144x144.png",
        "shape": "rectangle"
    },
    "soundcloud": {
        "linkIcon": "https://a-v2.sndcdn.com/assets/images/sc-icons/ios-a62dfc8fe7.png",
        "shape": "circle"
    },
    "nhaccuatui": {
        "linkIcon": "https://stc-id.nixcdn.com/v11/images/logo_600x600.png",
        "shape": "circle"
    },
    "tiktok": {
        "linkIcon": "https://sf-static.tiktokcdn.com/obj/eden-sg/uhtyvueh7nulogpoguhm/tiktok-icon2.png",
        "shape": "circle"
    },
    "spotify": {
        "linkIcon": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Spotify_icon.svg/1200px-Spotify_icon.svg.png",
        "shape": "circle"
    },
    "telegram": {
        "linkIcon": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Telegram_2019_Logo.svg/1200px-Telegram_2019_Logo.svg.png",
        "shape": "circle"
    }
}

export async function createMusicCard(musicInfo) {
    const width = 660;
    const height = 200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    try {
        if (musicInfo.thumbnailPath) {
            const processedThumbnail = await loadImageBuffer(musicInfo.thumbnailPath);
            if (processedThumbnail) {
                const thumbnail = await loadImage(processedThumbnail);

                ctx.filter = 'blur(10px)';
                ctx.drawImage(thumbnail, -20, -20, width + 40, height + 40);
                ctx.filter = 'none';

                const overlay = ctx.createLinearGradient(0, 0, 0, height);
                overlay.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
                overlay.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
                ctx.fillStyle = overlay;
                ctx.fillRect(0, 0, width, height);

                ctx.save();
                ctx.beginPath();
                const thumbSize = 150;
                const thumbX = 40;
                const thumbY = (height - thumbSize) / 2;
                ctx.arc(thumbX + thumbSize / 2, thumbY + thumbSize / 2, thumbSize / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(thumbnail, thumbX, thumbY, thumbSize, thumbSize);
                ctx.restore();

                ctx.strokeStyle = cv.getRandomGradient(ctx, width);
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(thumbX + thumbSize / 2, thumbY + thumbSize / 2, thumbSize / 2, 0, Math.PI * 2);
                ctx.stroke();

                const source = musicInfo.source?.toLowerCase() || "zingmp3";
                const dataIcon = dataIconPlatform[source];

                if (dataIcon) {
                    try {
                        const iconSize = 45;
                        const iconX = thumbX + thumbSize - iconSize;
                        const iconY = thumbY + thumbSize - iconSize;

                        ctx.save();
                        ctx.beginPath();
                        if (dataIcon.shape === 'rectangle') {
                            const borderRadius = 8;
                            ctx.roundRect(iconX, iconY, iconSize, iconSize, borderRadius);
                        } else {
                            ctx.arc(iconX + iconSize / 2, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
                        }
                        ctx.clip();
                        const icon = await loadImage(dataIcon.linkIcon);
                        ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
                        ctx.restore();
                    } catch (error) {
                        console.error("Lỗi khi vẽ icon nguồn nhạc:", error);
                    }
                }
            } else {
                const gradient = ctx.createLinearGradient(0, 0, width, height);
                gradient.addColorStop(0, "#2C3E50");
                gradient.addColorStop(1, "#3498DB");
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);
            }
        } else {
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, "#2C3E50");
            gradient.addColorStop(1, "#3498DB");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
        }

        const textX = 220;
        let textY = 50;
        let lineHeight = 35;
        let lineHeight2 = 8;
        let lineHeight3 = 25;
        let lineHeight4 = 35;
        let lineHeight5 = 35;
        const maxWidth = width - textX - 80;

        const title = musicInfo.title || "Unknown Title";
        ctx.font = "bold 24px BeVietnamPro";
        const titleWidth = ctx.measureText(title).width;

        if (titleWidth > maxWidth) {
            ctx.font = "bold 20px BeVietnamPro";

            const words = title.split(' ');
            let firstLine = '';
            let secondLine = '';
            let currentLine = '';

            for (const word of words) {
                const testLine = currentLine + (currentLine ? ' ' : '') + word;
                const testWidth = ctx.measureText(testLine).width;

                if (testWidth > maxWidth) {
                    if (!firstLine) {
                        firstLine = currentLine;
                        currentLine = word;
                    } else {
                        secondLine = currentLine + (currentLine ? ' ' : '') + word;
                        break;
                    }
                } else {
                    currentLine = testLine;
                }
            }

            if (!secondLine && currentLine) {
                if (!firstLine) {
                    firstLine = currentLine;
                } else {
                    secondLine = currentLine;
                }
            }

            if (secondLine) {
                const secondLineWidth = ctx.measureText(secondLine).width;
                if (secondLineWidth > maxWidth) {
                    secondLine = secondLine.substring(0, Math.floor(secondLine.length * (maxWidth / secondLineWidth) - 3)) + "...";
                }
            }

            ctx.fillStyle = cv.getRandomGradient(ctx, width);
            textY -= 8;
            ctx.fillText(firstLine, textX, textY);

            if (secondLine) {
                textY += lineHeight - 10;
                ctx.fillText(secondLine, textX, textY);
            }

            textY += lineHeight2;
        } else {
            ctx.font = "bold 24px BeVietnamPro";
            ctx.fillStyle = cv.getRandomGradient(ctx, width);
            ctx.fillText(title, textX, textY);
            lineHeight3 = 35;
            lineHeight4 = 35;
            lineHeight5 = 35;
        }

        textY += lineHeight3;
        ctx.font = "20px BeVietnamPro";
        ctx.fillStyle = cv.getRandomGradient(ctx, width);
        const artist = musicInfo.artists ? "Artist: " + musicInfo.artists : "Artist: Unknown";
        ctx.fillText(artist, textX, textY);

        textY += lineHeight4;
        ctx.fillStyle = cv.getRandomGradient(ctx, width);
        ctx.font = "18px BeVietnamPro";
        ctx.fillText(`From ${musicInfo.source || "ZingMp3"}${musicInfo.rank ? ` - 🏆 Now is Top ${musicInfo.rank} BXH` : ""}`, textX, textY);

        textY += lineHeight5;
        ctx.font = "18px BeVietnamPro";

        const stats = [
            { icon: "🎧", value: formatStatistic(musicInfo.listen) },
            { icon: "👀", value: formatStatistic(musicInfo.viewCount) },
            { icon: "💜", value: formatStatistic(musicInfo.like) },
            { icon: "💬", value: formatStatistic(musicInfo.comment) },
            { icon: "🔗", value: formatStatistic(musicInfo.share) },
            { icon: "📅", value: formatStatistic(musicInfo.publishedTime) }
        ].filter(stat => stat.value !== null);

        if (stats.length > 0) {
            const fixedSpacing = 12;

            const statsWidths = stats.map(stat => {
                const text = `${stat.icon} ${stat.value}`;
                return ctx.measureText(text).width;
            });

            const totalTextWidth = statsWidths.reduce((sum, width) => sum + width, 0);
            const totalSpacingWidth = (stats.length - 1) * fixedSpacing;
            const totalWidth = totalTextWidth + totalSpacingWidth;

            const startX = textX;

            let currentX = startX;
            stats.forEach((stat, index) => {
                ctx.fillText(`${stat.icon} ${stat.value}`, currentX, textY);
                currentX += statsWidths[index] + fixedSpacing;
            });
        }

        if (musicInfo.userAvatar) {
            try {
                const avatar = await loadImage(musicInfo.userAvatar);
                const avatarSize = 60;
                const avatarX = width - avatarSize - 20;
                const avatarY = height - avatarSize - 20;

                ctx.beginPath();
                ctx.fillStyle = cv.getRandomGradient(ctx, width);
                ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
                ctx.fill();

                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
                ctx.restore();
            } catch (error) {
                console.error("Lỗi khi vẽ avatar người dùng:", error);
            }
        }

    } catch (error) {
        console.error("Lỗi khi tạo music card:", error);
        throw error;
    }

    const filePath = path.resolve(`./assets/temp/music_${Date.now()}.png`);
    await fsPromises.writeFile(filePath, canvas.toBuffer());
    return filePath;
}
