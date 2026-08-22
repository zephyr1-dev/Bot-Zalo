import { MessageType } from "zlbotdqt";
import { checkHasActiveGame, getActiveGames } from "./index.js";

const words = [
  "zalo",
  "chatbot",
  "trò chơi",
  "lập trình",
  "thông minh nhân tạo",
  "mạng xã hội",
  "công nghệ",
  "internet",
  "điện thoại",
  "máy tính",
];

function chooseRandomWord() {
  const randomIndex = Math.floor(Math.random() * words.length);
  return words[randomIndex];
}

export async function handleWordGuessCommand(api, message, threadId, args) {
  if (args.length > 0 && args[0].toLowerCase() === "cancel") {
    await cancelWordGuessGame(api, message, threadId);
  } else {
    await startWordGuessGame(api, message,threadId);
  }
}

export async function startWordGuessGame(api, message, threadId) {
  if (await checkHasActiveGame(api, message, threadId)) {
    return;
  }
  const activeGames = getActiveGames();

  // Khởi tạo trò chơi mới
  const word = chooseRandomWord();
  activeGames.set(threadId, { type: "wordGuess", word: word, attempts: 0 });
  await api.sendMessage(
    {
      msg: "Trò chơi Đoán Từ đã bắt đầu! Hãy đoán từ có " + word.length + " chữ cái.",
      quote: message,
    },
    threadId,
    MessageType.GroupMessage
  );
}

export async function handleWordGuessGame(api, message, threadId) {
  const activeGames = getActiveGames();
  if (!activeGames.has(threadId) || activeGames.get(threadId).type !== "wordGuess") return;

  const game = activeGames.get(threadId).game;
  const content = message.data.content.trim().toLowerCase();
  game.guesses++;

  if (content === game.word) {
    await api.sendMessage(
      { msg: `Chúc mừng! Bạn đã đoán đúng từ "${game.word}" sau ${game.guesses} lần thử.`, quote: message },
      threadId,
      MessageType.GroupMessage
    );
    activeGames.delete(threadId);
  } else {
    await api.sendMessage({ msg: "Đoán sai rồi! Hãy thử lại.", quote: message }, threadId, MessageType.GroupMessage);
  }

  if (game.guesses >= 10) {
    await api.sendMessage(
      { msg: `Trò chơi kết thúc! Từ cần đoán là "${game.word}".`, quote: message },
      threadId,
      MessageType.GroupMessage
    );
    activeGames.delete(threadId);
  }
}

export async function cancelWordGuessGame(api, message, threadId) {
  const activeGames = getActiveGames();
  if (!activeGames.has(threadId) || activeGames.get(threadId).type !== "wordGuess") {
    await api.sendMessage(
      { msg: "Không có trò chơi Đoán Từ nào đang diễn ra để hủy.", quote: message },
      threadId,
      MessageType.GroupMessage
    );
    return;
  }

  const game = activeGames.get(threadId);
  activeGames.delete(threadId);
  await api.sendMessage(
    { msg: `Trò chơi Đoán Từ đã bị hủy. Từ cần đoán là: ${game.word}`, quote: message },
    threadId,
    MessageType.GroupMessage
  );
}
