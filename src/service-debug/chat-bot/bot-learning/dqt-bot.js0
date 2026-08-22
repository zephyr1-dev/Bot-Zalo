import fs from "fs";
import path from "path";
import { getGroupName } from "../../info-service/group-info.js";
import { sendMessageComplete, sendMessageState, sendMessageStateQuote, sendMessageWarning } from "../../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../service.js";
import natural from "natural";
import { removeMention } from "../../../utils/format-util.js";

const dataTrainingPath = path.resolve(process.cwd(), "assets", "json-data", "data-training.json");

export async function handleChatBot(api, message, threadId, groupSettings, nameGroup, isHandleCommand) {
  if (isHandleCommand) return;
  let content = message.data.content;
  let response = null;

  if (
    groupSettings[threadId].replyEnabled &&
    !content.startsWith(`${getGlobalPrefix()}`) &&
    !content.startsWith(`!`) &&
    !content.startsWith(`.`)
  ) {
    response = findResponse(content, threadId);
  }

  if (response) {
    const senderName = message.data.dName;
    const senderId = message.data.uidFrom;
    await api.sendMessage(
      { msg: `${senderName} ${response}`, quote: message, mentions: [{ pos: 0, uid: senderId, len: senderName.length }] },
      threadId,
      message.type
    );
  } else {
    if (groupSettings[threadId].learnEnabled) {
      if (message.data.quote) {
        const nameQuote = message.data.quote.fromD;
        const botResponse = message.data.quote.msg;
        content = content.replace(nameQuote, "").replace("@", "").trim();
        if (content !== "" && content.length > 6) {
          learnFromChat(botResponse, threadId, content, nameGroup);
        }
      }
    }
  }
}

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

function calculateSimilarity(str1, str2) {
  const tokenizer = new natural.WordTokenizer();
  const words1 = tokenizer.tokenize(str1.toLowerCase());
  const words2 = tokenizer.tokenize(str2.toLowerCase());

  // Sử dụng JaroWinklerDistance để tính độ tương đồng
  const distance = natural.JaroWinklerDistance(words1.join(" "), words2.join(" "));
  return distance;
}

// Thêm hàm kiểm tra câu trả lời Không hợp lệ
function isInvalidResponse(response) {
  // Chuyển response về chữ thường để dễ kiểm tra
  const responseLower = response.toLowerCase();

  // Kiểm tra các link
  const linkPatterns = ["http://", "https://", ".com", ".net", ".org", "www.", ".vn", "bit.ly"];

  // Kiểm tra các từ khóa Không hợp lệ
  const invalidKeywords = [
    "lệnh",
    "tồn tại",
    "prefix",
    "admin",
    "bot",
    "help",
    "hướng dẫn",
    "command",
    "!",
    ".",
    "Không thể",
    "Không tìm thấy",
    "Không tồn tại",
  ];

  // Kiểm tra link
  if (linkPatterns.some((pattern) => responseLower.includes(pattern))) {
    return true;
  }

  // Kiểm tra từ khóa Không hợp lệ
  if (invalidKeywords.some((keyword) => responseLower.includes(keyword))) {
    return true;
  }

  return false;
}

