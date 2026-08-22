import { readWebConfig, writeWebConfig } from "../../utils/io-json.js";
import { sendMessageWarningRequest, sendMessageCompleteRequest, sendMessageWarning, sendMessageComplete } from "../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../service.js";
import { removeMention } from "../../utils/format-util.js";
import { checkExstentionFileRemote, downloadFile, deleteFile } from "../../utils/util.js";
import { getGroupInfoData, getDataAllGroup } from "../info-service/group-info.js";
import { MessageType } from "zlbotdqt";
import path from "path";
import fs from "fs";

const RESOURCE_BASE_PATH = path.join(process.cwd(), "assets", "web-config");
const IMAGE_PR_PATH = path.join(RESOURCE_BASE_PATH, "image-pr");
const VIDEO_PR_PATH = path.join(RESOURCE_BASE_PATH, "video-pr");

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function isValidTimeFormat(time) {
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

function isValidPeriodicTimeFormat(input) {
  const regex = /^(\d+)(s|min|h|d|m|y)$/;
return regex.test(input);
}

function getMsgTypeByCliMsgType(cliMsgType) {
  switch (cliMsgType) {
    case 1: return "webchat";
    case 31: return "chat.voice";
    case 32: return "chat.photo";
    case 36: return "chat.sticker";
    case 37: return "chat.doodle";
    case 38: return "chat.recommended";
    case 43: return "chat.location.new";
    case 44: return "chat.video.msg";
    case 46: return "share.file";
    case 49: return "chat.gif";
    default: return "unknown";
  }
}

export async function handlePRCommand(api, message, aliasCommand) {
  const prefix = getGlobalPrefix();
  const content = removeMention(message);
  const args = content.replace(`${prefix}${aliasCommand}`, "").trim().split(/\s+/);
  const threadId = message.threadId;
  const threadType = MessageType ? "GroupMessage" : "DirectMessage";

  if (args[0] === "" || args.length === 0) {
    const object = {
      caption: `Cú pháp không hỗ trợ, dùng lệnh:\n` +
               `${prefix}${aliasCommand} help: Cách sử dụng dịch vụ quảng cáo tự động cơ bản\n` +
               `${prefix}${aliasCommand} help service: Cách sử dụng dịch vụ quảng cáo tự động chi tiết`
    };
    await sendMessageWarningRequest(api, message, object, 30000);
    return;
  }

  const config = await readWebConfig();
  const subCommand = args[0].toLowerCase();

  if (subCommand === "show") {
    const prName = "";
    const prObject = config.prObjects.find(pr => pr.ten === prName);
    if (!prObject) {
      await sendMessageWarningRequest(api, message, { caption: `Không tìm thấy cấu hình PR để hiển thị!` }, 30000);
      return;
    }

    let groupNames = "Chưa có nhóm nào";
    try {
      let groupIds = Object.keys(config.selectedGroups).filter(id => config.selectedGroups[id]);
      const groupNamesArray = [];

      if (groupIds.includes("-1")) {
        const groups = await getDataAllGroup(api);
        groupIds = groups.map(group => group.groupId);
        groupNamesArray.push("Tất cả nhóm");
      } else {
        for (const groupId of groupIds) {
          try {
            const groupInfo = await getGroupInfoData(api, [groupId]);
            groupNamesArray.push(groupInfo.name || `Nhóm ${groupId}`);
          } catch (error) {
            console.error(`Lỗi khi lấy thông tin nhóm ${groupId}:`, error);
            groupNamesArray.push(`Nhóm ${groupId}`);
          }
        }
      }

      groupNames = groupNamesArray.length > 0 ? groupNamesArray.join(", ") : "Chưa có nhóm nào";
    } catch (error) {
      console.error(`Lỗi khi xử lý danh sách nhóm:`, error);
      groupNames = Object.keys(config.selectedGroups)
        .filter(id => config.selectedGroups[id])
        .map(id => id === "-1" ? "Tất cả nhóm" : `Nhóm ${id}`)
        .join(", ") || "Chưa có nhóm nào";
    }

    let response = `Chi tiết quảng cáo:\n`;
    response += `Nội dung: ${prObject.noiDung || "Chưa có nội dung"}\n`;
    if (prObject.hinhAnh.length > 0) {
      response += `Hình ảnh: Có ${prObject.hinhAnh.length} ảnh\n`;
    }
    if (prObject.video.length > 0) {
      response += `Video: Có ${prObject.video.length} video\n`;
    }
    response += `Thời gian gửi cố định: ${prObject.thoiGianGui.length > 0 ? prObject.thoiGianGui.join(", ") : "Chưa cài đặt"}\n`;
    if (threadType === "GroupMessage" && prObject.customContent[threadId]?.periodicTime) {
      response += `Thời gian định kỳ: ${prObject.customContent[threadId].periodicTime}\n`;
    }
    response += `Nhóm đã bật: ${groupNames}`;

    await sendMessageCompleteRequest(api, message, { caption: response }, 30000);
    return;
  }

  if (subCommand === "on" || subCommand === "off") {
    const type = args[1]?.toLowerCase();
    const isOn = subCommand === "on";
    if (!type) {
      if (threadType === "GroupMessage") {
        if (isOn && config.selectedGroups[threadId]) {
          await sendMessageWarningRequest(api, message, { caption: `Nhóm ${threadId} đã được bật quảng cáo!` }, 30000);
          return;
        }
        if (!isOn && !config.selectedGroups[threadId]) {
          await sendMessageWarningRequest(api, message, { caption: `Nhóm ${threadId} chưa được bật quảng cáo!` }, 30000);
          return;
        }
        config.selectedGroups[threadId] = isOn;
        if (!isOn) {
          const prObject = config.prObjects.find(pr => pr.ten === "");
          if (prObject && prObject.customContent[threadId]) {
            delete prObject.customContent[threadId];
          }
        }
        await writeWebConfig(config);
        await sendMessageCompleteRequest(api, message, { caption: `Đã ${isOn ? "bật" : "tắt"} quảng cáo cho nhóm ${threadId}` }, 30000);
      } else {
        if (isOn && config.selectedFriends[threadId]) {
          await sendMessageWarningRequest(api, message, { caption: `Bạn ${threadId} đã được bật quảng cáo!` }, 30000);
          return;
        }
        if (!isOn && !config.selectedFriends[threadId]) {
          await sendMessageWarningRequest(api, message, { caption: `Bạn ${threadId} chưa được bật quảng cáo!` }, 30000);
          return;
        }
        config.selectedFriends[threadId] = isOn;
        await writeWebConfig(config);
        await sendMessageCompleteRequest(api, message, { caption: `Đã ${isOn ? "bật" : "tắt"} quảng cáo cho bạn ${threadId}` }, 30000);
      }
      return;
    }

    if (type === "all") {
      if (subCommand === "off") {
        config.selectedGroups = {};
        config.selectedFriends = {};
        const prObject = config.prObjects.find(pr => pr.ten === "");
        if (prObject) {
          prObject.customContent = {};
        }
        await writeWebConfig(config);
        await sendMessageCompleteRequest(api, message, { caption: `Đã tắt quảng cáo cho tất cả nhóm và bạn bè` }, 30000);
        return;
      } else {
        await sendMessageWarningRequest(api, message, { caption: `Vui lòng sử dụng "${prefix}${aliasCommand} add all" để bật quảng cáo cho tất cả nhóm!` }, 30000);
        return;
      }
    }

    if (type === "time") {
      await sendMessageWarningRequest(api, message, { caption: `Không thể bật/tắt "${type}"!` }, 30000);
      return;
    }

    const validTypes = ["card", "image", "video", "content"];
    if (!validTypes.includes(type)) {
      await sendMessageWarningRequest(api, message, { caption: `Loại nội dung "${type}" không hợp lệ! Chỉ hỗ trợ: card, image, video, content.` }, 30000);
      return;
    }

    const prName = "";
    let prObject = config.prObjects.find(pr => pr.ten === prName);

    if (!prObject) {
      prObject = {
        ten: prName,
        idZalo: "-1",
        noiDung: "",
        hinhAnh: [],
        video: [],
        link: {},
        thoiGianGui: [],
        customContent: {},
        isContentActive: true,
        isImageActive: true,
        isVideoActive: true,
        isCardActive: true
      };
      config.prObjects.push(prObject);
    }

    const typeToFlag = {
      content: "isContentActive",
      image: "isImageActive",
      video: "isVideoActive",
      card: "isCardActive"
    };

    prObject[typeToFlag[type]] = isOn;
    await writeWebConfig(config);
    await sendMessageCompleteRequest(api, message, { caption: `Đã ${isOn ? "bật" : "tắt"} nội dung loại "${type}" cho PR` }, 30000);
    return;
  }

  if (subCommand === "add") {
    if (args.length === 1) {
      if (threadType === "GroupMessage") {
        config.selectedGroups[threadId] = true;
        await writeWebConfig(config);
        await sendMessageCompleteRequest(api, message, { caption: `Đã thêm nhóm ${threadId} vào danh sách PR` }, 30000);
      } else {
        config.selectedFriends[threadId] = true;
        await writeWebConfig(config);
        await sendMessageCompleteRequest(api, message, { caption: `Đã thêm bạn ${threadId} vào danh sách PR` }, 30000);
      }
      return;
    }

    if (args[1]?.toLowerCase() === "all") {
      const periodicTime = args[2];
      if (periodicTime && !isValidPeriodicTimeFormat(periodicTime)) {
        await sendMessageWarningRequest(api, message, { caption: `Thời gian định kỳ "${periodicTime}" không hợp lệ! Vui lòng dùng định dạng <số>s/min/h/d/m/y, ví dụ: 15s, 30min, 1h, 2d, 1m, 1y` }, 30000);
        return;
      }

      const prName = "";
      let prObject = config.prObjects.find(pr => pr.ten === prName);

      if (!prObject) {
        prObject = {
          ten: prName,
          idZalo: "-1",
          noiDung: "",
          hinhAnh: [],
          video: [],
          link: {},
          thoiGianGui: [],
          customContent: {},
          isContentActive: true,
          isImageActive: true,
          isVideoActive: true,
          isCardActive: true
        };
        config.prObjects.push(prObject);
      }

      config.selectedGroups = { "-1": true };

      if (periodicTime) {
        const groups = await getDataAllGroup(api);
        for (const group of groups) {
          prObject.customContent[group.groupId] = prObject.customContent[group.groupId] || {};
          prObject.customContent[group.groupId].periodicTime = periodicTime;
          config.selectedGroups[group.groupId] = true;
        }
      }

      await writeWebConfig(config);
      await sendMessageCompleteRequest(api, message, { caption: `Đã thêm tất cả nhóm vào danh sách PR${periodicTime ? ` với thời gian định kỳ ${periodicTime}` : ''}` }, 30000);
      return;
    }

    if (args.length === 2 && threadType === "GroupMessage") {
      const periodicTime = args[1];
      if (!isValidPeriodicTimeFormat(periodicTime)) {
        await sendMessageWarningRequest(api, message, { caption: `Thời gian định kỳ "${periodicTime}" không hợp lệ! Vui lòng dùng định dạng <số>s/min/h/d/m/y, ví dụ: 15s, 30min, 1h, 2d, 1m, 1y` }, 30000);
        return;
      }

      const prName = "";
      let prObject = config.prObjects.find(pr => pr.ten === prName);

      if (!prObject) {
        prObject = {
          ten: prName,
          idZalo: "-1",
          noiDung: "",
          hinhAnh: [],
          video: [],
          link: {},
          thoiGianGui: [],
          customContent: {},
          isContentActive: true,
          isImageActive: true,
          isVideoActive: true,
          isCardActive: true
        };
        config.prObjects.push(prObject);
      }

      prObject.customContent[threadId] = prObject.customContent[threadId] || {};
      prObject.customContent[threadId].periodicTime = periodicTime;
      config.selectedGroups[threadId] = true;
      await writeWebConfig(config);
      await sendMessageCompleteRequest(api, message, { caption: `Đã thêm thời gian định kỳ ${periodicTime} cho nhóm ${threadId}` }, 30000);
      return;
    }

    await sendMessageWarningRequest(api, message, { caption: `Lệnh không hợp lệ! Dùng "${prefix}${aliasCommand} add" để thêm nhóm/bạn, hoặc "${prefix}${aliasCommand} add [Thời gian][Đơn vị]" (như 15s/min/h/d/m/y) cho nhóm` }, 30000);
    return;
  }

  if (subCommand === "help") {
    const helpType = args[1]?.toLowerCase();
    if (helpType === "service") {
      await sendMessageComplete(api, message, `Chi tiết về quản lý dịch vụ:\n\n` +
        `Cách sử dụng tùy chỉnh nội dung:\n` +
        `${prefix}${aliasCommand} set [Nội dung]: Thay đổi nội dung\n` +
        `${prefix}${aliasCommand} set (quote): Thêm nội dung từ tin nhắn được quote\n` +
        `${prefix}${aliasCommand} set [Tên ảnh/video] (quote): Thêm media như ảnh hoặc video\n` +
        `${prefix}${aliasCommand} set [Tên ảnh/video]|[Link]: Thêm media từ link\n` +
        `${prefix}${aliasCommand} set @Ai đó hoặc [Uid] hoặc me: Tùy chỉnh Business Card\n` +
        `${prefix}${aliasCommand} set [HH:MM,HH:MM,...]: Tùy chỉnh thời gian\n\n` +
        `Cách bật/tắt nội dung:\n` +
        `${prefix}${aliasCommand} on: Bật quảng cáo cho nhóm/bạn\n` +
        `${prefix}${aliasCommand} off: Tắt quảng cáo cho nhóm/bạn\n` +
        `${prefix}${aliasCommand} on [card|image|video|content]: Bật nội dung loại được chỉ định\n` +
        `${prefix}${aliasCommand} off [card|image|video|content]: Tắt nội dung loại được chỉ định\n` +
        `${prefix}${aliasCommand} add all: Bật quảng cáo cho tất cả nhóm\n` +
        `${prefix}${aliasCommand} off all: Tắt quảng cáo cho tất cả nhóm và bạn bè\n\n` +
        `Cách quản lý media, xóa media và cấu hình đã tùy chỉnh:\n` +
        `${prefix}${aliasCommand} add [Thời gian]: Thêm thời gian định kỳ cho nhóm\n` +
        `${prefix}${aliasCommand} remove all: Xóa toàn bộ cấu hình\n` +
        `${prefix}${aliasCommand} remove image: Xóa toàn bộ ảnh\n` +
        `${prefix}${aliasCommand} remove video: Xóa toàn bộ video\n` +
        `${prefix}${aliasCommand} remove time: Xóa cột mốc thời gian\n` +
        `${prefix}${aliasCommand} remove card: Xóa cấu hình Business Card`);
      return;
    } else {
      await sendMessageComplete(api, message, `Cách sử dụng PR Service:\n\n` +
        `${prefix}${aliasCommand} show: Hiển thị chi tiết quảng cáo.\n` +
        `${prefix}${aliasCommand} add: Thêm nhóm/bạn vào danh sách PR.\n` +
        `${prefix}${aliasCommand} add all: Thêm tất cả nhóm vào danh sách PR.\n` +
        `${prefix}${aliasCommand} remove: Xóa nhóm/bạn khỏi danh sách PR.\n` +
        `${prefix}${aliasCommand} off all: Tắt quảng cáo cho tất cả nhóm và bạn bè.\n` +
        `${prefix}${aliasCommand} set: Tùy chỉnh nội dung quảng cáo.\n` +
        `Sử dụng lệnh ${prefix}${aliasCommand} help service để tìm hiểu thêm về dịch vụ!`);
      return;
    }
  }

  if (subCommand === "set") {
    const prName = "";
    let prObject = config.prObjects.find(pr => pr.ten === prName);

    if (!prObject) {
      prObject = {
        ten: prName,
        idZalo: "-1",
        noiDung: "",
        hinhAnh: [],
        video: [],
        link: {},
        thoiGianGui: [],
        customContent: {},
        isContentActive: true,
        isImageActive: true,
        isVideoActive: true,
        isCardActive: true
      };
      config.prObjects.push(prObject);
    }

    const input = args.slice(1).join(" ");
    const quote = message.data?.quote;

    if (quote) {
      try {
        const parseMessage = JSON.parse(quote.attach || "{}");
        const fileUrl = parseMessage?.href;
        const msgType = getMsgTypeByCliMsgType(quote.cliMsgType);

        if (args.length === 1) {
          if (msgType === "chat.recommended" && quote.title) {
            prObject.noiDung = quote.title.trim();
            if (threadType === "GroupMessage") {
              prObject.customContent[threadId] = prObject.customContent[threadId] || {};
              prObject.customContent[threadId].noiDung = quote.title.trim();
            }
            await writeWebConfig(config);
            await sendMessageCompleteRequest(api, message, { caption: `Đã cập nhật nội dung PR từ tiêu đề tin nhắn được quote` }, 30000);
            return;
          } else if (quote.msg && quote.msg.trim()) {
            prObject.noiDung = quote.msg.trim();
            if (threadType === "GroupMessage") {
              prObject.customContent[threadId] = prObject.customContent[threadId] || {};
              prObject.customContent[threadId].noiDung = quote.msg.trim();
            }
            await writeWebConfig(config);
            await sendMessageCompleteRequest(api, message, { caption: `Đã cập nhật nội dung PR từ tin nhắn quote` }, 30000);
            return;
          } else {
            await sendMessageWarningRequest(api, message, { caption: `Tin nhắn được quote không chứa nội dung hợp lệ!` }, 30000);
            return;
          }
        }

        if (msgType === "chat.photo" || msgType === "chat.video.msg") {
          if (!fileUrl) {
            await sendMessageWarningRequest(api, message, { caption: `Tin nhắn được quote không chứa file hợp lệ!` }, 30000);
            return;
          }

          if (args.length < 2) {
            await sendMessageWarningRequest(api, message, { caption: `Vui lòng cung cấp tên file!` }, 30000);
            return;
          }

          const fileName = args[1];
          const setType = msgType === "chat.video.msg" ? "video" : "image";

          const ext = await checkExstentionFileRemote(fileUrl);
          const fullFileName = fileName.includes('.') ? fileName : `${fileName}.${ext}`;
          const dirPath = setType === "video" ? VIDEO_PR_PATH : IMAGE_PR_PATH;
          const savePath = path.join(dirPath, fullFileName);

          if (fs.existsSync(savePath)) {
            await sendMessageWarningRequest(api, message, { caption: `File "${fullFileName}" đã tồn tại!` }, 30000);
            return;
          }

          ensureDirectoryExists(dirPath);
          await downloadFile(fileUrl, savePath);

          if (setType === "video") {
            prObject.video.push(fullFileName);
            if (threadType === "GroupMessage") {
              prObject.customContent[threadId] = prObject.customContent[threadId] || {};
              prObject.customContent[threadId].video = prObject.customContent[threadId].video || [];
              prObject.customContent[threadId].video.push(fullFileName);
            }
          } else {
            prObject.hinhAnh.push(fullFileName);
            if (threadType === "GroupMessage") {
              prObject.customContent[threadId] = prObject.customContent[threadId] || {};
              prObject.customContent[threadId].hinhAnh = prObject.customContent[threadId].hinhAnh || [];
              prObject.customContent[threadId].hinhAnh.push(fullFileName);
            }
          }

          await writeWebConfig(config);
          await sendMessageCompleteRequest(api, message, { caption: `Đã thêm ${setType} "${fullFileName}" vào PR` }, 30000);
          return;
        } else {
          await sendMessageWarningRequest(api, message, { caption: `Tin nhắn được quote không phải ảnh hoặc video!` }, 30000);
          return;
        }
      } catch (error) {
        console.error(`Lỗi khi xử lý quote:`, error);
        await sendMessageWarningRequest(api, message, { caption: `Đã xảy ra lỗi khi xử lý file từ quote. Vui lòng thử lại!` }, 30000);
        return;
      }
    }

    if (input.includes("|")) {
      const [fileName, link] = input.split("|");
      if (!fileName || !link) {
        await sendMessageWarningRequest(api, message, { caption: `Vui lòng cung cấp tên file và link hợp lệ!` }, 30000);
        return;
      }
      try {
        const ext = await checkExstentionFileRemote(link);
        const setType = ["png", "jpg", "jpeg", "gif"].includes(ext.toLowerCase()) ? "image" : ext.toLowerCase() === "mp4" ? "video" : null;

        if (!setType) {
          await sendMessageWarningRequest(api, message, { caption: `Định dạng file "${ext}" không được hỗ trợ!` }, 30000);
          return;
        }

        const fullFileName = fileName.includes('.') ? fileName : `${fileName}.${ext}`;
        const dirPath = setType === "video" ? VIDEO_PR_PATH : IMAGE_PR_PATH;
        const savePath = path.join(dirPath, fullFileName);

        if (fs.existsSync(savePath)) {
          await sendMessageWarningRequest(api, message, { caption: `File "${fullFileName}" đã tồn tại!` }, 30000);
          return;
        }
        ensureDirectoryExists(dirPath);
        await downloadFile(link, savePath);
        if (setType === "video") {
          prObject.video.push(fullFileName);
          if (threadType === "GroupMessage") {
            prObject.customContent[threadId] = prObject.customContent[threadId] || {};
            prObject.customContent[threadId].video = prObject.customContent[threadId].video || [];
            prObject.customContent[threadId].video.push(fullFileName);
          }
        } else {
          prObject.hinhAnh.push(fullFileName);
          if (threadType === "GroupMessage") {
            prObject.customContent[threadId] = prObject.customContent[threadId] || {};
            prObject.customContent[threadId].hinhAnh = prObject.customContent[threadId].hinhAnh || [];
            prObject.customContent[threadId].hinhAnh.push(fullFileName);
          }
        }

        await writeWebConfig(config);
        await sendMessageCompleteRequest(api, message, { caption: `Đã thêm ${setType} "${fullFileName}" vào PR` }, 30000);
        return;
      } catch (error) {
        console.error(`Lỗi khi xử lý link:`, error);
        await sendMessageWarningRequest(api, message, { caption: `Đã xảy ra lỗi khi thêm file từ link. Vui lòng thử lại!` }, 30000);
        return;
      }
    }

    if (input.startsWith("@") || /^\d+$/.test(input) || input === "me") {
      let zaloId;
      if (input === "me") {
        zaloId = message.senderId || message.data?.uidFrom;
      } else if (input.startsWith("@")) {
        if (!input.includes("|")) {
          zaloId = message.data?.mentions?.uid;
          if (!zaloId) {
            await sendMessageWarningRequest(api, message, { caption: `Không tìm thấy UID từ @mention!` }, 30000);
            return;
          }
        } else {
          const [, uid] = input.split("|");
          zaloId = uid;
        }
      } else {
        zaloId = input;
      }

      if (!/^\d+$/.test(zaloId)) {
        await sendMessageWarningRequest(api, message, { caption: `ID Zalo "${zaloId}" không hợp lệ! Phải là số.` }, 30000);
        return;
      }

      prObject.idZalo = zaloId;
      await writeWebConfig(config);
      await sendMessageCompleteRequest(api, message, { caption: `Đã cập nhật ID Zalo ${zaloId} cho PR` }, 30000);
      return;
    }

    if (input.includes(":")) {
      const times = input.split(",").map(t => t.trim());
      const invalidTimes = times.filter(t => !isValidTimeFormat(t));
      if (invalidTimes.length > 0) {
        await sendMessageWarningRequest(api, message, { caption: `Thời gian "${invalidTimes.join(", ")}" không hợp lệ! Vui lòng dùng định dạng HH:MM` }, 30000);
        return;
      }

      const addedTimes = [];
      for (const time of times) {
        if (!prObject.thoiGianGui.includes(time)) {
          prObject.thoiGianGui.push(time);
          addedTimes.push(time);
        }
      }

      if (addedTimes.length === 0) {
        await sendMessageWarningRequest(api, message, { caption: `Tất cả thời gian đã tồn tại trong PR!` }, 30000);
        return;
      }

      await writeWebConfig(config);
      await sendMessageCompleteRequest(api, message, { caption: `Đã thêm thời gian ${addedTimes.join(", ")} cho PR` }, 30000);
      return;
    }

    if (args.length <= 1) {
      await sendMessageWarningRequest(api, message, { caption: `Vui lòng cung cấp nội dung PR hoặc quote tin nhắn!` }, 30000);
      return;
    }

    prObject.noiDung = input;
    if (threadType === "GroupMessage") {
      prObject.customContent[threadId] = prObject.customContent[threadId] || {};
      prObject.customContent[threadId].noiDung = input;
    }
    await writeWebConfig(config);
    await sendMessageCompleteRequest(api, message, { caption: `Đã cập nhật nội dung PR` }, 30000);
    return;
  }

  if (subCommand === "remove") {
    const removeType = args[1]?.toLowerCase();

    if (!removeType) {
      if (threadType === "GroupMessage") {
        if (config.selectedGroups[threadId]) {
          delete config.selectedGroups[threadId];
          const prObject = config.prObjects.find(pr => pr.ten === "");
          if (prObject && prObject.customContent[threadId]) {
            delete prObject.customContent[threadId];
          }
          await writeWebConfig(config);
          await sendMessageCompleteRequest(api, message, { caption: `Đã xóa nhóm ${threadId} khỏi danh sách PR` }, 30000);
        } else {
          await sendMessageWarningRequest(api, message, { caption: `Nhóm ${threadId} không có trong danh sách PR` }, 30000);
        }
      } else {
        if (config.selectedFriends[threadId]) {
          delete config.selectedFriends[threadId];
          await writeWebConfig(config);
          await sendMessageCompleteRequest(api, message, { caption: `Đã xóa bạn ${threadId} khỏi danh sách PR` }, 30000);
        } else {
          await sendMessageWarningRequest(api, message, { caption: `Bạn ${threadId} không có trong danh sách PR` }, 30000);
        }
      }
      return;
    }

    const prName = "";
    let prObject = config.prObjects.find(pr => pr.ten === prName);

    if (!prObject) {
      await sendMessageWarningRequest(api, message, { caption: `Không tìm thấy PR để xóa dữ liệu` }, 30000);
      return;
    }

    if (removeType === "image") {
      if (args.length === 2) {
        if (prObject.hinhAnh.length === 0 && (!prObject.customContent[threadId] || !prObject.customContent[threadId].hinhAnh)) {
          await sendMessageWarningRequest(api, message, { caption: `Không có hình ảnh nào để xóa` }, 30000);
          return;
        }
        for (const fileName of prObject.hinhAnh) {
          const filePath = path.join(IMAGE_PR_PATH, fileName);
          try {
            await deleteFile(filePath);
          } catch (error) {
            console.error(`Lỗi khi xóa file ${fileName}:`, error);
          }
        }
        prObject.hinhAnh = [];
        if (threadType === "GroupMessage" && prObject.customContent[threadId]) {
          prObject.customContent[threadId].hinhAnh = [];
        }
        await writeWebConfig(config);
        await sendMessageCompleteRequest(api, message, { caption: `Đã xóa tất cả hình ảnh khỏi PR` }, 30000);
      } else {
        const fileName = args[2];
        const index = prObject.hinhAnh.indexOf(fileName);
        if (index === -1) {
          await sendMessageWarningRequest(api, message, { caption: `Hình ảnh "${fileName}" không tồn tại trong PR` }, 30000);
          return;
        }
        const filePath = path.join(IMAGE_PR_PATH, fileName);
        try {
          await deleteFile(filePath);
          prObject.hinhAnh.splice(index, 1);
          if (threadType === "GroupMessage" && prObject.customContent[threadId]?.hinhAnh) {
            const groupIndex = prObject.customContent[threadId].hinhAnh.indexOf(fileName);
            if (groupIndex !== -1) {
              prObject.customContent[threadId].hinhAnh.splice(groupIndex, 1);
            }
          }
          await writeWebConfig(config);
          await sendMessageCompleteRequest(api, message, { caption: `Đã xóa hình ảnh "${fileName}" khỏi PR` }, 30000);
        } catch (error) {
          console.error(`Lỗi khi xóa file ${fileName}:`, error);
          await sendMessageWarningRequest(api, message, { caption: `Đã xảy ra lỗi khi xóa hình ảnh "${fileName}"` }, 30000);
        }
      }
    } else if (removeType === "video") {
      if (args.length === 2) {
        if (prObject.video.length === 0 && (!prObject.customContent[threadId] || !prObject.customContent[threadId].video)) {
          await sendMessageWarningRequest(api, message, { caption: `Không có video nào để xóa` }, 30000);
          return;
        }
        for (const fileName of prObject.video) {
          const filePath = path.join(VIDEO_PR_PATH, fileName);
          try {
            await deleteFile(filePath);
          } catch (error) {
            console.error(`Lỗi khi xóa file ${fileName}:`, error);
          }
        }
        prObject.video = [];
        if (threadType === "GroupMessage" && prObject.customContent[threadId]) {
          prObject.customContent[threadId].video = [];
        }
        await writeWebConfig(config);
        await sendMessageCompleteRequest(api, message, { caption: `Đã xóa tất cả video khỏi PR` }, 30000);
      } else {
        const fileName = args[2];
        const index = prObject.video.indexOf(fileName);
        if (index === -1) {
          await sendMessageWarningRequest(api, message, { caption: `Video "${fileName}" không tồn tại trong PR` }, 30000);
          return;
        }
        const filePath = path.join(VIDEO_PR_PATH, fileName);
        try {
          await deleteFile(filePath);
          prObject.video.splice(index, 1);
          if (threadType === "GroupMessage" && prObject.customContent[threadId]?.video) {
            const groupIndex = prObject.customContent[threadId].video.indexOf(fileName);
            if (groupIndex !== -1) {
              prObject.customContent[threadId].video.splice(groupIndex, 1);
            }
          }
          await writeWebConfig(config);
          await sendMessageCompleteRequest(api, message, { caption: `Đã xóa video "${fileName}" khỏi PR` }, 30000);
        } catch (error) {
          console.error(`Lỗi khi xóa file ${fileName}:`, error);
          await sendMessageWarningRequest(api, message, { caption: `Đã xảy ra lỗi khi xóa video "${fileName}"` }, 30000);
        }
      }
    } else if (removeType === "time") {
      if (args.length === 2) {
        if (prObject.thoiGianGui.length === 0) {
          await sendMessageWarningRequest(api, message, { caption: `Không có thời gian nào để xóa` }, 30000);
          return;
        }
        prObject.thoiGianGui = [];
        await writeWebConfig(config);
        await sendMessageCompleteRequest(api, message, { caption: `Đã xóa tất cả thời gian khỏi PR` }, 30000);
      } else {
        const time = args[2];
        if (!isValidTimeFormat(time)) {
          await sendMessageWarningRequest(api, message, { caption: `Thời gian "${time}" không hợp lệ! Vui lòng dùng định dạng HH:MM` }, 30000);
          return;
        }
        const index = prObject.thoiGianGui.indexOf(time);
        if (index === -1) {
          await sendMessageWarningRequest(api, message, { caption: `Thời gian "${time}" không tồn tại trong PR` }, 30000);
          return;
        }
        prObject.thoiGianGui.splice(index, 1);
        await writeWebConfig(config);
        await sendMessageCompleteRequest(api, message, { caption: `Đã xóa thời gian "${time}" khỏi PR` }, 30000);
      }
    } else if (removeType === "card") {
      if (prObject.idZalo === "-1") {
        await sendMessageWarningRequest(api, message, { caption: `Không có ID Zalo để xóa` }, 30000);
        return;
      }
      prObject.idZalo = "-1";
      await writeWebConfig(config);
      await sendMessageCompleteRequest(api, message, { caption: `Đã xóa ID Zalo khỏi PR` }, 30000);
    } else if (removeType === "all") {
      for (const fileName of prObject.hinhAnh) {
        const filePath = path.join(IMAGE_PR_PATH, fileName);
        try {
          await deleteFile(filePath);
        } catch (error) {
          console.error(`Lỗi khi xóa file hình ảnh ${fileName}:`, error);
        }
      }
      for (const fileName of prObject.video) {
        const filePath = path.join(VIDEO_PR_PATH, fileName);
        try {
          await deleteFile(filePath);
        } catch (error) {
          console.error(`Lỗi khi xóa file video ${fileName}:`, error);
        }
      }
      prObject.noiDung = "";
      prObject.hinhAnh = [];
      prObject.video = [];
      prObject.idZalo = "-1";
      prObject.thoiGianGui = [];
      prObject.customContent = {};
      prObject.isContentActive = true;
      prObject.isImageActive = true;
      prObject.isVideoActive = true;
      prObject.isCardActive = true;
      await writeWebConfig(config);
      await sendMessageCompleteRequest(api, message, { caption: `Đã reset toàn bộ dữ liệu PR` }, 30000);
    } else {
      await sendMessageWarningRequest(api, message, { caption: `Loại dữ liệu "${removeType}" không hợp lệ!` }, 30000);
    }
  } else {
    await sendMessageWarningRequest(api, message, { caption: `Lệnh không hợp lệ!` }, 30000);
  }
}