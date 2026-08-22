import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";
import * as cs from "./index.js";
export const linkBackgroundDefault = "https://i.postimg.cc/tTwFPLV1/avt.jpg";
export const linkBackgroundDefaultZalo = "https://i.postimg.cc/tTwFPLV1/avt.jpg";
async function loadImageWithRetry(url, maxRetries = 3, delay = 500) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const img = await loadImage(url);
      if (attempt > 1) {
        console.log(`✅ Thành công sau ${attempt} lần thử - URL: ${url}`);
      }
      return img;
    } catch (error) {
      lastError = error;
      console.warn(`🔄 Lần thử ${attempt}`);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; 
      }
    }
  }
  
  console.error(`Đã thử ${maxRetries} lần nhưng không thành công`);
  throw lastError;
}

export async function getLinkBackgroundDefault(userInfo) {
  try {
    if (userInfo.birth && userInfo.birth !== linkBackgroundDefaultZalo) {
      try {
        return await loadImageWithRetry(userInfo.birth);
      } catch {
        console.log('🔄 Chuyển sang dùng ảnh nền mặc định');
        return await loadImageWithRetry(linkBackgroundDefault);
      }
    }
    return await loadImageWithRetry(linkBackgroundDefault);
  } catch (error) {
    console.error('❌ Không thể tải cả ảnh nền mặc định:', error);
    return null;
  }
}

