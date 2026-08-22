import { MessageType } from "zlbotdqt";
import Big from "big.js";
import {
  claimDailyReward,
  getTopPlayers,
  getMyCard,
  isHaveLoginAccount,
  banPlayer,
  unbanPlayer,
  isPlayerBanned,
  login,
  registerAccount,
  logout,
  connection,
} from "../../database/index.js";
import { getPlayerBalance, updatePlayerBalance, getPlayerInfo, getAccountVND, updateAccountVND } from "../../database/player.js";
import { sendMessageFromSQL } from "../../service-debug/chat-zalo/chat-style/chat-style.js";
import * as cv from "../../utils/canvas/index.js";
import { isAdmin } from "../../index.js";
import { getGlobalPrefix } from "../service.js";
import { formatBigNumber, formatCurrency, parseGameAmount, removeMention } from "../../utils/format-util.js";
import { sendReactionConfirmReceive } from "../../commands/command.js";

export async function checkBeforeJoinGame(api, message, groupSettings, checkLogin = false) {

  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const isAdminBot = isAdmin(senderId, threadId);

  if (!connection) {
    if (isAdminBot) {
      const text =
        "Cơ sở dữ liệu chưa được khởi động,\n" +
        "vui lòng kết nối với cơ sở dữ liệu và khởi động lại bot rồi thử lại!";
      const result = {
        success: false,
        message: text,
      };
      await sendMessageFromSQL(api, message, result, true, 30000);
      return false;
    }
  }

  if (groupSettings) {
    const activeGame = groupSettings[threadId].activeGame;
    const isAdminLevelHighest = isAdmin(senderId);
    if (isAdminLevelHighest) {
      await sendReactionConfirmReceive(api, message, 5);
      return true;
    }
    if (activeGame === false) {
      let text = "";
      if (isAdminBot) {
        text =
          "Trò chơi hiện tại Không được bật trong nhóm này.\n\n" +
          "Quản trị viên hãy dùng lệnh !gameactive để bật tương tác game cho nhóm!";
        const result = {
          success: false,
          message: text,
        };
        await sendMessageFromSQL(api, message, result, true, 30000);
      }
      return false;
    }
  }

  if (await checkPlayerBanned(api, message, threadId, senderId)) {
    return false;
  }

  if (checkLogin) {
    if (!(await checkPlayerLogin(api, message, threadId, senderId))) {
      return false;
    }
  }

  await sendReactionConfirmReceive(api, message, 5);
  return true;
}

export async function handleClaimDailyReward(api, message, groupSettings) {
  if (!(await checkBeforeJoinGame(api, message, groupSettings, true))) return;

  const senderId = message.data.uidFrom;
  const result = await claimDailyReward(senderId);
  await sendMessageFromSQL(api, message, result, true, 30000);
}

export async function handleTopPlayers(api, message, groupSettings) {
  if (!(await checkBeforeJoinGame(api, message, groupSettings))) return;

  const threadId = message.threadId;
  const topPlayers = await getTopPlayers();
  let msg = "🏆 Top 10 người chơi giàu nhất 🏆\n\n";

  if (topPlayers.length === 0) {
    msg += "Hiện chưa có dữ liệu xếp hạng.";
  } else {
    let idx = 0;
    topPlayers.forEach((player) => {
      if (!isAdmin(player.idUser)) {
        if (idx < 10) {
          msg += `${++idx}. ${player.playerName}: ${formatCurrency(player.balance)} VNĐ\n`;
        }
      }
    });
  }

  await api.sendMessage({ msg: msg, quote: message, ttl: 300000 }, threadId, message.type);
}

