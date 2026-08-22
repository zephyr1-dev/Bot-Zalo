import schedule from "node-schedule";
import fs from "fs";
import { readGroupSettings, writeGroupSettings } from "../../utils/io-json.js";
import { MessageType } from "../../api-zalo/index.js";
import { handleRandomChartZingMp3 } from "../api-crawl/music/zingmp3.js";
import { getRandomVideoFromArray, searchVideoTiktok } from "../api-crawl/tiktok/tiktok-service.js";
import { sendRandomGirlVideo } from "../chat-zalo/chat-special/send-video/send-video.js";

const scheduledTasks = [
  {
    cronExpression: "5 0 * * *",
    task: async (api) => {
      const caption = `> SendTask 00:05 <\nĐêm rồi chúc bạn ngủ ngon!` + `\n\nCung cấp vitamin gái cực sexy cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "sexy");
    },
  },  
  {
    cronExpression: "5 1 * * *",
    task: async (api) => {
      const caption = `> SendTask 01:05 <\nChào một ngày mới đầy năng lượng!` + `\n\nGiải trí với nữ cosplay cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "cosplay");
    },
  },
  {
    cronExpression: "5 2 * * *",
    task: async (api) => {
      const caption = `> SendTask 02:05 <\nChào bạn, một ngày tràn ngập năng lượng tích cực!` + `\n\nCung cấp vitamin gái cực sexy cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "sexy");
    },
  },
  {
    cronExpression: "5 3 * * *",
    task: async (api) => {
      const caption = `> SendTask 03:05 <\nNgày mới chúc các bạn may mắn!\n\n`;
      const timeToLive = 1000 * 60 * 60 * 3;
      await sendTaskMusic(api, caption, timeToLive);
    },
  },
  {
    cronExpression: "5 4 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 04:05 <\nChào buổi sáng\ncùng đón nắng ấm suơng mưa nhé!` + `\n\nGiải trí một chút để bớt căng thẳng thôi nào!!!`;
      const timeToLive = 1000 * 60 * 60 * 3;
      await sendTaskVideo(api, caption, timeToLive, `nhạc chill cảnh đẹp ${Date.now()}`);
    },
  },  
  {
    cronExpression: "5 5 * * *",
    task: async (api) => {
      const caption = `> SendTask 05:05 <\nBình minh rùi dậy đi thuiii!` + `\n\nGiải trí anime cho bớt căng não anh em nhé!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "anime");
    },
  },  
  {
    cronExpression: "5 6 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 06:05 <\nThức dậy cho một ngày mới\nđầy năng lượng thôi nào!` + `\n\nĐón bình minh ngày mới cùng tớ nhé!!!`;
      const timeToLive = 1000 * 60 * 60 * 3;
      await sendTaskVideo(api, caption, timeToLive, `ngắm bình minh chill ${Date.now()}`);
    },
  },
  {
    cronExpression: "5 7 * * *",
    task: async (api) => {
      const caption = `> SendTask 07:05 <\nChào một buổi sáng làm việc đầy năng lượng!` + `\n\nGiải trí anime cho bớt căng não anh em nhé!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "anime");
    },
  },  
  {
    cronExpression: "5 8 * * *",
    task: async (api) => {
      const caption = `> SendTask 08:05 <\nChào một buổi sáng cùng đón nắng ấm suơng mưa nhé!` + `\n\nGiải trí với nữ cosplay cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "cosplay");
    },
  },  
  {
    cronExpression: "5 9 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 09:05 <\nChào bạn\nHãy làm việc vui vẻ!` + `\n\nGiải trí một chút để bớt căng thẳng thôi nào!!!`;
      const timeToLive = 1000 * 60 * 60 * 3;
      await sendTaskVideo(api, caption, timeToLive, `nhạc chill cảnh đẹp ${Date.now()}`);
    },
  },
  {
    cronExpression: "5 10 * * *",
    task: async (api) => {
      const caption = `> SendTask 10:05 <\nChào một buổi trưa đầy năng lượng!` + `\n\nCung cấp vitamin gái cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive);
    },
  },
  {
    cronExpression: "5 11 * * *",
    task: async (api) => {
      const caption = `> SendTask 11:05 <\nChào một buổi trưa đầy năng lượng!` + `\n\nCung cấp vitamin gái cực sexy cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "sexy");
    },
  },
  {
    cronExpression: "5 12 * * *",
    task: async (api) => {
      const caption = `> SendTask 12:05 <\nChào một buổi trưa đầy năng lượng!` + `\n\nGiải trí với nữ cosplay cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "cosplay");
    },
  },
  {
    cronExpression: "5 13 * * *",
    task: async (api) => {
      const caption = `> SendTask 13:05 <\nChào một buổi chiều đầy năng lượng!` + `\n\nGiải trí anime cho bớt căng não anh em nhé!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "anime");
    },
  },
  {
    cronExpression: "5 14 * * *",
    task: async (api) => {
      const caption = `> SendTask 14:05 <\nChào một buổi chiều đầy năng lượng!` + `\n\nCung cấp vitamin gái cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive);
    },
  },
  {
    cronExpression: "5 15 * * *",
    task: async (api) => {
      const caption = `> SendTask 15:05 <\nChào một buổi xế chiều đầy năng lượng!` + `\n\nCung cấp vitamin gái cực sexy cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "sexy");
    },
  },
  {
    cronExpression: "5 16 * * *",
    task: async (api) => {
      const caption = `> SendTask 16:05 <\nChào một buổi xế chiều đầy năng lượng!` + `\n\nGiải trí với nữ cosplay cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "cosplay");
    },
  },
  {
    cronExpression: "5 17 * * *",
    task: async (api) => {
      const caption = `> SendTask 17:05 <\nChúc buổi chiều thật chill và vui vẻ nhé!` + `\n\nĐón hoàng hôn ánh chiều tà thôi nào!!!`;
      const timeToLive = 1000 * 60 * 60 * 2;
      await sendTaskVideo(api, caption, timeToLive, `ngắm hoàng hôn chill ${Date.now()}`);
    },
  },
  {
    cronExpression: "5 18 * * *",
    task: async (api) => {
      const caption = `> SendTask 18:05 <\nChào một chiều đầy năng lượng!` + `\n\nCung cấp vitamin gái cực sexy cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "sexy");
    },
  },  
  {
    cronExpression: "5 19 * * *",
    task: async (api) => {
      const caption = `> SendTask 19:05 <\nChúc các bạn một buổi tối vui vẻ bên gia đình!` + `\n\nThư giãn cuối ngày thôi nào!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskVideo(api, caption, timeToLive, "âm nhạc nhẹ nhàng");
    },
  },
  {
    cronExpression: "5 20 * * *",
    task: async (api) => {
      const caption = `> SendTask 20:05 <\nGiải trí bằng 1 bài nhạc` + `\ncho thời gian tỉnh táo nhất trong ngày!\n\n`;
      const timeToLive = 1000 * 60 * 60 * 2;
      await sendTaskMusic(api, caption, timeToLive);
    },
  },
  {
    cronExpression: "5 21 * * *",
    task: async (api) => {
      const caption = `> SendTask 21:05 <\nChào một buổi tối đầy năng lượng!` + `\n\nCung cấp vitamin gái cực sexy cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "sexy");
    },
  },  
  {
    cronExpression: "5 22 * * *",
    task: async (api) => {
      const caption = `> SendTask 22:05 <\nChúc các bạn ngủ ngon!\n\n`;
      const timeToLive = 1000 * 60 * 60 * 5;
      await sendTaskMusic(api, caption, timeToLive);
    },
  },
  {
    cronExpression: "5 23 * * *",
    task: async (api) => {
      const caption = `> SendTask 23:05 <\nChào một buổi tối, ngủ ngon nhaa moa <3!` + `\n\nGiải trí với nữ cosplay cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "cosplay");
    },
  }  
];

async function sendTaskGirlVideo(api, caption, timeToLive, type = "default") {
  const groupSettings = readGroupSettings();
  for (const threadId of Object.keys(groupSettings)) {
    if (groupSettings[threadId].sendTask) {
      try {
        const message = {
          threadId: threadId,
          type: MessageType.GroupMessage,
        };
        await sendRandomGirlVideo(api, message, caption, type, timeToLive);
      } catch (error) {
        console.error(`Lỗi khi gửi video gái in ${threadId}:`, error);
        if (error.message && error.message.includes("Không tồn tại")) {
          groupSettings[threadId].sendTask = false;
          writeGroupSettings(groupSettings);
        }
      }
    }
  }
}

async function sendTaskVideo(api, caption, timeToLive, query) {
  const chillListVideo = await searchVideoTiktok(query);
  if (chillListVideo) {
    const groupSettings = readGroupSettings();
    let captionFinal = `${caption}`;
    for (const threadId of Object.keys(groupSettings)) {
      if (groupSettings[threadId].sendTask) {
        try {
          const message = {
            threadId: threadId,
            type: MessageType.GroupMessage,
          };
          const videoUrl = await getRandomVideoFromArray(api, message, chillListVideo);
          await api.sendVideo({
            videoUrl: videoUrl,
            threadId: message.threadId,
            threadType: message.type,
            message: {
              text: captionFinal,
            },
            ttl: timeToLive,
          });
        } catch (error) {
          console.error(`Lỗi khi gửi video tiktok in ${threadId}:`, error);
          if (error.message && error.message.includes("Không tồn tại")) {
            groupSettings[threadId].sendTask = false;
            writeGroupSettings(groupSettings);
          }
        }
      }
    }
  }
}

async function sendTaskMusic(api, caption, timeToLive) {
  const groupSettings = readGroupSettings();
  for (const threadId of Object.keys(groupSettings)) {
    if (groupSettings[threadId].sendTask) {
      try {
        const message = {
          threadId: threadId,
          type: MessageType.GroupMessage,
        };
        await handleRandomChartZingMp3(api, message, caption, timeToLive);
      } catch (error) {
        console.error(`Lỗi khi gửi nhạc in ${threadId}:`, error);
        if (error.message && error.message.includes("Không tồn tại")) {
          groupSettings[threadId].sendTask = false;
          writeGroupSettings(groupSettings);
        }
      }
    }
  }
}

export async function initializeScheduler(api) {
  scheduledTasks.forEach((taskConfig) => {
    schedule.scheduleJob(taskConfig.cronExpression, () => {
      taskConfig.task(api).catch((error) => {
        console.error("Lỗi khi thực thi tác vụ định kỳ:", error);
      });
    });
  });
}
