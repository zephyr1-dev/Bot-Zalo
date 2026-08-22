import fs from "fs";
import path from "path";
import { getGroupName } from "../../info-service/group-info.js";
import { sendMessageComplete, sendMessageState, sendMessageStateQuote, sendMessageWarning } from "../../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../service.js";
import { removeMention } from "../../../utils/format-util.js";
import { getBotInfo } from "../../../utils/env.js";

const botInfo = await getBotInfo();
const dataTrainingPath = botInfo.dataTrainingPath;
const SHARE_DIR = path.join(process.cwd(), "assets/resources/filegame");

// ====================== MAIN HANDLE ======================
export async function onMessage(api, message, groupSettings) {
  const threadId = message.threadId;

  if (!groupSettings[threadId]) {
    groupSettings[threadId] = { learnEnabled: true, replyEnabled: true, nameGroup: "Group" };
  }

  // Xử lý lệnh trước
  const handledLearn = await handleLearnCommand(api, message, groupSettings);
  const handledReply = await handleReplyCommand(api, message, groupSettings);
  if (handledLearn || handledReply) return;

  // Nếu không phải lệnh -> chatbot xử lý
  await handleChatBot(api, message, threadId, groupSettings, groupSettings[threadId].nameGroup, false);
}

// ====================== CHATBOT REPLY ======================
export async function handleChatBot(api, message, threadId, groupSettings, nameGroup, isHandleCommand) {
  if (isHandleCommand) return;
  let content = message.data.content;
  let responses = null;

  if (
    groupSettings[threadId].replyEnabled &&
    !content.startsWith(`${getGlobalPrefix()}`) &&
    !content.startsWith("!") &&
    !content.startsWith(".")
  ) {
    responses = findResponse(content, threadId);
  }

  if (responses && Array.isArray(responses) && responses.length > 0) {
    const senderName = message.data.dName;
    const senderId = message.data.uidFrom;
    for (const response of responses) {
      const filePath = path.join(SHARE_DIR, response);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === ".txt") {
          const fileContent = fs.readFileSync(filePath, "utf-8").trim();
          await api.sendMessage(
            {
              msg: fileContent,
              quote: message,
              ttl: 300000,
            },
            threadId,
            message.type
          );
        } else {
          await api.sendMessage(
            {
              msg: `📦 Đây là file bạn yêu cầu: ${response}`,
              attachments: [filePath],
              ttl: 300000,
            },
            threadId,
            message.type
          );
        }
      } else {
        await api.sendMessage(
          {
            msg: response,
            quote: message,
            ttl: 300000,
          },
          threadId,
          message.type
        );
      }
    }
  } else if (responses && !Array.isArray(responses)) {
    const senderName = message.data.dName;
    const senderId = message.data.uidFrom;
    const filePath = path.join(SHARE_DIR, responses);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === ".txt") {
        const fileContent = fs.readFileSync(filePath, "utf-8").trim();
        await api.sendMessage(
          {
            msg: fileContent,
            quote: message,
            ttl: 300000,
          },
          threadId,
          message.type
        );
      } else {
        await api.sendMessage(
          {
            msg: `📦 Đây là file bạn yêu cầu: ${responses}`,
            attachments: [filePath],
            ttl: 300000,
          },
          threadId,
          message.type
        );
      }
    } else {
      await api.sendMessage(
        {
          msg: responses,
          ttl: 3000000
        },
        threadId,
        message.type
      );
    }
  } else {
    if (groupSettings[threadId].learnEnabled && message.data.quote) {
      const nameQuote = message.data.quote.fromD;
      const botResponse = message.data.quote.msg;
      content = content.replace(nameQuote, "").replace("@", "").trim();
      if (content !== "" && content.length > 6) {
        learnFromChat(botResponse, threadId, content, nameGroup);
      }
    }
  }
}

