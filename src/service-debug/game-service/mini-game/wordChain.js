import { MessageType } from "zlbotdqt";
import axios from "axios";
import { getGlobalPrefix } from "../../service.js";
import { getActiveGames, checkHasActiveGame } from "./index.js";
import { API_KEY_HOANGDEV } from "../../api-crawl/api-hoangdev/aio-downlink.js";

export async function handleWordChainCommand(api, message) {
  const threadId = message.threadId;
  const args = message.data.content.split(" ");

  if (args[1]?.toLowerCase() === "cancel") {
    if (getActiveGames().has(threadId)) {
      getActiveGames().delete(threadId);
      await api.sendMessage(
        { msg: "Trò chơi nối từ đã được hủy bỏ.", quote: message },
        threadId,
        message.type
      );
    } else {
      await api.sendMessage(
        { msg: "Không có trò chơi nối từ nào đang diễn ra để hủy bỏ.", quote: message },
        threadId,
        message.type
      );
    }
    return;
  }

  if (await checkHasActiveGame(api, message, threadId)) {
    return;
  }

  getActiveGames().set(threadId, { type: 'wordChain', game: { lastPhrase: "", players: new Set(), botTurn: false, maxWords: 2 } });
  await api.sendMessage(
    { msg: "Trò chơi nối từ bắt đầu! Hãy nhập một cụm từ (tối đa 2 từ) để bắt đầu.", quote: message },
    threadId,
    message.type
  );
}

export async function handleWordChainMessage(api, message) {
  const threadId = message.threadId;
  const activeGames = getActiveGames();

  if (!activeGames.has(threadId) || activeGames.get(threadId).type !== 'wordChain') return;

  const game = activeGames.get(threadId).game;

  // Kiểm tra và loại bỏ ký tự đặc biệt
  const cleanContent = message.data.content.trim().toLowerCase();
  const cleanContentTrim = cleanContent.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  if (cleanContent !== cleanContentTrim) {
    // await api.sendMessage({ msg: "Cụm từ Không hợp lệ! Vui lòng xóa các ký tự đặc biệt và thử lại.", quote: message }, threadId, MessageType.GroupMessage);
    return;
  }

  const words = cleanContentTrim.split(/\s+/);

  if (words.length > game.maxWords) {
    await api.sendMessage(
      { msg: `Bạn đã thua! Cụm từ của bạn vượt quá ${game.maxWords} từ cho phép.`, quote: message },
      threadId,
      message.type
    );
    activeGames.delete(threadId);
    return;
  }

  if (!game.botTurn) {
    if (game.lastPhrase === "" || cleanContentTrim.startsWith(game.lastPhrase.split(/\s+/).pop())) {
      game.lastPhrase = cleanContentTrim;
      game.players.add(message.data.uidFrom);
      game.botTurn = true;

      const botPhrase = await findNextPhrase(game.lastPhrase);
      if (botPhrase) {
        game.lastPhrase = botPhrase;
        await api.sendMessage(
          {
            msg: `Bot: ${botPhrase}\nCụm từ tiếp theo phải bắt đầu bằng "${botPhrase.split(/\s+/).pop()}".`,
            quote: message,
          },
          threadId,
          message.type
        );
        game.botTurn = false;
      } else {
        await api.sendMessage(
          { msg: "Bot Không tìm được cụm từ phù hợp. Bạn thắng!", quote: message },
          threadId,
          message.type
        );
        activeGames.delete(threadId);
      }
    } else {
      await api.sendMessage(
        {
          msg: `Cụm từ Không hợp lệ! Cụm từ phải bắt đầu bằng "${game.lastPhrase.split(/\s+/).pop()}".`,
          quote: message,
        },
        threadId,
        message.type
      );
    }
  } else {
    game.botTurn = false;
  }

  if (game.players.size >= 10) {
    await api.sendMessage(
      { msg: "Trò chơi kết thúc! Cảm ơn mọi người đã tham gia.", quote: message },
      threadId,
      message.type
    );
    activeGames.delete(threadId);
  }
}

async function findNextPhrase(lastPhrase) {
  try {
    const encodedWord = encodeURIComponent(lastPhrase);
    const response = await axios.get(
      `https://api.hungdev.id.vn/games/word-chain?apikey=${API_KEY_HOANGDEV}&word=${encodedWord}`
    );

    if (response.data.success && response.data.data.success) {
      return response.data.data.nextWord.text;
    }
    return null;
  } catch (error) {
    console.error("Lỗi khi gọi API nối từ:", error);
    return null;
  }
}