export async function handleMyCard(api, message, groupSettings) {
  if (!(await checkBeforeJoinGame(api, message, groupSettings, true))) return;

  const senderId = message.data.uidFrom;
  const threadId = message.threadId;
  const result = await getMyCard(api, senderId);
  if (result.success) {
    const playerInfo = result.data;
    playerInfo.title = "Thông Tin Người Chơi";
    let msg = `🎴 Thông tin của bạn 🎴\n\n`;
    msg += `👤 Tên: ${playerInfo.playerName}\n`;
    msg += `💰 Số dư: ${formatCurrency(playerInfo.balance)} VNĐ\n`;
    msg += `🏆 Tổng Thắng: ${formatCurrency(playerInfo.totalWinnings)} VNĐ\n`;
    msg += `💸 Tổng Thua: ${formatCurrency(playerInfo.totalLosses)} VNĐ\n`;
    msg += `💹 Lợi Nhuận Ròng: ${formatCurrency(playerInfo.netProfit)} VNĐ\n`;
    msg += `🎮 Tổng Số Lượt Chơi: ${playerInfo.totalGames}\n`;
    msg += `📊 Tỉ Lệ Thắng: ${playerInfo.winRate}%\n`;
    msg += `📅 Ngày Đăng Ký: ${playerInfo.registrationTime}\n`;
    msg += `🎁 Nhận Quà Mỗi Ngày: ${playerInfo.lastDailyReward}`;

    const imagePath = await cv.createUserCardGame(playerInfo);
    await api.sendMessage({ msg: "", attachments: imagePath ? [imagePath] : [] }, threadId, message.type);
    await cv.clearImagePath(imagePath);
  } else {
    await api.sendMessage({ msg: result.message, quote: message }, threadId, message.type);
  }
}