// Thêm hàm mới để xóa response cụ thể của một question
function removeSpecificResponse(threadId, question, responseToRemove) {
  const data = loadTrainingData();
  let removed = false;

  if (data[threadId]?.listTrain?.[question]) {
    const responses = data[threadId].listTrain[question];

    if (Array.isArray(responses)) {
      // Lọc ra các câu trả lời Không khớp với responseToRemove
      const filteredResponses = responses.filter((item) => {
        const response = typeof item === "string" ? item : item.response;
        return response.trim() !== responseToRemove.trim();
      });

      // Nếu có câu trả lời bị lọc ra
      if (filteredResponses.length < responses.length) {
        removed = true;

        // Nếu Không còn câu trả lời nào
        if (filteredResponses.length === 0) {
          delete data[threadId].listTrain[question];
        } else {
          data[threadId].listTrain[question] = filteredResponses;
        }

        saveTrainingData(data);
        console.log(`Đã xóa câu trả lời "${responseToRemove}" của câu hỏi "${question}"`);
      }
    } else {
      // Xử lý trường hợp responses là string hoặc object đơn lẻ
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

// Cập nhật lại hàm trackResponseUsage
function trackResponseUsage(threadId, question, response) {
  // Xóa response cụ thể của question thay vì xóa toàn bộ
  removeSpecificResponse(threadId, question, response);
  return true;
}

// Thêm hàm để loại bỏ ký tự đặc biệt
function normalizeText(text) {
  return text
    .replace(/[\u0300-\u036f]/g, "") // Giữ lại dấu trong UTF-8 (ví dụ: ê)
    .replace(/[^\p{L}\p{N}\s]/gu, "") // Chỉ giữ lại chữ cái, số và khoảng trắng
    .replace(/\s+/g, " ") // Chuẩn hóa khoảng trắng
    .trim();
}

// Cập nhật hàm countMatchingWords
function countMatchingWords(message, key) {
  // Chuẩn hóa cả message và key
  const normalizedMessage = normalizeText(message);
  const normalizedKey = normalizeText(key);

  const messageChars = normalizedMessage.toLowerCase().split("");
  const keyChars = normalizedKey.toLowerCase().split("");

  let matchCount = 0;
  let i = 0;
  let j = 0;

  while (i < messageChars.length && j < keyChars.length) {
    if (messageChars[i] === " ") {
      i++;
      continue;
    }
    if (keyChars[j] === " ") {
      j++;
      continue;
    }

    if (messageChars[i] === keyChars[j]) {
      matchCount++;
      i++;
      j++;
    } else {
      if (i > 0 && messageChars[i] === messageChars[i - 1]) {
        i++;
        continue;
      }
      if (j > 0 && keyChars[j] === keyChars[j - 1]) {
        j++;
        continue;
      }
      i++;
      j++;
    }
  }

  return matchCount;
}

export function findResponse(message, threadId) {
  const data = loadTrainingData();
  const SIMILARITY_THRESHOLD = 0.85;
  const WORD_MATCH_THRESHOLD = 0.4;

  if (data[threadId] && data[threadId].listTrain) {
    const messageLower = message.toLowerCase();
    const messageWords = messageLower.split(/\s+/).filter((word) => word.length > 1);
    const matchedQuestions = [];

    // 1. Tìm câu được dạy trước (permanent) và khớp một phần
    for (const [key, value] of Object.entries(data[threadId].listTrain)) {
      const responses = Array.isArray(value) ? value : [value];
      const permanentResponses = responses.filter((r) => typeof r !== "string" && r.isTemporary === false);

      if (permanentResponses.length > 0) {
        // Chuẩn hóa message và key trước khi tách từ
        const normalizedMessage = normalizeText(messageLower);
        const normalizedKey = normalizeText(key.toLowerCase());

        const messageWords = normalizedMessage.split(/\s+/);
        const keyWords = normalizedKey.split(/\s+/);

        const hasMatchingWord = messageWords.some((msgWord) =>
          keyWords.some((keyWord) => {
            // Chuẩn hóa từng từ trước khi so sánh
            const normalizedMsgWord = normalizeText(msgWord);
            const normalizedKeyWord = normalizeText(keyWord);

            // Từ quá ngắn, bỏ qua
            if (normalizedMsgWord.length < 2) return false;

            // Kiểm tra khớp chính xác
            if (normalizedMsgWord === normalizedKeyWord) return true;

            // Kiểm tra viết tắt (ví dụ: tf = TestFlight)
            if (normalizedKeyWord.match(/[A-Z]/)) {
              const abbreviation = normalizedKeyWord
                .split(/(?=[A-Z])/)
                .map((word) => word.charAt(0).toLowerCase())
                .join("");

              // Chỉ so sánh nếu từ viết tắt có độ dài giống nhau
              if (abbreviation.length === normalizedMsgWord.length) {
                // Kiểm tra từ gốc
                if (normalizedMsgWord === abbreviation) return true;

                // Xử lý trường hợp kéo dài chữ cuối
                const lastChar = abbreviation.charAt(abbreviation.length - 1);
                const baseWord = normalizedMsgWord.replace(new RegExp(lastChar + "+$"), "");

                if (
                  baseWord === abbreviation.slice(0, -1) &&
                  normalizedMsgWord
                    .slice(baseWord.length)
                    .split("")
                    .every((c) => c === lastChar)
                ) {
                  return true;
                }
              }
            }

            // Xử lý trường hợp kéo dài chữ cuối cho từ đầy đủ
            const lastCharFull = normalizedKeyWord.charAt(normalizedKeyWord.length - 1);
            const baseWordFull = normalizedMsgWord.replace(new RegExp(lastCharFull + "+$"), "");

            if (
              baseWordFull === normalizedKeyWord.slice(0, -1) &&
              normalizedMsgWord
                .slice(baseWordFull.length)
                .split("")
                .every((c) => c === lastCharFull)
            ) {
              return true;
            }

            return false;
          })
        );

        if (hasMatchingWord) {
          matchedQuestions.push({
            question: key,
            responses: permanentResponses,
            similarity: 1,
            isPermanent: true,
            isPartialMatch: true,
          });
        }
      }
    }

    // 2. Tìm câu hỏi khớp chính xác
    if (data[threadId].listTrain[message]) {
      const responses = data[threadId].listTrain[message];
      const validResponses = Array.isArray(responses)
        ? responses.filter((r) => !isInvalidResponse(typeof r === "string" ? r : r.response))
        : !isInvalidResponse(typeof responses === "string" ? responses : responses.response)
        ? [responses]
        : [];

      if (validResponses.length > 0) {
        matchedQuestions.push({
          question: message,
          responses: validResponses,
          similarity: 1,
          isPermanent: validResponses.some((r) => typeof r !== "string" && r.isTemporary === false),
          isExactMatch: true,
        });
      }
    }

    // 3. Tìm câu hỏi có độ tương đồng cao
    for (const [key, value] of Object.entries(data[threadId].listTrain)) {
      const keyLower = key.toLowerCase();
      const keyWords = keyLower.split(/\s+/).filter((word) => word.length > 1);
      const matchedWords = messageWords.filter((word) => keyWords.includes(word));
      const matchRatio = matchedWords.length / Math.max(messageWords.length, keyWords.length);

      if (matchRatio >= WORD_MATCH_THRESHOLD) {
        const similarity = calculateSimilarity(messageLower, keyLower);
        if (similarity >= SIMILARITY_THRESHOLD) {
          const responses = Array.isArray(value) ? value : [value];
          const validResponses = responses.filter((r) => !isInvalidResponse(typeof r === "string" ? r : r.response));

          if (validResponses.length > 0) {
            matchedQuestions.push({
              question: key,
              responses: validResponses,
              similarity: similarity,
              isPermanent: validResponses.some((r) => typeof r !== "string" && r.isTemporary === false),
              isSimilarMatch: true,
            });
          }
        }
      }
    }

    // 4. Kiểm tra cụm từ khớp một phần (cho temporary responses)
    for (const [key, value] of Object.entries(data[threadId].listTrain)) {
      const keyWords = key.toLowerCase().split(/\s+/);
      const messageWords = messageLower.split(/\s+/);

      // Kiểm tra xem tất cả các từ trong message có xuất hiện trong key theo đúng thứ tự Không
      let isMatch = false;
      for (let i = 0; i <= keyWords.length - messageWords.length; i++) {
        const subWords = keyWords.slice(i, i + messageWords.length);
        if (messageWords.every((word, index) => word === subWords[index])) {
          isMatch = true;
          break;
        }
      }

      if (isMatch) {
        const responses = Array.isArray(value) ? value : [value];
        const validResponses = responses.filter((r) => !isInvalidResponse(typeof r === "string" ? r : r.response));

        if (validResponses.length > 0) {
          matchedQuestions.push({
            question: key,
            responses: validResponses,
            similarity: 0.8,
            isPermanent: validResponses.some((r) => typeof r !== "string" && r.isTemporary === false),
            isPartialMatch: true,
          });
        }
      }
    }

    // Sắp xếp kết quả theo thứ tự ưu tiên
    matchedQuestions.sort((a, b) => {
      // Ưu tiên permanent trước
      if (a.isPermanent !== b.isPermanent) {
        return a.isPermanent ? -1 : 1;
      }

      // Nếu cùng độ tương đồng, so sánh số từ khớp
      if (Math.abs(a.similarity - b.similarity) < 0.1) {
        const aMatchCount = countMatchingWords(messageLower, a.question);
        const bMatchCount = countMatchingWords(messageLower, b.question);
        if (aMatchCount !== bMatchCount) {
          return bMatchCount - aMatchCount;
        }
      }

      // Cuối cùng mới xét đến độ tương đồng
      return b.similarity - a.similarity;
    });

    // Chọn câu trả lời từ kết quả tốt nhất
    if (matchedQuestions.length > 0) {
      const bestMatch = matchedQuestions[0];
      const selectedResponse = bestMatch.responses[Math.floor(Math.random() * bestMatch.responses.length)];
      const response = typeof selectedResponse === "string" ? selectedResponse : selectedResponse.response;
      const isTemp = typeof selectedResponse === "string" ? true : selectedResponse.isTemporary;

      if (isTemp === true) {
        trackResponseUsage(threadId, bestMatch.question, response);
      }
      return response;
    }
  }
  return null;
}

export async function handleLearnCommand(api, message, groupSettings) {
  const threadId = message.threadId;
  const content = removeMention(message);
  const prefix = getGlobalPrefix();

  if (content.startsWith(`${prefix}learnnow_`)) {
    const parts = content.split("_");
    if (parts.length >= 3) {
      const question = parts[1];
      const answer = parts.slice(2).join("_");
      const success = await learnNewResponse(api, threadId, question, answer);

      if (success) {
        const caption = `Đã thêm câu trả lời mới thành công. Khi người dùng nhắc đến "${question}", tôi có thể trả lời: "${answer}"`;
        await sendMessageComplete(api, message, caption);
      } else {
        const caption = `Câu trả lời "${answer}" đã tồn tại cho câu hỏi "${question}"`;
        await sendMessageWarning(api, message, caption);
      }
    } else {
      const caption = "Cú pháp Không hợp lệ. Vui lòng sử dụng: !learnnow_[Câu Hỏi]_[Câu Trả Lời] để dạy bot học câu trả lời mới";
      await sendMessageWarning(api, message, caption);
    }
    return true;
  } else if (content.startsWith(`${prefix}learn`)) {
    const parts = content.split(" ");
    if (parts.length === 1) {
      // Nếu Không có đối số, chuyển trạng thái ngược lại
      groupSettings[threadId].learnEnabled = !groupSettings[threadId].learnEnabled;
      const caption = `Chế đ học tập đã được ${groupSettings[threadId].learnEnabled ? "bật" : "tắt"}!`;
      await sendMessageStateQuote(api, message, caption, groupSettings[threadId].learnEnabled, 30000, false);
    } else if (parts[1] === "on" || parts[1] === "off") {
      groupSettings[threadId].learnEnabled = parts[1] === "on";
      const caption = `Chế độ học tập đã được ${parts[1] === "on" ? "bật" : "tắt"}!`;
      await sendMessageStateQuote(api, message, caption, groupSettings[threadId].learnEnabled, 30000, false);
    } else {
      await sendMessageWarning(api, message, "❌ Cú pháp Không hợp lệ. Sử dụng !learn, !learn on/off để bật tắt chế độ học tập");
    }
    return true;
  } else if (content.startsWith(`${prefix}unlearn`)) {
    await handleUnlearnCommand(api, message);
  }
  return false;
}

export async function handleReplyCommand(api, message, groupSettings) {
  const threadId = message.threadId;
  const content = removeMention(message);
  const prefix = getGlobalPrefix();

  if (content.startsWith(`${prefix}reply`)) {
    const parts = content.split(" ");
    if (parts.length === 1) {
      // Nếu Không có đối số, chuyển trạng thái ngược lại
      groupSettings[threadId].replyEnabled = !groupSettings[threadId].replyEnabled;
      const caption = `Chế độ trả lời đã được ${groupSettings[threadId].replyEnabled ? "bật" : "tắt"}!`;
      await sendMessageStateQuote(api, message, caption, groupSettings[threadId].replyEnabled, 30000, false);
    } else if (parts[1] === "on" || parts[1] === "off") {
      groupSettings[threadId].replyEnabled = parts[1] === "on";
      const caption = `Chế độ trả lời đã được ${parts[1] === "on" ? "bật" : "tắt"}!`;
      await sendMessageStateQuote(api, message, caption, groupSettings[threadId].replyEnabled, 30000, false);
    } else {
      await sendMessageWarning(api, message, "Cú pháp Không hợp lệ. Sử dụng !reply hoặc !reply on/off để bật tắt chế độ trả lời");
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
  const content = message.data.content.trim();
  const prefix = getGlobalPrefix();

  if (content.startsWith(`${prefix}unlearn`)) {
    const parts = content.split(" ");
    if (parts.length >= 2) {
      const valueToRemove = parts.slice(1).join(" ");
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
          msg: "❌ Cú pháp Không hợp lệ. Vui lòng sử dụng: !unlearn [Câu Trả Lời] để xóa câu hỏi tương ứng",
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

    // Lặp qua tất cả các câu hỏi
    for (const [key, val] of entries) {
      if (Array.isArray(val)) {
        // Lọc ra các câu trả lời Không khớp với value
        const filteredResponses = val.filter((item) => {
          const response = typeof item === "string" ? item : item.response;
          return response.trim() !== value.trim();
        });

        // Nếu có câu trả lời bị lọc ra (tức là đã tìm thấy và xóa)
        if (filteredResponses.length < val.length) {
          removed = true;
          console.log(`Đã xóa - Câu hỏi: "${key}" - Câu trả lời: "${value}"`);

          // Nếu Không còn câu trả lời nào, xóa luôn câu hỏi
          if (filteredResponses.length === 0) {
            delete data[threadId].listTrain[key];
          } else {
            // Ngược lại cập nhật lại mảng câu trả lời mới
            data[threadId].listTrain[key] = filteredResponses;
          }
        }
      } else {
        // Xử lý trường hợp val là string hoặc object đơn lẻ
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
