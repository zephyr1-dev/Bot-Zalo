import { MessageType } from "zlbotdqt";
import { getGlobalPrefix } from "../../service.js";
import { getActiveGames, checkHasActiveGame } from "./index.js";

const playerCooldowns = new Map();

function calculateMaxAttempts(range) {
  return Math.floor(5 + Math.pow(range, 0.4));
}

export async function handleGuessNumberCommand(api, message, threadId, args) {
  const prefix = getGlobalPrefix();
  const activeGames = getActiveGames();
  
  if (args.length < 1) {
    await api.sendMessage(
      { msg: `Sử dụng: ${prefix}doanso [số lớn nhất]`, quote: message },
      threadId,
      MessageType.GroupMessage
    );
    return;
  }

  if (args[0].toLowerCase() === "cancel") {
    if (activeGames.has(threadId)) {
      activeGames.delete(threadId);
      await api.sendMessage(
        { msg: "Trò chơi đoán số đã được hủy bỏ.", quote: message },
        threadId,
        MessageType.GroupMessage
      );
    } else {
      await api.sendMessage(
        { msg: "Không có trò chơi đoán số nào đang diễn ra để hủy bỏ.", quote: message },
        threadId,
        MessageType.GroupMessage
      );
    }
    return;
  }

  let range = parseInt(args[0]);
  if (isNaN(range) || range < 2) {
    await api.sendMessage(
      { msg: "Số lớn nhất phải là một số nguyên lớn hơn hoặc bằng 2.", quote: message },
      threadId,
      MessageType.GroupMessage
    );
    return;
  }

  if (await checkHasActiveGame(api, message, threadId)) {
    return;
  }

  const commandParts = message.data.content.trim().split(" ");
  range = 1000;
  if (commandParts.length > 1 && !isNaN(commandParts[1])) {
    range = Math.max(10, Math.min(1000000, parseInt(commandParts[1])));
  }

  const targetNumber = Math.floor(Math.random() * range) + 1;
  const maxAttempts = calculateMaxAttempts(range);

  activeGames.set(threadId, { type: 'guessNumber', game: { targetNumber, attempts: 0, players: new Map(), range, maxAttempts } });

  await api.sendMessage(
    {
      msg: `Trò chơi đoán số bắt đầu! Hãy đoán một số từ 1 đến ${range}. Bạn có tối đa ${maxAttempts} lượt đoán.`,
      quote: message,
    },
    threadId,
    MessageType.GroupMessage
  );
}

export async function handleGuessNumberGame(api, message, threadId, senderId) {
  const activeGames = getActiveGames();
  if (!activeGames.has(threadId) || activeGames.get(threadId).type !== 'guessNumber') return;

  const game = activeGames.get(threadId).game;
  const guessedNumber = parseInt(message.data.content);

  if (isNaN(guessedNumber) || guessedNumber < 1 || guessedNumber > game.range) {
    return;
  }

  game.attempts++;

  if (!game.players.has(senderId)) {
    game.players.set(senderId, 0);
  }
  game.players.set(senderId, game.players.get(senderId) + 1);

  playerCooldowns.set(`${threadId}-${senderId}`, Date.now());

  if (guessedNumber === game.targetNumber) {
    await handleCorrectGuess(api, message, threadId, game, senderId);
  } else if (guessedNumber < game.targetNumber) {
    await api.sendMessage(
      { msg: "Số bạn đoán nhỏ hơn. Hãy thử lại!", quote: message, ttl: 10000 },
      threadId,
      MessageType.GroupMessage
    );
  } else {
    await api.sendMessage(
      { msg: "Số bạn đoán lớn hơn. Hãy thử lại!", quote: message, ttl: 10000 },
      threadId,
      MessageType.GroupMessage
    );
  }

  if (game.attempts >= game.maxAttempts) {
    await handleGameOver(api, message, threadId, game);
    activeGames.delete(threadId);
  }
}

async function handleCorrectGuess(api, message, threadId, game, senderId) {
  await api.sendMessage(
    {
      msg: `Chúc mừng! Bạn đã đoán đúng số ${game.targetNumber} sau ${
        game.attempts
      } lần thử tổng cộng và ${game.players.get(senderId)} lần thử của bạn.`,
      quote: message,
    },
    threadId,
    MessageType.GroupMessage
  );
  playerCooldowns.delete(`${threadId}-${senderId}`);
  getActiveGames().delete(threadId);
}

async function handleGameOver(api, message, threadId, game) {
  await api.sendMessage(
    {
      msg: `Trò chơi kết thúc! Số cần đoán là ${game.targetNumber}. Đã đạt đến giới hạn ${game.maxAttempts} lượt đoán.`,
      quote: message,
    },
    threadId,
    MessageType.GroupMessage
  );
  for (const [senderId] of game.players) {
    playerCooldowns.delete(`${threadId}-${senderId}`);
  }
  getActiveGames().delete(threadId);
}