export async function handleBuffCommand(api, message, groupSettings) {
  const senderId = message.data.uidFrom;
  if (!isAdmin(senderId)) {
    return;
  }

  const mentions = message.data.mentions || [];
  let content = removeMention(message);
  const contentParts = content.split(" ");
  let buffAmount;
  try {
    const parsedAmount = parseGameAmount(contentParts[1], Number.MAX_SAFE_INTEGER);
    if (parsedAmount === "allin") {
      const result = {
        success: false,
        message: `Không thể sử dụng all/allin cho lệnh buff.`,
      };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }
    buffAmount = new Big(parsedAmount);
  } catch (error) {
    const result = {
      success: false,
      message: "Số tiền Không hợp lệ.",
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  if (buffAmount.lte(0)) {
    const result = {
      success: false,
      message: `Số tiền Không hợp lệ.`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  if (!mentions || mentions.length === 0) {
    if (await isHaveLoginAccount(senderId)) {
      // Lấy số dư hiện tại
      const currentBalance = await getPlayerBalance(senderId);
      const oldBalance = new Big(currentBalance.balance);

      // Thực hiện buff
      await updatePlayerBalance(senderId, buffAmount);

      // Tính số dư mới
      const newBalance = oldBalance.plus(buffAmount);

      const result = {
        success: true,
        message:
          `🔄 Buff tiền thành công!\n\n` +
          `💰 Số tiền buff: ${formatBigNumber(buffAmount)} VNĐ\n\n` +
          `📊 Biến động số dư:\n` +
          `- Trước: ${formatBigNumber(oldBalance)} VNĐ\n` +
          `- Sau: ${formatBigNumber(newBalance)} VNĐ`,
      };
      await sendMessageFromSQL(api, message, result, true, 300000);
    } else {
      const result = {
        success: false,
        message: `Bạn chưa đăng nhập tài khoản để buff cho bản thân!`,
      };
      await sendMessageFromSQL(api, message, result, true, 300000);
    }
    return;
  }

  let successMessages = [];
  let failureMessages = [];

  for (const mention of mentions) {
    const targetId = mention.uid;
    const targetName = message.data.content.substring(mention.pos, mention.pos + mention.len).replace("@", "");

    if (await isHaveLoginAccount(targetId)) {
      // Lấy số dư hiện tại của người được buff
      const currentBalance = await getPlayerBalance(targetId);
      const oldBalance = new Big(currentBalance.balance);

      // Thực hiện buff
      await updatePlayerBalance(targetId, buffAmount);

      // Tính số dư mới
      const newBalance = oldBalance.plus(buffAmount);

      successMessages.push(
        `✅ ${targetName}:\n` +
        `- Buff: +${formatBigNumber(buffAmount)} VNĐ\n` +
        `- Trước: ${formatBigNumber(oldBalance)} VNĐ\n` +
        `- Sau: ${formatBigNumber(newBalance)} VNĐ`
      );
    } else {
      failureMessages.push(`❌ ${targetName}: chưa đăng ký tài khoản.`);
    }
  }

  let finalMessage = `🔄 Kết quả buff tiền:\n`;
  if (successMessages.length > 0) {
    finalMessage += "\n✅ Thành công:\n" + successMessages.join("\n\n") + "\n";
  }
  if (failureMessages.length > 0) {
    finalMessage += "\n❌ Thất bại:\n" + failureMessages.join("\n");
  }

  const result = {
    success: true,
    message: finalMessage,
  };
  await sendMessageFromSQL(api, message, result, false, 300000);
}

export async function handleBankCommand(api, message, groupSettings) {
  if (!(await checkBeforeJoinGame(api, message, groupSettings, true))) return;

  const senderId = message.data.uidFrom;
  // if (!(await isPlayerActive(senderId))) {
  //   const result = {
  //     success: false,
  //     message: `Bạn cần mở thành viên để có thể chuyển tiền cho người khác.`,
  //   };
  //   await sendMessageFromSQL(api, message, result);
  //   return;
  // }

  const mentions = message.data.mentions;
  if (!mentions || mentions.length === 0) {
    const result = {
      success: false,
      message: `Vui lòng đề cập (@mention) người dùng cần chuyển tiền!`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  // Lấy số dư người gửi trước
  const requestData = await getPlayerBalance(senderId);
  if (!requestData.success) {
    await sendMessageFromSQL(api, message, requestData, true, 300000);
    return;
  }

  // Sau đó mới parse số tiền
  let content = removeMention(message);
  const amount = content.split(" ")[1];
  let bankAmount;
  try {
    const parsedAmount = parseGameAmount(amount, requestData.balance);
    if (parsedAmount === "allin") {
      bankAmount = new Big(requestData.balance);
    } else {
      bankAmount = parsedAmount;
    }

    if (bankAmount.lt(1000)) {
      const result = {
        success: false,
        message: `Số tiền chuyển tối thiểu là 1,000 VNĐ`,
      };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }
  } catch (error) {
    const result = {
      success: false,
      message: error.message,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  // Kiểm tra số dư
  if (new Big(requestData.balance).lt(bankAmount)) {
    const result = {
      success: false,
      message: `Số dư Không đủ. Bạn chỉ có ${formatBigNumber(new Big(requestData.balance))} VNĐ.`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  const targetId = mentions[0].uid;
  const targetName = message.data.content.substring(mentions[0].pos, mentions[0].pos + mentions[0].len).replace("@", "");

  if (await isPlayerBanned(targetId)) {
    const result = {
      success: false,
      message: `${targetName} đã bị khóa tài khoản, Không thể chuyển tiền cho người dùng này.`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  if (await isHaveLoginAccount(targetId)) {
    // Lấy số dư hiện tại của người gửi và người nhận
    const senderBalance = new Big(requestData.balance);
    const receiverData = await getPlayerBalance(targetId);
    const receiverBalance = new Big(receiverData.balance);

    // Thực hiện chuyển tiền
    await updatePlayerBalance(senderId, -bankAmount);
    await updatePlayerBalance(targetId, bankAmount);

    // Tính toán số dư mới
    const newSenderBalance = senderBalance.minus(bankAmount);
    const newReceiverBalance = receiverBalance.plus(bankAmount);

    const result = {
      success: true,
      message:
        `🔄 Giao dịch chuyển tiền thành công!\n\n` +
        `💰 Số tiền chuyển: ${formatBigNumber(new Big(bankAmount))} VNĐ\n\n` +
        `📊 Biến động số dư:\n` +
        `👤 Người gửi:\n` +
        `- Trước: ${formatBigNumber(senderBalance)} VNĐ\n` +
        `- Sau: ${formatBigNumber(newSenderBalance)} VNĐ\n\n` +
        `👥 Người nhận (${targetName}):\n` +
        `- Trước: ${formatBigNumber(receiverBalance)} VNĐ\n` +
        `- Sau: ${formatBigNumber(newReceiverBalance)} VNĐ`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
  } else {
    const result = {
      success: false,
      message: `${targetName} chưa đăng nhập bất kỳ tài khoản nào.`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
  }
}

export async function handleBanCommand(api, message, groupSettings) {
  const senderId = message.data.uidFrom;
  const threadId = message.threadId;

  if (!isAdmin(senderId, threadId)) {
    const result = {
      success: false,
      message: `Bạn Không có quyền sử dụng lệnh này.`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  const mentions = message.data.mentions;
  if (!mentions || mentions.length === 0) {
    const result = {
      success: false,
      message: `Vui lòng đề cập (@mention) người dùng cần ban.`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  for (const mention of mentions) {
    const targetId = mention.uid;
    const targetName = message.data.content.substring(mention.pos, mention.pos + mention.len).replace("@", "");

    if (isAdmin(targetId, threadId)) {
      const result = {
        success: false,
        message: `${targetName} là quản trị viên, Không thể khóa tài khoản được.`,
      };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }

    if (await isHaveLoginAccount(targetId)) {
      if (await isPlayerBanned(targetId)) {
        const result = {
          success: false,
          message: `${targetName} đã bị khóa tài khoản.`,
        };
        await sendMessageFromSQL(api, message, result, true, 300000);
        return;
      } else {
        await banPlayer(targetId);
        const result = {
          success: true,
          message: `Đã khóa tài khoản của ${targetName} khỏi hệ thống game.`,
        };
        await sendMessageFromSQL(api, message, result, true, 300000);
      }
    } else {
      const result = {
        success: false,
        message: `${targetName} chưa đăng ký tài khoản.`,
      };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }
  }
}

export async function handleUnbanCommand(api, message, groupSettings) {
  const senderId = message.data.uidFrom;
  const threadId = message.threadId;

  if (!isAdmin(senderId, threadId)) {
    const result = {
      success: false,
      message: `Bạn Không có quyền sử dụng lệnh này.`,
    };
    await sendMessageFromSQL(api, message, result);
    return;
  }

  const mentions = message.data.mentions;
  if (!mentions || mentions.length === 0) {
    const result = {
      success: false,
      message: `Vui lòng đề cập (@mention) người dùng cần mở khóa tài khoản.`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  for (const mention of mentions) {
    const targetId = mention.uid;
    const targetName = message.data.content.substring(mention.pos, mention.pos + mention.len).replace("@", "");

    if (await isHaveLoginAccount(targetId)) {
      if (await isPlayerBanned(targetId)) {
        await unbanPlayer(targetId);
        const result = {
          success: true,
          message: `Đã unban ${targetName}, người chơi có thể tham gia lại các trò chơi.`,
        };
        await sendMessageFromSQL(api, message, result, true, 300000);
      } else {
        const result = {
          success: false,
          message: `${targetName} Không bị khóa tài khoản.`,
        };
        await sendMessageFromSQL(api, message, result, true, 300000);
      }
    } else {
      const result = {
        success: false,
        message: `${targetName} chưa đăng ký tài khoản.`,
      };
      await sendMessageFromSQL(api, message, result, true, 300000);
    }
  }
}

export async function checkPlayerBanned(api, message, threadId, senderId) {
  if (await isPlayerBanned(senderId)) {
    const result = {
      success: false,
      message: `Tài khoản của bạn đã bị khóa, Không thể thực hiện bất kỳ lệnh game nào nữa!`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return true;
  }
  return false;
}

export async function checkPlayerLogin(api, message, threadId, senderId) {
  if (!(await isHaveLoginAccount(senderId))) {
    const prefix = getGlobalPrefix(threadId);
    const result = {
      success: false,
      message: `Bạn chưa đăng nhập tài khoản game trên zalo này, vui lòng sử dụng lệnh ${prefix}game để xem hướng dẫn.`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return false;
  }
  return true;
}

export async function handleLoginPlayer(api, message, groupSettings) {
  if (!(await checkBeforeJoinGame(api, message, groupSettings))) return;

  if (message.type === MessageType.GroupMessage) {
    await api.deleteMessage(message, false).catch(console.error);
    const result = {
      success: false,
      message: `Vì lý do bảo mật, bạn Không thể đăng nhập tài khoản trong nhóm!\nVui lòng nhắn riêng cho tôi để đăng nhập tài khoản.`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  const senderName = message.data.dName;
  const senderId = message.data.uidFrom;

  if (await isHaveLoginAccount(senderId)) {
    const result = {
      success: false,
      message: `Bạn đã đăng nhập tài khoản game trên zalo này!.`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  const content = removeMention(message);
  const parts = content.split(" ");

  if (parts.length !== 3) {
    const result = {
      success: false,
      message: `Vui lòng sử dụng lệnh đúng cú pháp:\n!login [tên đăng nhập] [mật khẩu].`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  const username = parts[1];
  const password = parts[2];
  const result = await login(username, password, senderId, senderName, api);

  await sendMessageFromSQL(api, message, result, true, 300000);
}

export async function handleRegisterPlayer(api, message, groupSettings) {
  if (!(await checkBeforeJoinGame(api, message, groupSettings))) return;
  const senderId = message.data.uidFrom;

  const content = removeMention(message);
  const parts = content.split(" ");
  const senderName = message.data.dName;

  if (await isHaveLoginAccount(senderId)) {
    const result = {
      success: false,
      message: `Bạn đã đăng nhập tài khoản game trên zalo này, Không thể đăng ký tài khoản mới.`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  if (message.type === MessageType.GroupMessage) {
    await api.deleteMessage(message, false).catch(console.error);
    const result = {
      success: false,
      message: `Vì lý do bảo mật, bạn Không thể đăng ký tài khoản trong nhóm!\nVui lòng nhắn riêng cho tôi để đăng ký tài khoản.`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  if (parts.length !== 3) {
    const result = {
      success: false,
      message: `Vui lòng sử dụng lệnh đúng cú pháp:\n!dangky [tên đăng ký] [mật khẩu].`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  const username = parts[1];
  const password = parts[2];

  let result = await registerAccount(username, password);

  await sendMessageFromSQL(api, message, result, true, 300000);

  if (result.success) {
    result = await login(username, password, senderId, senderName, api);
    await sendMessageFromSQL(api, message, result, true, 300000);
  }
}

export async function handleLogoutPlayer(api, message, groupSettings) {
  if (!(await checkBeforeJoinGame(api, message, groupSettings, true))) return;
  const senderId = message.data.uidFrom;
  const result = await logout(senderId);
  await sendMessageFromSQL(api, message, result, true, 300000);
}

// Hàm xử lý lệnh nạp tiền
export async function handleNapCommand(api, message, groupSettings) {
  try {
    if (!(await checkBeforeJoinGame(api, message, groupSettings, true))) return;

    const senderId = message.data.uidFrom;
    const content = removeMention(message);
    const parts = content.split(" ");

    if (parts.length !== 2) {
      const result = {
        success: false,
        message: `Vui lòng sử dụng lệnh đúng cú pháp:\n!nap [Số Tiền/10%/100k/1m/1b]`,
      };
      await sendMessageFromSQL(api, message, result, true, 30000);
      return;
    }

    // Lấy thông tin người chơi từ bảng player_zalo
    const playerInfo = await getPlayerInfo(senderId);
    if (!playerInfo) {
      const result = {
        success: false,
        message: `Không tìm thấy thông tin tài khoản.`,
      };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }

    // Lấy số dư VND từ bảng account
    const accountVND = await getAccountVND(playerInfo.username);
    if (accountVND === null) {
      const result = {
        success: false,
        message: `Không thể lấy thông tin số dư VND từ tài khoản game ${playerInfo.username}.`,
      };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }

    const accountBalance = new Big(accountVND);

    // Parse số tiền sau khi đã có accountBalance
    let napAmount;
    try {
      const parsedAmount = parseGameAmount(parts[1], accountBalance);
      if (parsedAmount === "allin") {
        napAmount = accountBalance;
      } else {
        napAmount = parsedAmount;
      }

      if (napAmount.lt(20000)) {
        const result = {
          success: false,
          message: `Số tiền nạp tối thiểu là 20,000 VNĐ.`,
        };
        await sendMessageFromSQL(api, message, result, true, 300000);
        return;
      }
    } catch (error) {
      const result = {
        success: false,
        message: error.message,
      };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }

    if (accountBalance.lt(napAmount)) {
      const result = {
        success: false,
        message: `Số dư VND trong tài khoản ${playerInfo.username} chỉ có ${formatBigNumber(accountBalance)} VNĐ.`,
      };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }

    const oldAccountBalance = accountBalance;
    const oldBotBalance = new Big(playerInfo.balance);

    // Cập nhật số dư trong game
    const gameAmount = napAmount;
    await updatePlayerBalance(senderId, gameAmount.toNumber());
    // Cập nhật số dư VND trong account
    await updateAccountVND(playerInfo.username, napAmount.neg().toNumber());

    const newAccountBalance = oldAccountBalance.minus(napAmount);
    const newBotBalance = oldBotBalance.plus(gameAmount);

    const result = {
      success: true,
      message:
        `🔄 Giao dịch nạp tiền thành công!\n\n` +
        `💰 Số tiền nạp: ${formatBigNumber(napAmount)} VNĐ\n\n` +
        `📊 Biến động số dư:\n` +
        `🎮 Tài khoản ${playerInfo.username}:\n` +
        `- Trước: ${formatBigNumber(oldAccountBalance)} VNĐ\n` +
        `- Sau: ${formatBigNumber(newAccountBalance)} VNĐ\n\n` +
        `🤖 Tài khoản Bot Zalo:\n` +
        `- Trước: ${formatBigNumber(oldBotBalance)} VNĐ\n` +
        `- Sau: ${formatBigNumber(newBotBalance)} VNĐ`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
  } catch (error) {
    console.error("Lỗi khi xử lý lệnh nạp:", error);
    const result = {
      success: false,
      message: `Đã xảy ra lỗi khi xử lý lệnh nạp!`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
  }
}

// Hàm xử lý lệnh rút tiền
export async function handleRutCommand(api, message, groupSettings) {
  try {
    if (!(await checkBeforeJoinGame(api, message, groupSettings, true))) return;

    const senderId = message.data.uidFrom;
    const content = removeMention(message);
    const parts = content.split(" ");

    if (parts.length !== 2) {
      const result = {
        success: false,
        message: `Vui lòng sử dụng lệnh đúng cú pháp:\n!rut [Số Tiền/10%/100k/1m/1b]`,
      };
      await sendMessageFromSQL(api, message, result, true, 30000);
      return;
    }

    // Lấy thông tin người chơi từ bảng player_zalo trước
    const playerInfo = await getPlayerInfo(senderId);
    if (!playerInfo) {
      const result = {
        success: false,
        message: `Không tìm thấy thông tin tài khoản.`,
      };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }

    // Lấy số dư hiện tại
    const currentBotBalance = new Big(playerInfo.balance);
    const accountVND = await getAccountVND(playerInfo.username);
    const currentAccountBalance = new Big(accountVND);

    // Parse số tiền sau khi đã có currentBotBalance
    let rutAmount;
    try {
      const parsedAmount = parseGameAmount(parts[1], currentBotBalance);
      if (parsedAmount === "allin") {
        rutAmount = currentBotBalance;
      } else {
        rutAmount = parsedAmount;
      }

      if (rutAmount.lt(20000)) {
        const result = {
          success: false,
          message: `Số tiền rút tối thiểu là 20,000 VNĐ.`,
        };
        await sendMessageFromSQL(api, message, result, true, 300000);
        return;
      }
    } catch (error) {
      const result = {
        success: false,
        message: error.message,
      };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }

    // Kiểm tra số dư
    if (currentBotBalance.lt(rutAmount)) {
      const result = {
        success: false,
        message: `Số dư trong tài khoản bot Không đủ để rút ${formatBigNumber(rutAmount)} VNĐ về tài khoản ${playerInfo.username}!`,
      };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }

    // Cập nhật số dư trong game
    await updatePlayerBalance(senderId, rutAmount.neg().toNumber());
    // Cập nhật số dư VND trong account
    await updateAccountVND(playerInfo.username, rutAmount.toNumber());

    const newBotBalance = currentBotBalance.minus(rutAmount);
    const newAccountBalance = currentAccountBalance.plus(rutAmount);

    const result = {
      success: true,
      message:
        `🔄 Giao dịch rút tiền thành công!\n\n` +
        `💰 Số tiền rút: ${formatBigNumber(rutAmount)} VNĐ\n\n` +
        `📊 Biến động số dư:\n` +
        `🤖 Tài khoản Bot Zalo:\n` +
        `- Trước: ${formatBigNumber(currentBotBalance)} VNĐ\n` +
        `- Sau: ${formatBigNumber(newBotBalance)} VNĐ\n\n` +
        `🎮 Tài khoản ${playerInfo.username}:\n` +
        `- Trước: ${formatBigNumber(currentAccountBalance)} VNĐ\n` +
        `- Sau: ${formatBigNumber(newAccountBalance)} VNĐ`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
  } catch (error) {
    console.error("Lỗi khi xử lý lệnh rút:", error);
    const result = {
      success: false,
      message: `Đã xảy ra lỗi khi xử lý lệnh rút!`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
  }
}