async function createImage(userInfo, message, fileName, customColors) {
  const width = 1000;
  const height = 270;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  function createBlurredBorder(ctx, x, y, size, radius, colors, blurWidth = 15) {
    const gradient = ctx.createLinearGradient(
      x - size/2, y - size/2,
      x + size/2, y + size/2
    );
    const mainColor = colors[Math.floor(Math.random() * colors.length)];
    gradient.addColorStop(0, mainColor);
    gradient.addColorStop(1, `${mainColor}00`); 
    
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x - size/2 - blurWidth/2, y - size/2 - blurWidth/2, 
                 size + blurWidth, size + blurWidth, radius + blurWidth/2);
    ctx.fillStyle = gradient;
    ctx.filter = 'blur(5px)';
    ctx.fill();
    ctx.restore();
  }

  const themes = {
    welcome: ["#FFFACD", "#FFF8A3", "#FFF380", "#FFEE58", "#FFEB3B"],
    goodbye: ["#FFFFFF", "#F0F0F0", "#FAFAFF", "#F8FBFF", "#EAEAFF"],
    blocked: ["#ff0000", "#ff1111", "#ff2200", "#ff0022", "#ff3300"],
    admin: ["#FFFACD", "#FFF8A3", "#FFF380", "#FFEE58", "#FFEB3B"],
    restart: customColors || ["#E0E0E0", "#F5F5F5", "#FFFFFF", "#EAEAEA", "#F0F0F0"],
    default: ["#FF1493", "#FF69B4", "#FFD700", "#FFA500", "#FF8C00"]
  };

  let theme;
  if (fileName.includes("welcome")) theme = themes.welcome;
  else if (fileName.includes("goodbye")) theme = themes.goodbye;
  else if (["blocked", "kicked"].some(k => fileName.includes(k))) theme = themes.blocked;
  else if (fileName.includes("setting_change") || fileName.includes("admin_")) theme = themes.admin;
  else if (fileName.includes("restart")) theme = themes.restart;
  else theme = themes.default;

  try {
    const bg = await getLinkBackgroundDefault(userInfo);
    if (bg) {
      ctx.drawImage(bg, 0, 0, width, height);
      
      const overlay = ctx.createLinearGradient(0, 0, 0, height);
      overlay.addColorStop(0, `rgba(30,30,53,0.6)`);
      overlay.addColorStop(1, `rgba(19,27,54,0.6)`);
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, width, height);
    } else {
      throw new Error('Không có ảnh nền');
    }
  } catch (e) {
    console.error("Lỗi background:", e);
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#1E1E35");
    gradient.addColorStop(1, "#131B36");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  const avatarSize = 162;
  const avatarX = 118;
  const avatarY = height / 2 - avatarSize / 2;
  const borderRadius = 50; 
  if (userInfo.avatar && cs.isValidUrl(userInfo.avatar)) {
    try {
      const avatar = await loadImageWithRetry(userInfo.avatar);
      const borderWidth = 12;
      createBlurredBorder(
        ctx, 
        avatarX, 
        height/2, 
        avatarSize, 
        borderRadius,
        theme,
        10
      );

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(avatarX - avatarSize/2, avatarY, avatarSize, avatarSize, borderRadius);
      ctx.clip();
      ctx.drawImage(avatar, avatarX - avatarSize/2, avatarY, avatarSize, avatarSize);
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(avatarX + avatarSize/2 + borderWidth + 30, avatarY + 30);
      ctx.lineTo(avatarX + avatarSize/2 + borderWidth + 30, avatarY + avatarSize - 30);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
    } catch (e) {
      console.error("Lỗi avatar:", e);
      ctx.fillStyle = '#CCCCCC';
      ctx.beginPath();
      ctx.roundRect(avatarX - avatarSize/2, avatarY, avatarSize, avatarSize, borderRadius);
      ctx.fill();
    }
  }

  // Tính toán vị trí căn giữa cho văn bản
  const textX = avatarX + avatarSize/2 + (width - (avatarX + avatarSize/2)) / 2; // Căn giữa theo chiều ngang
  let textY = 80;

  const drawTextLine = (text, fontSize, colorOffset = 0) => {
    ctx.font = `bold ${fontSize}px BeVietnamPro`;
    ctx.textAlign = "center"; // Căn giữa văn bản
    let metrics = ctx.measureText(text);
    
    let finalSize = fontSize;
    const maxTextWidth = width - (avatarX + avatarSize/2 + 40); // Giới hạn chiều rộng văn bản
    while (metrics.width > maxTextWidth && finalSize > 20) {
      finalSize--;
      ctx.font = `bold ${finalSize}px BeVietnamPro`;
      metrics = ctx.measureText(text);
    }
    const gradient = ctx.createLinearGradient(textX - 150, textY - 30, textX + 150, textY);
    theme.slice(colorOffset, colorOffset + 3).forEach((c, i) => {
      gradient.addColorStop(i/2, c);
    });  
    ctx.fillStyle = gradient;
    ctx.fillText(text, textX, textY);
    textY += finalSize + 10;
  };

  drawTextLine(message.title, 36, 0);
  drawTextLine(message.userName, 32, 1);
  drawTextLine(message.subtitle, 32, 2);
  drawTextLine(message.author, 32, 3);

  const filePath = path.resolve(`./assets/temp/${fileName}`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}

export async function createWelcomeImage(userInfo, groupName, groupType, userActionName, isAdmin) {
  const userName = userInfo.name || "";
  const authorText = userActionName === userName ? "Tham Gia Trực Tiếp Hoặc Được Mời" : `Duyệt bởi ${userActionName}`;
  return createImage(
    userInfo,
    {
      title: `${groupName}`,
      userName: `Chào mừng ${isAdmin ? "Đại Ca " : ""}${userName}`,
      subtitle: `Đã Tham Gia ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${authorText}`,
    },
    `welcome_${Date.now()}.png`
  );
}

export async function createGoodbyeImage(userInfo, groupName, groupType, isAdmin) {
  const userName = userInfo.name || "";
  return createImage(
    userInfo,
    {
      title: "Member Left The Group",
      userName: `${isAdmin ? "Đại Ca " : ""}${userName}`,
      subtitle: `Vừa rời khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${groupName}`
    },
    `goodbye_${Date.now()}.png`
  );
}

export async function createKickImage(userInfo, groupName, groupType, gender, userActionName, isAdmin) {
  // const userName = userInfo.name || "";
  // const genderText = gender === 0 ? "Thằng" : gender === 1 ? "Con" : "Thằng";
  // let userNameText = isAdmin ? `Đại Ca ${userName}` : `${genderText} Oắt Con ${userName}`;
  // return createImage(
  //   userInfo,
  //   {
  //     title: `Kicked Out Member`,
  //     userName: `${userNameText}`,
  //     subtitle: `Đã Bị ${userActionName} Sút Khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
  //     author: `${groupName}`,
  //   },
  //   `kicked_${Date.now()}.png`
  // );
}

export async function createBlockImage(userInfo, groupName, groupType, gender, userActionName, isAdmin) {
  // const userName = userInfo.name || "";
  // const genderText = gender === 0 ? "Thằng" : gender === 1 ? "Con" : "Thằng";
  // let userNameText = isAdmin ? `Đại Ca ${userName}` : `${genderText} Oắt Con ${userName}`;
  // return createImage(
  //   userInfo,
  //   {
  //     title: `Blocked Out Member`,
  //     userName: `${userNameText}`,
  //     subtitle: `Đã Bị ${userActionName} Chặn Khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
  //     author: `${groupName}`,
  //   },
  //   `blocked_${Date.now()}.png`
  // );
}

export async function createBlockSpamImage(userInfo, groupName, groupType, gender) {
  // const userName = userInfo.name || "";
  // const genderText = gender === 0 ? "Thằng" : gender === 1 ? "Con" : "Thằng";
  // return createImage(
  //   userInfo,
  //   {
  //     title: `Blocked Out Spam Member`,
  //     userName: `${genderText} Oắt Con ${userName}`,
  //     subtitle: `Do spam đã bị chặn khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
  //     author: `${groupName}`,
  //   },
  //   `blocked_spam_${Date.now()}.png`
  // );
}

export async function createBlockSpamLinkImage(userInfo, groupName, groupType, gender) {
  // const userName = userInfo.name || "";
  // const genderText = gender === 0 ? "Thằng" : gender === 1 ? "Con" : "Thằng";
  // return createImage(
  //   userInfo,
  //   {
  //     title: `Blocked Out Spam Link Member`,
  //     userName: `${genderText} Oắt Con ${userName}`,
  //     subtitle: `Do spam link đã bị chặn khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
  //     author: `${groupName}`,
  //   },
  //   `blocked_spam_link_${Date.now()}.png`
  // );
}

export async function createBlockSpamStkImage(userInfo, groupName, groupType, gender) {
  // const userName = userInfo.name || "";
  // const genderText = gender === 0 ? "Thằng" : gender === 1 ? "Con" : "Thằng";
  // return createImage(
  //   userInfo,
  //   {
  //     title: `Blocked Out Sticker Effect Spammer`,
  //     userName: `${genderText} Oắt Con ${userName}`,
  //     subtitle: `Spam sticker nên bị chặn khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
  //     author: `${groupName}`,
  //   },
  //   `blocked_gay_mem_${Date.now()}.png`
  // );
}

export async function createSettingChangeImage(userInfo, groupName, settingName, newValue, changerName) {
  if (!settingName) {
    return createImage(
      userInfo,
      {
        title: `${groupName}`,
        userName: `Vừa thay đổi cài đặt nhóm`,
        subtitle: `Tiến hành nhận sự kiện`,
        author: `Người thực hiện: ${changerName}`
      },
      `setting_change_${Date.now()}.png`
    );
  }

  const settingNames = {
    blockName: "Chặn thay đổi tên nhóm",
    signAdminMsg: "Làm nổi tin nhắn từ quản trị",
    addMemberOnly: "Chỉ quản trị nhóm thêm thành viên",
    setTopicOnly: "Chỉ quản trị nhóm đặt chủ đề",
    enableMsgHistory: "Lịch sử tin nhắn",
    joinAppr: "Duyệt thành viên",
    lockCreatePost: "Quyền tạo ghi chú, nhắc hẹn",
    lockCreatePoll: "Quyền tạo bình chọn",
    lockSendMsg: "Quyền gửi tin nhắn",
    lockViewMember: "Khóa xem thành viên",
    bannFeature: "Tính năng cấm",
    dirtyMedia: "Phương tiện nhạy cảm",
    banDuration: "Thời gian cấm"
  };
  
  const statusText = newValue === 1 ? "Đã khóa cài đặt" : "Đã cho phép cài đặt";
  const displayName = settingNames[settingName] || settingName;
  
  return createImage(
    userInfo,
    {
      title: `${groupName}`,
      userName: `${displayName}`,
      subtitle: `${statusText}`,
      author: `Người thực hiện: ${changerName}`
    },
    `setting_change_${Date.now()}.png`
  );
}

export async function createAdminAddedImage(userInfo, groupName, changerName) {
  return createImage(
    userInfo,
    {
      title: `Admin Added To Group`,
      userName: `${userInfo.name || userInfo.dName || 'Người dùng'}`,
      subtitle: `Đã được thêm làm quản trị viên`,
      author: `Thực hiện bởi: ${changerName} • ${groupName}`
    },
    `admin_added_${Date.now()}.png`
  );
}

export async function createAdminRemovedImage(userInfo, groupName, changerName) {
  return createImage(
    userInfo,
    {
      title: `Admin Removed From Group`,
      userName: `${userInfo.name || userInfo.dName || 'Người dùng'}`,
      subtitle: `Đã bị gỡ khỏi quản trị viên`,
      author: `Thực hiện bởi: ${changerName} • ${groupName}`
    },
    `admin_removed_${Date.now()}.png`
  );
}