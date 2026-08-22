import { readWebConfig, writeWebConfig } from "../../utils/io-json.js";
import { getGroupInfoData, getDataAllGroup } from "../info-service/group-info.js";
import { MessageType } from "zlbotdqt";
import path from "path";
import fs from "fs";
import schedule from "node-schedule";
import chalk from "chalk";
import { checkUrlStatus } from "../../utils/util.js";
import { getBotInfo } from "../../utils/env.js";
const botInfo = getBotInfo();
const RESOURCE_BASE_PATH = path.join(process.cwd(), "assets", "web-config");
const IMAGE_PR_PATH = path.join(RESOURCE_BASE_PATH, "image-pr");
const VIDEO_PR_PATH = path.join(RESOURCE_BASE_PATH, "video-pr");
const CAPTION_CARD = "Danh Thiếp Liên Hệ";
const sentPRs = new Map();
function calculateTimeLive(currentTime, prObjects) {
  const sortedPRs = prObjects
    .flatMap((obj) => obj.thoiGianGui.map((time) => ({ time, object: obj })))
    .sort((a, b) => {
      const timeA = new Date(currentTime.toDateString() + " " + a.time);
      const timeB = new Date(currentTime.toDateString() + " " + b.time);
      return timeA - timeB;
    });

  const currentIndex = sortedPRs.findIndex(
    (pr) =>
      pr.time ===
      `${currentTime.getHours().toString().padStart(2, "0")}:${currentTime.getMinutes().toString().padStart(2, "0")}`
  );

  if (currentIndex === -1) return 0;

  const nextPRIndex = (currentIndex + 1) % sortedPRs.length;
  const nextPRTime = new Date(currentTime.toDateString() + " " + sortedPRs[nextPRIndex].time);

  if (nextPRIndex <= currentIndex) {
    nextPRTime.setDate(nextPRTime.getDate() + 1);
  }

  return nextPRTime.getTime() - currentTime.getTime();
}