// ====================== TRAINING DATA ======================
export function loadTrainingData() {
  try {
    const data = fs.readFileSync(dataTrainingPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Lỗi khi đọc file data-training.json:", error);
    return {};
  }
}

export function saveTrainingData(data) {
  try {
    fs.writeFileSync(dataTrainingPath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Lỗi khi ghi file data-training.json:", error);
  }
}

export function learnFromChat(message, threadId, response, groupName) {
  const data = loadTrainingData();

  if (!data[threadId]) {
    data[threadId] = {
      nameGroup: groupName,
      listTrain: {},
    };
  }

  if (data[threadId].listTrain[message]) {
    const existingData = data[threadId].listTrain[message];
    let responses = [];
    if (Array.isArray(existingData)) {
      responses = existingData;
    } else if (typeof existingData === "string") {
      responses = [{ response: existingData, isTemporary: true }];
    } else {
      responses = [existingData];
    }

    responses.push({
      response: response,
      isTemporary: true,
    });

    data[threadId].listTrain[message] = responses;
  } else {
    data[threadId].listTrain[message] = [
      {
        response: response,
        isTemporary: true,
      },
    ];
  }

  saveTrainingData(data);
}

// ====================== RESPONSE VALIDATION ======================
function isInvalidResponse(response) {
  const responseLower = response.toLowerCase();
  const invalidKeywords = [
    "cặc",
    "lồn"
  ];

  return invalidKeywords.some((keyword) => responseLower.includes(keyword));
}

// ====================== RESPONSE MANAGEMENT ======================
function removeSpecificResponse(threadId, question, responseToRemove) {
  const data = loadTrainingData();
  let removed = false;

  if (data[threadId]?.listTrain?.[question]) {
    const responses = data[threadId].listTrain[question];

    if (Array.isArray(responses)) {
      const filteredResponses = responses.filter((item) => {
        const response = typeof item === "string" ? item : item.response;
        return response.trim() !== responseToRemove.trim();
      });

      if (filteredResponses.length < responses.length) {
        removed = true;
        if (filteredResponses.length === 0) {
          delete data[threadId].listTrain[question];
        } else {
          data[threadId].listTrain[question] = filteredResponses;
        }
        saveTrainingData(data);
        console.log(`Đã xóa câu trả lời "${responseToRemove}" của câu hỏi "${question}"`);
      }
    } else {
      const response = typeof responses === "string" ? responses : responses.response;
      if (response.trim() === responseToRemove.trim()) {
        delete data[threadId].listTrain[question];
        removed = true;
        saveTrainingData(data);
        console.log(`Đã xóa câu trả lời "${responseToRemove}" của câu hỏi "${question}"`);
      }
    }
  }

  return removed;
}

function trackResponseUsage(threadId, question, response) {
  removeSpecificResponse(threadId, question, response);
  return true;
}

// ====================== FIND RESPONSE ======================
export function findResponse(message, threadId) {
  const data = loadTrainingData();

  if (data[threadId] && data[threadId].listTrain) {
    for (const question of Object.keys(data[threadId].listTrain)) {
      if (message.includes(question)) {
        const responses = data[threadId].listTrain[question];
        const validResponses = Array.isArray(responses)
          ? responses.filter((r) => !isInvalidResponse(typeof r === "string" ? r : r.response))
          : !isInvalidResponse(typeof responses === "string" ? responses : responses.response)
            ? [responses]
            : [];

        if (validResponses.length > 0) {
          const responseList = validResponses.map((r) => {
            const response = typeof r === "string" ? r : r.response;
            const isTemp = typeof r === "string" ? true : r.isTemporary;
            if (isTemp) {
              trackResponseUsage(threadId, question, response);
            }
            return response;
          });
          return responseList;
        }
      }
    }
  }
  return null;
}

// ====================== COMMAND HANDLERS ======================
export async function handleLearnCommand(api, message, groupSettings) {
  const threadId = message.threadId;
  const content = removeMention(message);
  const prefix = getGlobalPrefix();

  if (!groupSettings[threadId]) {
    groupSettings[threadId] = { learnEnabled: false, replyEnabled: false };
  }

  if (content.startsWith(`${prefix}learnnow`)) {
    const parts = content.split("_");
    if (parts.length >= 3) {
      const question = parts[1];
      let answer = parts.slice(2).join("_").replace(/\\n/g, "\n");
      if (question && answer) {
        const success = await learnNewResponse(api, threadId, question, answer);
        if (success) {
          const caption = `Đã thêm câu trả lời mới thành công. Khi người dùng gửi tin nhắn chứa "${question}", tôi sẽ trả lời:\n${answer}`;
          await sendMessageComplete(api, message, caption);
        } else {
          const caption = `Câu trả lời "${answer}" đã tồn tại cho câu hỏi "${question}"`;
          await sendMessageWarning(api, message, caption);
        }
      } else {
        const caption = "Cú pháp không hợp lệ. Vui lòng sử dụng: !learnnow_[Câu Hỏi]_[Câu Trả Lời] (dùng \\n để xuống dòng)";
        await sendMessageWarning(api, message, caption);
      }
    } else {
      const caption = "Cú pháp không hợp lệ. Vui lòng sử dụng: !learnnow_[Câu Hỏi]_[Câu Trả Lời] (dùng \\n để xuống dòng)";
      await sendMessageWarning(api, message, caption);
    }
    return true;
  } else if (content.startsWith(`${prefix}learn`)) {
    const parts = content.split(" ");
    if (parts.length === 1) {
      groupSettings[threadId].learnEnabled = !groupSettings[threadId].learnEnabled;
      const caption = `Chế độ học tập đã được ${groupSettings[threadId].learnEnabled ? "bật" : "tắt"}!`;
      await sendMessageStateQuote(api, message, caption, groupSettings[threadId].learnEnabled, 30000, false);
    } else if (parts[1].toLowerCase() === "on" || parts[1].toLowerCase() === "off") {
      groupSettings[threadId].learnEnabled = parts[1].toLowerCase() === "on";
      const caption = `Chế độ học tập đã được ${parts[1].toLowerCase() === "on" ? "bật" : "tắt"}!`;
      await sendMessageStateQuote(api, message, caption, groupSettings[threadId].learnEnabled, 30000, false);
    } else {
      await sendMessageWarning(api, message, "❌ Cú pháp không hợp lệ. Sử dụng !learn, !learn on/off để bật/tắt chế độ học tập");
    }
    return true;
  } else if (content.startsWith(`${prefix}unlearn`)) {
    await handleUnlearnCommand(api, message);
    return true;
  }
  return false;
}

export async function handleReplyCommand(api, message, groupSettings) {
  const threadId = message.threadId;
  const content = removeMention(message);
  const prefix = getGlobalPrefix();

  if (!groupSettings[threadId]) {
    groupSettings[threadId] = { learnEnabled: false, replyEnabled: false };
  }

  if (content.startsWith(`${prefix}reply`)) {
    const parts = content.split(" ");
    if (parts.length === 1) {
      if (!groupSettings[threadId].replyEnabled) {
        groupSettings[threadId].replyEnabled = true;
        const caption = `Chế độ trả lời đã được bật!`;
        await sendMessageStateQuote(api, message, caption, true, 30000, false);
      } else {
        const caption = `Chế độ trả lời đã được bật trước đó!`;
        await sendMessageStateQuote(api, message, caption, true, 30000, false);
      }
    } else if (parts[1].toLowerCase() === "on") {
      groupSettings[threadId].replyEnabled = true;
      const caption = `Chế độ trả lời đã được bật!`;
      await sendMessageStateQuote(api, message, caption, true, 30000, false);
    } else if (parts[1].toLowerCase() === "off") {
      groupSettings[threadId].replyEnabled = false;
      const caption = `Chế độ trả lời đã được tắt!`;
      await sendMessageStateQuote(api, message, caption, false, 30000, false);
    } else {
      await sendMessageWarning(api, message, "❌ Cú pháp không hợp lệ. Sử dụng !reply hoặc !reply on/off để bật/tắt chế độ trả lời");
    }
    return true;
  }
  return false;
}

export async function learnNewResponse(api, threadId, question, answer) {
  const data = loadTrainingData();

  if (!data[threadId]) {
    data[threadId] = {
      nameGroup: await getGroupName(api, threadId),
      listTrain: {},
    };
  }

  if (data[threadId].listTrain[question]) {
    const existingData = data[threadId].listTrain[question];
    let responses = [];

    if (Array.isArray(existingData)) {
      responses = existingData;
    } else if (typeof existingData === "string") {
      responses = [{ response: existingData, isTemporary: false }];
    } else {
      responses = [existingData];
    }

    const isDuplicate = responses.some((r) => r.response === answer);
    if (!isDuplicate) {
      responses.push({
        response: answer,
        isTemporary: false,
      });
      data[threadId].listTrain[question] = responses;
      saveTrainingData(data);
      return true;
    } else {
      return false;
    }
  } else {
    data[threadId].listTrain[question] = [
      {
        response: answer,
        isTemporary: false,
      },
    ];
    saveTrainingData(data);
    return true;
  }
}

export async function handleUnlearnCommand(api, message) {
  const threadId = message.threadId;
  const content = removeMention(message).trim();
  const prefix = getGlobalPrefix();

  if (content.startsWith(`${prefix}unlearn`)) {
    const parts = content.split(" ");
    if (parts.length >= 2) {
      let valueToRemove = parts.slice(1).join(" ").replace(/\\n/g, "\n");
      const removed = await removeLearnedResponse(threadId, valueToRemove);
      if (removed) {
        await api.sendMessage(
          {
            msg: `✅ Đã xóa thành công câu hỏi có câu trả lời "${valueToRemove}"`,
            quote: message,
            ttl: 30000,
          },
          threadId,
          message.type
        );
      } else {
        await api.sendMessage(
          {
            msg: `❌ Không tìm thấy câu hỏi nào có câu trả lời "${valueToRemove}"`,
            quote: message,
            ttl: 30000,
          },
          threadId,
          message.type
        );
      }
    } else {
      await api.sendMessage(
        {
          msg: "❌ Cú pháp không hợp lệ. Vui lòng sử dụng: !unlearn [Câu Trả Lời] (dùng \\n để xuống dòng)",
          quote: message,
          ttl: 30000,
        },
        threadId,
        message.type
      );
    }
    return true;
  }
  return false;
}

export async function removeLearnedResponse(threadId, value) {
  const data = loadTrainingData();
  let removed = false;

  if (data[threadId] && data[threadId].listTrain) {
    const entries = Object.entries(data[threadId].listTrain);

    for (const [key, val] of entries) {
      if (Array.isArray(val)) {
        const filteredResponses = val.filter((item) => {
          const response = typeof item === "string" ? item : item.response;
          return response.trim() !== value.trim();
        });

        if (filteredResponses.length < val.length) {
          removed = true;
          console.log(`Đã xóa - Câu hỏi: "${key}" - Câu trả lời: "${value}"`);
          if (filteredResponses.length === 0) {
            delete data[threadId].listTrain[key];
          } else {
            data[threadId].listTrain[key] = filteredResponses;
          }
        }
      } else {
        const response = typeof val === "string" ? val : val.response;
        if (response && response.trim() === value.trim()) {
          delete data[threadId].listTrain[key];
          removed = true;
          console.log(`Đã xóa - Câu hỏi: "${key}" - Câu trả lời: "${value}"`);
        }
      }
    }

    if (removed) {
      saveTrainingData(data);
    }
  }

  return removed;
}

export async function handleBotReply(api, message, groupSettings) {
  const threadId = message.threadId;
  const content = message.data.content;
  const data = loadTrainingData();

  if (groupSettings[threadId]?.replyEnabled && data[threadId]?.listTrain) {
    for (const question of Object.keys(data[threadId].listTrain)) {
      if (content.includes(question)) {
        const responses = data[threadId].listTrain[question];
        const validResponses = Array.isArray(responses)
          ? responses.filter((r) => !isInvalidResponse(typeof r === "string" ? r : r.response))
          : !isInvalidResponse(typeof responses === "string" ? responses : responses.response)
            ? [responses]
            : [];

        if (validResponses.length > 0) {
          for (const r of validResponses) {
            const response = typeof r === "string" ? r : r.response;
            const isTemp = typeof r === "string" ? true : r.isTemporary;
            const filePath = path.join(SHARE_DIR, response);
            if (fs.existsSync(filePath)) {
              const ext = path.extname(filePath).toLowerCase();
              if (ext === ".txt") {
                const fileContent = fs.readFileSync(filePath, "utf-8").trim();
                await api.sendMessage(
                  {
                    msg: fileContent,
                    quote: message,
                    ttl: 300000,
                  },
                  threadId,
                  message.type
                );
              } else {
                await api.sendMessage(
                  {
                    msg: `📦 Đây là file bạn yêu cầu: ${response}`,
                    attachments: [filePath],
                    ttl: 300000,
                  },
                  threadId,
                  message.type
                );
              }
            } else {
              await api.sendMessage(
                {
                  msg: response,
                  quote: message,
                  ttl: 300000,
                },
                threadId,
                message.type
              );
            }
            if (isTemp) {
              trackResponseUsage(threadId, question, response);
            }
          }
          return true;
        }
      }
    }
  }
  return false;
}