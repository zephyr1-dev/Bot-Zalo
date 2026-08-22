import { MessageType } from "../../../api-zalo/index.js";
import { getGlobalPrefix } from "../../../service-debug/service.js";
import { removeMention } from "../../../utils/format-util.js";
import { readGroupSettings, writeGroupSettings } from "../../../utils/io-json.js";
import { sendMessageStateQuote } from "../../../service-debug/chat-zalo/chat-style/chat-style.js";

const STICKER_IDS = [
  15437,17854,18099,18609,19364,16245,17855,18100,18610,19365,
  16844,17856,18101,18611,19366,16845,17857,18102,18612,19367,
  23339,23338,23337,23339,23338,23337,23339,23338,23337,23339,  
  16846,17858,18103,18613,19368,16848,17859,18104,18614,19369,
  17197,17860,18105,18615,19370,17200,17861,18106,18616,19371,
  17206,17862,18107,18617,19372,17312,17863,18108,18618,19373,
  23339,23338,23337,23339,23338,23337,23339,23338,23337,23339,  
  17313,17864,18109,18619,19374,17314,17865,18110,18620,19375,
  17315,17866,18111,18621,19376,17316,17867,18112,18622,19377,
  17317,17868,18113,18623,19378,17318,17869,18114,18624,19379,
  17419,17870,18115,18625,19380,17420,17871,18116,18626,19381,
  23339,23338,23337,23339,23338,23337,23339,23338,23337,23339,  
  17421,17872,18117,18627,19382,17422,17873,18118,18628,19383,
  17423,17874,18119,18629,19384,17424,17875,18120,18630,19385,
  23339,23338,23337,23339,23338,23337,23339,23338,23337,23339,
  17425,17876,18121,18631,19386,17426,17877,18122,18632,19387,
  17427,17878,18123,18633,19388,17428,17879,18124,18634,19389,
  17429,17880,18125,18635,19390,17430,17881,18126,18636,19391,
  17431,17882,18127,18637,19392,17432,17883,18128,18638,19393,
  17433,17884,18129,18639,19394,17434,17885,18130,18640,19395,
  17435,17886,18131,18641,19396,17436,17887,18132,18642,19397,
  17437,17888,18133,18643,19398,17438,17889,18134,18644,19399,
  17459,17890,18135,18645,19400,17470,17891,18136,18646,19401,
  23339,23338,23337,23339,23338,23337,23339,23338,23337,23339,  
  17475,17892,18137,18647,19402,17605,17893,18138,18648,19403,
  17606,17894,18139,18649,19404,17607,17895,18140,18650,19405,
  17608,17896,18141,18651,19406,17609,17897,18142,18652,19407,
  17610,17898,18143,18653,19408,17611,17899,18144,18654,19409,
  23339,23338,23337,23339,23338,23337,23339,23338,23337,23339,  
  17612,17900,18145,18655,19410,17613,17901,18146,18656,19411,
  17614,17902,18147,18657,19412,17615,17903,18148,18658,19413,
  17616,17904,18149,18659,19414,17617,17905,18150,18660,19415,
  17618,17906,18151,18661,19416,17619,17907,18152,18662,19417,
  17620,17908,18153,18663,19418,17621,17909,18154,18664,19419,
  17622,17910,18155,18665,19420,17623,17911,18156,18666,19421,
  17624,17912,18157,18667,19422,17827,17913,18158,18668,19423,
  23339,23338,23337,23339,23338,23337,23339,23338,23337,23339,  
  17828,17914,18159,18669,19424,17829,17915,18160,18670,19425,
  17840,17916,18161,18671,19426,17841,17917,18162,18672,19427,
  17842,17918,18163,18673,19428,17843,17919,18164,18674,19429,
  23339,23338,23337,23339,23338,23337,23339,23338,23337,23339,  
  17844,17920,18165,18675,19430,17845,17921,18166,18676,19431,
  17846,17922,18167,18677,19432,17847,17923,18168,18678,19433,
  17848,17924,18169,18679,19434,17849,17925,18170,18680,19435,
  17850,17927,18171,18681,19436,17851,17928,18172,18710,19437,
  17852,17929,18173,18711,19438,17853,17930,18174,18712,19439,
  23339,23338,23337,23339,23338,23337,23339,23338,23337,23339,
];

// Trả về sticker ngẫu nhiên
function getRandomStickerId() {
  return STICKER_IDS[Math.floor(Math.random() * STICKER_IDS.length)];
}

// Quản lý interval riêng cho từng nhóm
const autoStickerIntervals = new Map(); // threadId => intervalId

// Hàm xử lý gửi sticker tự động
export async function handleSendStickerCommand(api, message, groupSettings = readGroupSettings()) {
  const content = removeMention(message);
  const status = content.split(" ")[1]?.toLowerCase();
  const threadId = message?.threadId || message?.data?.idTo;

  if (!threadId) return;

  if (!groupSettings[threadId]) {
    groupSettings[threadId] = {};
  }

  let newStatus;
  if (status === "on") {
    groupSettings[threadId].sendstk = true;
    newStatus = "bật";
  } else if (status === "off") {
    groupSettings[threadId].sendstk = false;
    newStatus = "tắt";
  } else {
    groupSettings[threadId].sendstk = !groupSettings[threadId].sendstk;
    newStatus = groupSettings[threadId].sendstk ? "bật" : "tắt";
  }

  // Lưu groupSettings vào file
  try {
    writeGroupSettings(groupSettings);
  } catch (error) {
    // bỏ log
  }

  // Quản lý interval gửi sticker
  if (groupSettings[threadId].sendstk) {
    // Gửi ngay lập tức 1 sticker khi bật
    try {
      const stickerId = getRandomStickerId();
      const sticker = { id: stickerId, cateId: 1, type: 1 };
      await api.sendSticker(sticker, threadId, MessageType.GroupMessage, 180000);
    } catch (err) {}

    // Sau đó cứ 3 phút gửi 1 lần
    if (!autoStickerIntervals.has(threadId)) {
      const intervalId = setInterval(async () => {
        const currentSettings = readGroupSettings();
        if (!currentSettings[threadId]?.sendstk) {
          clearInterval(autoStickerIntervals.get(threadId));
          autoStickerIntervals.delete(threadId);
          return;
        }

        const stickerId = getRandomStickerId();
        const sticker = { id: stickerId, cateId: 1, type: 1 };
        try {
          await api.sendSticker(sticker, threadId, MessageType.GroupMessage, 180000);
        } catch (err) {}
      }, 3 * 60 * 1000);

      autoStickerIntervals.set(threadId, intervalId);
    }
  } else {
    if (autoStickerIntervals.has(threadId)) {
      clearInterval(autoStickerIntervals.get(threadId));
      autoStickerIntervals.delete(threadId);
    }
  }

  // Gửi thông báo trạng thái
  const caption = `Đã ${newStatus} chức năng gửi sticker tự động vào nhóm này!`;
  try {
    await sendMessageStateQuote(api, message, caption, groupSettings[threadId].sendstk, 30000);
  } catch (error) {
    // bỏ log
  }
}