function parsePeriodicTime(periodicTime) {
  const match = periodicTime.match(/^(\d+)(s|min|h|d|m|y)$/);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return value * 1000;
    case 'min': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'm': return value * 30 * 24 * 60 * 60 * 1000;
    case 'y': return value * 365 * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

async function checkAndFixAttachments(api, prObject, idZaloGroup) {
  const { hinhAnh, video, link } = prObject;
  const updatedLinks = { ...link };
  for (const fileName in updatedLinks) {
    if (!hinhAnh.includes(fileName) && !video.includes(fileName)) {
      delete updatedLinks[fileName];
    }
  }
  for (const imageName of hinhAnh) {
    const imagePath = path.join(IMAGE_PR_PATH, imageName);
    if (!fs.existsSync(imagePath)) {
      continue;
    }
    let imageUrl = updatedLinks[imageName];
    if (imageUrl) {
      const response = await checkUrlStatus(imageUrl);
      if (!response) {
        imageUrl = null;
      }
    }
    if (!imageUrl) {
      try {
        const uploadResult = await api.uploadAttachment([imagePath], idZaloGroup, MessageType.GroupMessage);
        if (uploadResult && uploadResult[0]) {
          updatedLinks[imageName] = uploadResult[0].fileUrl || uploadResult[0].normalUrl;
        }
      } catch (error) {
        console.error(`Lỗi khi upload ảnh ${imageName}:`, error);
      }
    }
  }

  for (const videoName of video) {
    const videoPath = path.join(VIDEO_PR_PATH, videoName);
    if (!fs.existsSync(videoPath)) {
      continue;
    }
    let videoUrl = updatedLinks[videoName];
    if (videoUrl) {
      const response = await checkUrlStatus(videoUrl);
      if (!response) {
        videoUrl = null;
      }
    }
    if (!videoUrl) {
      try {
        const uploadResult = await api.uploadAttachment([videoPath], idZaloGroup, MessageType.GroupMessage);
        if (uploadResult && uploadResult[0]) {
          updatedLinks[videoName] = uploadResult[0].fileUrl || uploadResult[0].normalUrl;
        }
      } catch (error) {
        console.error(`Lỗi khi upload video ${videoName}:`, error);
      }
    }
  }

  return updatedLinks;
}

async function sendPRMessage(api, config, prObject, ttl, groupId = null) {
  const { idZalo, isContentActive, isImageActive, isVideoActive, isCardActive } = prObject;
  const selectedFriends = config.selectedFriends;
  let selectedGroups = groupId ? { [groupId]: config.selectedGroups[groupId] } : config.selectedGroups;

  if (selectedGroups["-1"]) {
    try {
      const groups = await getDataAllGroup(api);
      selectedGroups = {};
      for (const group of groups) {
        if (!selectedGroups[group.groupId]) {
          selectedGroups[group.groupId] = true;
        }
      }
      delete selectedGroups["-1"];
    } catch (error) {
      console.error(`Lỗi khi lấy danh sách tất cả nhóm:`, error);
      return;
    }
  }

  try {
    const threadIdForAttachments = groupId || Object.keys(selectedGroups)[0] || Object.keys(selectedFriends)[0] || null;
    const defaultLinks = threadIdForAttachments ? await checkAndFixAttachments(api, prObject, threadIdForAttachments) : prObject.link;
    let hasLinksChanged = JSON.stringify(prObject.link) !== JSON.stringify(defaultLinks);

    if (hasLinksChanged) {
      prObject.link = defaultLinks;
      const prIndex = config.prObjects.findIndex(pr => pr.ten === prObject.ten);
      if (prIndex !== -1) {
        config.prObjects[prIndex] = prObject;
        await writeWebConfig(config);
      }
    }

    for (const groupId in selectedGroups) {
      if (selectedGroups[groupId]) {
        const customGroupContent = prObject.customContent?.[groupId];
        const tempPrObject = {
          ...prObject,
          noiDung: customGroupContent?.noiDung || prObject.noiDung,
          hinhAnh: customGroupContent?.hinhAnh || prObject.hinhAnh,
          video: customGroupContent?.video || prObject.video,
          link: defaultLinks
        };

        if (customGroupContent) {
          const customLinks = await checkAndFixAttachments(api, tempPrObject, groupId);
          if (JSON.stringify(tempPrObject.link) !== JSON.stringify(customLinks)) {
            tempPrObject.link = customLinks;
            const prIndex = config.prObjects.findIndex(pr => pr.ten === prObject.ten);
            if (prIndex !== -1) {
              config.prObjects[prIndex].customContent[groupId] = {
                ...customGroupContent,
                link: customLinks
              };
              await writeWebConfig(config);
            }
          }
        }

        try {
          if (isContentActive && tempPrObject.noiDung && (!isVideoActive || tempPrObject.video.length === 0)) {
            if (isImageActive && tempPrObject.hinhAnh.length === 1) {
              const link = tempPrObject.link[tempPrObject.hinhAnh[0]];
              if (link) {
                await api.sendImage(
                  link,
                  {
                    type: MessageType.GroupMessage,
                    threadId: groupId,
                  },
                  tempPrObject.noiDung,
                  ttl
                );
              } else {
                console.error(`Không tìm thấy link cho ảnh ${tempPrObject.hinhAnh[0]}`);
                await api.sendMessage(
                  {
                    msg: tempPrObject.noiDung,
                    ttl: ttl,
                  },
                  groupId,
                  MessageType.GroupMessage
                );
              }
            } else {
              await api.sendMessage(
                {
                  msg: tempPrObject.noiDung,
                  ttl: ttl,
                },
                groupId,
                MessageType.GroupMessage
              );
            }
          }

          if (isVideoActive && tempPrObject.video.length > 0) {
            for (const videoName of tempPrObject.video) {
              const videoUrl = tempPrObject.link[videoName];
              if (videoUrl) {
                try {
                  await api.sendVideo({
                    videoUrl,
                    threadId: groupId,
                    threadType: MessageType.GroupMessage,
                    message: {
                      text: isContentActive ? tempPrObject.noiDung : "",
                    },
                    ttl: ttl,
                  });
                } catch (error) {
                  console.error(`Lỗi khi gửi video ${videoName} cho nhóm ${groupId}:`, error);
                }
              }
            }
          }

          if (isImageActive && tempPrObject.hinhAnh.length > 0 && (tempPrObject.hinhAnh.length > 1 || (isVideoActive && tempPrObject.video.length > 0))) {
            const imagePaths = tempPrObject.hinhAnh
              .map(imageName => path.join(IMAGE_PR_PATH, imageName))
              .filter(imagePath => fs.existsSync(imagePath));
            if (imagePaths.length > 0) {
              await api.zSendLocalImages(
                imagePaths,
                groupId,
                MessageType.GroupMessage,
                800,
                600,
                { text: "" },
                ttl
              );
            } else {
              console.error(`Không tìm thấy file ảnh nào trong danh sách ${tempPrObject.hinhAnh.join(", ")}`);
            }
          }

          if (isCardActive && idZalo !== "-1") {
            try {
              await api.sendBusinessCard(null, idZalo, CAPTION_CARD, MessageType.GroupMessage, groupId, ttl);
            } catch (error) {
              console.error(`Lỗi khi gửi business card cho nhóm ${groupId}:`, error);
            }
          }
        } catch (error) {
          console.error(`Lỗi khi gửi PR cho nhóm ${groupId}:`, error);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const defaultPrObject = {
      ...prObject,
      link: defaultLinks
    };

    for (const friendId in selectedFriends) {
      if (selectedFriends[friendId]) {
        try {
          if (isContentActive && defaultPrObject.noiDung && (!isVideoActive || defaultPrObject.video.length === 0)) {
            if (isImageActive && defaultPrObject.hinhAnh.length === 1) {
              const link = defaultPrObject.link[defaultPrObject.hinhAnh[0]];
              if (link) {
                await api.sendImage(
                  link,
                  {
                    type: MessageType.DirectMessage,
                    threadId: friendId,
                  },
                  defaultPrObject.noiDung,
                  ttl
                );
              } else {
                console.error(`Không tìm thấy link cho ảnh ${defaultPrObject.hinhAnh[0]}`);
                await api.sendMessage(
                  {
                    msg: defaultPrObject.noiDung,
                    ttl: ttl,
                  },
                  friendId,
                  MessageType.DirectMessage
                );
              }
            } else {
              await api.sendMessage(
                {
                  msg: defaultPrObject.noiDung,
                  ttl: ttl,
                },
                friendId,
                MessageType.DirectMessage
              );
            }
          }
          if (isVideoActive && defaultPrObject.video.length > 0) {
            for (const videoName of defaultPrObject.video) {
              const videoUrl = defaultPrObject.link[videoName];
              if (videoUrl) {
                try {
                  await api.sendVideo({
                    videoUrl,
                    threadId: friendId,
                    threadType: MessageType.DirectMessage,
                    message: {
                      text: isContentActive ? defaultPrObject.noiDung : "",
                    },
                    ttl: ttl,
                  });
                } catch (error) {
                  console.error(`Lỗi khi gửi video ${videoName} cho bạn ${friendId}:`, error);
                }
              }
            }
          }

          if (isImageActive && defaultPrObject.hinhAnh.length > 0 && (defaultPrObject.hinhAnh.length > 1 || (isVideoActive && defaultPrObject.video.length > 0))) {
            const imagePaths = defaultPrObject.hinhAnh
              .map(imageName => path.join(IMAGE_PR_PATH, imageName))
              .filter(imagePath => fs.existsSync(imagePath));
            if (imagePaths.length > 0) {
              await api.zSendLocalImages(
                imagePaths,
                friendId,
                MessageType.DirectMessage,
                800,
                600,
                { text: "" },
                ttl
              );
            } else {
              console.error(`Không tìm thấy file ảnh nào trong danh sách ${defaultPrObject.hinhAnh.join(", ")}`);
            }
          }

          if (isCardActive && idZalo !== "-1") {
            try {
              await api.sendBusinessCard(null, idZalo, CAPTION_CARD, MessageType.DirectMessage, friendId, ttl);
            } catch (error) {
              console.error(`Lỗi khi gửi business card cho bạn ${friendId}:`, error);
            }
          }
        } catch (error) {
          console.error(`Lỗi khi gửi PR cho bạn ${friendId}:`, error);
        }
      }
    }

    console.log(`Đã gửi PR thành công cho ${prObject.ten}`);
  } catch (error) {
    console.error(`Lỗi khi gửi PR cho ${prObject.ten}:`, error);
  }
}

async function schedulePR(api) {
  schedule.scheduleJob("0 * * * * *", async function () {
    const config = await readWebConfig();
    const currentTime = new Date();
    const currentHourMinute = `${currentTime.getHours().toString().padStart(2, "0")}:${currentTime
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    const ttl = 3600000;

    for (const prObject of config.prObjects) {
      const prKey = `${prObject.ten}_${currentHourMinute}`;
      if (sentPRs.has(prKey) && Date.now() - sentPRs.get(prKey) < 60000) {
        console.log(`Bỏ qua PR ${prObject.ten} tại ${currentHourMinute} vì đã gửi`);
        continue;
      }

      if (prObject.thoiGianGui.includes(currentHourMinute)) {
        await sendPRMessage(api, config, prObject, ttl);
        sentPRs.set(prKey, Date.now());
      }

      for (const groupId in config.selectedGroups) {
        if (config.selectedGroups[groupId] && prObject.customContent[groupId]?.periodicTime) {
          const periodicTime = prObject.customContent[groupId].periodicTime;
          const intervalMs = parsePeriodicTime(periodicTime);
          if (intervalMs > 0) {
            const lastSent = prObject.customContent[groupId].lastSent || 0;
            const now = Date.now();
            if (now - lastSent >= intervalMs) {
              await sendPRMessage(api, config, prObject, ttl, groupId);
              prObject.customContent[groupId].lastSent = now;
              await writeWebConfig(config);
            }
          }
        }
      }
    }

    const now = Date.now();
    for (const [key, timestamp] of sentPRs) {
      if (now - timestamp > 60000) {
        sentPRs.delete(key);
      }
    }
  });
}

export async function initPRService(api) {
  let config = await readWebConfig();
  if (!config || Object.keys(config).length === 0 || Array.isArray(config)) {
    config = {
      prObjects: [
        {
          ten: "",
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
        }
      ],
      selectedGroups: {},
      selectedFriends: {}
    };
    await writeWebConfig(config);
    console.log(chalk.yellow("Đã khởi tạo webConfig.json với cấu hình mặc định"));
  } else {
    if (!config.prObjects || !Array.isArray(config.prObjects)) {
      config.prObjects = [
        {
          ten: "",
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
        }
      ];
    } else {
      config.prObjects = config.prObjects.map(pr => ({
        ten: pr.ten || "",
        idZalo: pr.idZalo || "-1",
        noiDung: pr.noiDung || "",
        hinhAnh: Array.isArray(pr.hinhAnh) ? pr.hinhAnh : [],
        video: Array.isArray(pr.video) ? pr.video : [],
        link: pr.link && typeof pr.link === "object" ? pr.link : {},
        thoiGianGui: Array.isArray(pr.thoiGianGui) ? pr.thoiGianGui : [],
        customContent: pr.customContent && typeof pr.customContent === "object" ? pr.customContent : {},
        isContentActive: typeof pr.isContentActive === "boolean" ? pr.isContentActive : true,
        isImageActive: typeof pr.isImageActive === "boolean" ? pr.isImageActive : true,
        isVideoActive: typeof pr.isVideoActive === "boolean" ? pr.isVideoActive : true,
        isCardActive: typeof pr.isCardActive === "boolean" ? pr.isCardActive : true
      }));
    }
    config.selectedGroups = config.selectedGroups && typeof config.selectedGroups === "object" ? config.selectedGroups : {};
    config.selectedFriends = config.selectedFriends && typeof config.selectedFriends === "object" ? config.selectedFriends : {};
    await writeWebConfig(config);
    console.log(chalk.yellow("Đã kiểm tra và hoàn thiện cấu hình webConfig.json"));
  }
  await schedulePR(api);
  console.log(chalk.yellow("Dịch vụ PR đã khởi tạo thành công"));
}