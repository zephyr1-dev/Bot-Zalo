import { connection, NAME_TABLE_PLAYERS, nameServer, NAME_TABLE_ACCOUNT, DAILY_REWARD } from "./index.js";
import { getUserInfoData } from "../service-debug/info-service/user-info.js";
import { getTimeToString, getTimeNow, formatBigNumber } from "../utils/format-util.js";
import fs from "fs/promises";
import path from "path";
import { Big } from "big.js";
import { managerData } from "../commands/bot-manager/active-bot.js";

const loginAttempts = {};

async function isUserBlocked(idUserZalo) {
  const blockData = managerData.data.blockLogin;
  return Array.isArray(blockData) && blockData.some((user) => user.idUserZalo === idUserZalo);
}

async function blockUser(idUserZalo, senderName) {
  const blockData = managerData.data.blockLogin;
  blockData.push({ idUserZalo, senderName });
  managerData.hasChanges = true;
  delete loginAttempts[idUserZalo];
}

export async function login(username, password, idUserZalo, senderName, api) {
  try {
    if (await isUserBlocked(idUserZalo)) {
      return {
        success: false,
        message: `Tài khoản của bạn đã bị khóa do nhập sai thông tin quá nhiều lần.`,
      };
    }

    loginAttempts[idUserZalo] = loginAttempts[idUserZalo] || 0;

    if (loginAttempts[idUserZalo] >= 5) {
      await blockUser(idUserZalo, senderName);
      return {
        success: false,
        message: `Bạn đã nhập sai thông tin đăng nhập quá 5 lần. Tài khoản của bạn đã bị khóa.`,
      };
    }

    const [accountRows] = await connection.execute(`SELECT username FROM ${NAME_TABLE_ACCOUNT} WHERE username = ? AND password = ?`, [
      username,
      password,
    ]);

    if (accountRows.length === 0) {
      loginAttempts[idUserZalo]++;
      return {
        success: false,
        message: `Tên đăng nhập hoặc mật khẩu Không đúng. ${
          5 - loginAttempts[idUserZalo] === 0 ? "Bạn đã bị khóa đăng nhập!" : `Bạn còn ${5 - loginAttempts[idUserZalo]} lần thử.`
        }`,
      };
    }

    delete loginAttempts[idUserZalo];

    const accountUsername = accountRows[0].username;

    const [existingLoginRows] = await connection.execute(`SELECT username FROM ${NAME_TABLE_PLAYERS} WHERE idUserZalo = ?`, [idUserZalo]);

    if (existingLoginRows.length > 0) {
      let msg;
      if (existingLoginRows[0].username === accountUsername) {
        msg = `Bạn đang đăng nhập tài khoản ${existingLoginRows[0].username} rồi.`;
      } else {
        msg = `Bạn đã đăng nhập tài khoản ${existingLoginRows[0].username}. Vui lòng đăng xuất trước khi đăng nhập tài khoản mới.`;
      }

      return {
        success: false,
        message: msg,
      };
    }

    const [playerRows] = await connection.execute(`SELECT idUserZalo, playerName FROM ${NAME_TABLE_PLAYERS} WHERE username = ?`, [
      accountUsername,
    ]);

    if (playerRows.length === 0) {
      await connection.execute(
        `INSERT INTO ${NAME_TABLE_PLAYERS} (username, idUserZalo, playerName, registrationTime) VALUES (?, ?, ?, NOW())`,
        [accountUsername, idUserZalo, senderName]
      );
      return { success: true, message: `Đã đăng nhập lần đầu thành công. Bạn được tặng 10,000 VNĐ.` };
    } else if (playerRows[0].idUserZalo === "-1") {
      await connection.execute(`UPDATE ${NAME_TABLE_PLAYERS} SET idUserZalo = ? WHERE username = ?`, [idUserZalo, accountUsername]);
      return { success: true, message: `Đăng nhập thành công.` };
    } else {
      const userInfo = await getUserInfoData(api, playerRows[0].idUserZalo);
      const zaloName = userInfo.name || "Người dùng khác";
      return { success: false, message: `Tài khoản đã đăng nhập bởi Zalo của '${zaloName}'.` };
    }
  } catch (error) {
    console.error("Lỗi khi đăng nhập:", error);
    return { success: false, message: `Đã xảy ra lỗi khi đăng nhập.` };
  }
}

export async function logout(idUserZalo) {
  try {
    const [result] = await connection.execute(`UPDATE ${NAME_TABLE_PLAYERS} SET idUserZalo = '-1' WHERE idUserZalo = ?`, [idUserZalo]);

    if (result.affectedRows === 0) {
      return { success: false, message: `${nameServer}: Bạn chưa đăng nhập bất kỳ tài khoản nào!` };
    }

    return { success: true, message: `${nameServer}: Đã đăng xuất thành công!` };
  } catch (error) {
    console.error("Lỗi khi đăng xuất:", error);
    return { success: false, message: `${nameServer}: Đã xảy ra lỗi khi đăng xuất!` };
  }
}

export async function isHaveLoginAccount(idUserZalo) {
  try {
    const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM ${NAME_TABLE_PLAYERS} WHERE idUserZalo = ?`, [idUserZalo]);
    return rows[0].count > 0;
  } catch (error) {
    console.error("Lỗi khi kiểm tra trạng thái đăng nhập của người chơi:", error);
    throw error;
  }
}

export async function banPlayer(idUserZalo) {
  try {
    await connection.execute(`UPDATE ${NAME_TABLE_PLAYERS} SET isBanned = 1 WHERE idUserZalo = ?`, [idUserZalo]);
    return { success: true, message: `${nameServer}: Người chơi đã bị ban thành công!` };
  } catch (error) {
    console.error("Lỗi khi ban người chơi:", error);
    return { success: false, message: `${nameServer}: Đã xảy ra lỗi khi ban người chơi!` };
  }
}

export async function unbanPlayer(idUserZalo) {
  try {
    await connection.execute(`UPDATE ${NAME_TABLE_PLAYERS} SET isBanned = 0 WHERE idUserZalo = ?`, [idUserZalo]);
    return { success: true, message: `${nameServer}: Đã gỡ ban người chơi thành công!` };
  } catch (error) {
    console.error("Lỗi khi unban người chơi:", error);
    return { success: false, message: `${nameServer}: Đã xảy ra lỗi khi gỡ ban người chơi!` };
  }
}

export async function isPlayerBanned(idUserZalo) {
  try {
    const [rows] = await connection.execute(`SELECT isBanned FROM ${NAME_TABLE_PLAYERS} WHERE idUserZalo = ?`, [idUserZalo]);
    return rows.length > 0 && rows[0].isBanned === 1;
  } catch (error) {
    console.error("Lỗi khi kiểm tra trạng thái ban của người chơi:", error);
    throw error;
  }
}

export async function isPlayerActive(idUserZalo) {
  try {
    const [existingLoginRows] = await connection.execute(`SELECT username FROM ${NAME_TABLE_PLAYERS} WHERE idUserZalo = ?`, [idUserZalo]);

    if (existingLoginRows.length === 0) {
      return false;
    }

    const [rows] = await connection.execute(`SELECT active FROM ${NAME_TABLE_ACCOUNT} WHERE username = ?`, [existingLoginRows[0].username]);
    return rows.length > 0 && rows[0].active === 1;
  } catch (error) {
    console.error("Lỗi khi kiểm tra trạng thái bật của người chơi:", error);
    throw error;
  }
}

export async function claimDailyReward(idUser) {
  try {
    const [rows] = await connection.execute(`SELECT * FROM ${NAME_TABLE_PLAYERS} WHERE idUserZalo = ?`, [idUser]);

    if (rows.length === 0) {
      return { success: false, message: `Bạn chưa đăng nhập tài khoản nào.` };
    }

    const player = rows[0];
    const now = getTimeNow();
    const lastReward = player.lastDailyReward ? new Date(player.lastDailyReward) : null;

    if (
      lastReward &&
      lastReward.getDate() === now.getDate() &&
      lastReward.getMonth() === now.getMonth() &&
      lastReward.getFullYear() === now.getFullYear()
    ) {
      const registrationTime = getTimeToString(lastReward);
      return {
        success: false,
        message: `Bạn đã nhận quà hôm nay lúc ${registrationTime}. Hãy quay lại vào ngày mai!`,
      };
    }

    const rewardAmount = new Big(DAILY_REWARD);
    const currentBalance = new Big(player.balance);
    const newBalance = currentBalance.plus(rewardAmount);

    const [updateResult] = await connection.execute(
      `UPDATE ${NAME_TABLE_PLAYERS} SET balance = ?, lastDailyReward = ? WHERE idUserZalo = ?`,
      [newBalance.toString(), now, idUser]
    );

    if (updateResult.affectedRows === 1) {
      return {
        success: true,
        message: `Bạn đã nhận ${formatBigNumber(rewardAmount)} VNĐ. Hãy quay lại vào ngày mai để nhận thêm!`,
      };
    } else {
      return { success: false, message: `Có lỗi xảy ra khi nhận quà.` };
    }
  } catch (error) {
    console.error("Lỗi khi nhận quà hàng ngày:", error);
    return { success: false, message: `Đã xảy ra lỗi khi nhận quà.` };
  }
}

export async function getMyCard(api, idUser) {
  try {
    const [rows] = await connection.execute(`SELECT * FROM ${NAME_TABLE_PLAYERS} WHERE idUserZalo = ?`, [idUser]);

    if (rows.length === 0) {
      return {
        success: false,
        message: `${nameServer}: Chưa có thông tin, vui lòng kiểm tra lại thông tin đăng nhập.\nDùng lệnh game để xem hướng dẫn. ❌`,
      };
    }

    const player = rows[0];
    const dataPlayerZalo = await getUserInfoData(api, idUser);

    const totalWinnings = new Big(player.totalWinnings);
    const totalLosses = new Big(player.totalLosses);
    const netProfit = totalWinnings.plus(totalLosses);
    const balance = new Big(player.balance);
    const winRate = player.totalGames > 0 ? new Big(player.totalWinGames).div(player.totalGames).times(100) : new Big(0);

    const now = getTimeNow();
    const lastReward = player.lastDailyReward ? new Date(player.lastDailyReward) : null;
    let lastDailyReward = "Chưa nhận quà";
    if (
      lastReward &&
      lastReward.getDate() === now.getDate() &&
      lastReward.getMonth() === now.getMonth() &&
      lastReward.getFullYear() === now.getFullYear()
    ) {
      lastDailyReward = getTimeToString(lastReward);
    }

    const playerInfo = {
      account: player.username,
      idUser: player.idUserZalo,
      playerName: player.playerName,
      balance: balance.toString(),
      registrationTime: getTimeToString(player.registrationTime),
      totalWinnings: totalWinnings.toString(),
      totalLosses: totalLosses.toString(),
      netProfit: netProfit.toString(),
      totalWinGames: player.totalWinGames,
      totalGames: player.totalGames,
      winRate: formatWinRate(winRate),
      lastDailyReward: lastDailyReward,
      ...dataPlayerZalo,
    };

    return { success: true, data: playerInfo };
  } catch (error) {
    console.error("Lỗi khi lấy thông tin người chơi:", error);
    return { success: false, message: `${nameServer}: Đã xảy ra lỗi khi lấy thông tin. ❌` };
  }
}

function formatWinRate(winRate) {
  if (winRate.eq(100)) return "100";
  if (winRate.eq(0)) return "0";
  return winRate.toFixed(1).replace(/\.0$/, "");
}

export async function setLoserGame(idUser, amount) {
  try {
    const [playerRows] = await connection.execute(`SELECT balance FROM ${NAME_TABLE_PLAYERS} WHERE idUserZalo = ?`, [idUser]);
    if (playerRows.length === 0) {
      return { success: false, message: `${nameServer}: Không tìm thấy người chơi. ❌` };
    }

    let query = `UPDATE ${NAME_TABLE_PLAYERS} SET 
      totalLosses = totalLosses + ?,
      totalGames = totalGames + 1
      WHERE idUserZalo = ?`;
    const [result] = await connection.execute(query, [new Big(amount).neg().toString(), idUser]);

    if (result.affectedRows === 1) {
      return { success: true, message: `${nameServer}: Cập nhật lượt thua thành công. ✅` };
    } else {
      return { success: false, message: `${nameServer}: Cập nhật lượt thua thất bại. ❌` };
    }
  } catch (error) {
    console.error("Lỗi khi cập nhật lượt thua:", error);
    return { success: false, message: `${nameServer}: Đã xảy ra lỗi khi cập nhật lượt thua. ❌` };
  }
}

export async function setLoserGameByUsername(username, amount) {
  try {
    const [playerRows] = await connection.execute(`SELECT balance FROM ${NAME_TABLE_PLAYERS} WHERE username = ?`, [username]);
    if (playerRows.length === 0) {
      return { success: false, message: `${nameServer}: Không tìm thấy người chơi. ❌` };
    }

    let query = `UPDATE ${NAME_TABLE_PLAYERS} SET 
      totalLosses = totalLosses + ?,
      totalGames = totalGames + 1
      WHERE username = ?`;
    const [result] = await connection.execute(query, [new Big(amount).neg().toString(), username]);

    if (result.affectedRows === 1) {
      return { success: true, message: `${nameServer}: Cập nhật lượt thua thành công. ✅` };
    } else {
      return { success: false, message: `${nameServer}: Cập nhật lượt thua thất bại. ❌` };
    }
  } catch (error) {
    console.error("Lỗi khi cập nhật lượt thua:", error);
    return { success: false, message: `${nameServer}: Đã xảy ra lỗi khi cập nhật lượt thua. ❌` };
  }
}

export async function updatePlayerBalance(idUser, amount, isWin = null, numAmountWin) {
  try {
    const [playerRows] = await connection.execute(`SELECT balance FROM ${NAME_TABLE_PLAYERS} WHERE idUserZalo = ?`, [idUser]);

    if (playerRows.length === 0) {
      return { success: false, message: `${nameServer}: Không tìm thấy người chơi. ❌` };
    }

    const oldBalance = new Big(playerRows[0].balance).round(0);
    const bigNumAmount = new Big(amount).round(0);
    const newBalance = oldBalance.plus(bigNumAmount);
    const numBalanceWin = numAmountWin ? new Big(numAmountWin) : new Big(0);
    const isSetWinPoint = numBalanceWin.gt(0) ? 1 : 0;

    let query = `UPDATE ${NAME_TABLE_PLAYERS} SET balance = ?`;
    let params = [newBalance.toString()];

    if (isWin !== null) {
      query += `, 
        totalWinnings = CASE WHEN ? > 0 THEN totalWinnings + ? ELSE totalWinnings END,
        totalLosses = CASE WHEN ? < 0 THEN totalLosses - ? ELSE totalLosses END,
        totalGames = totalGames + 1,
        totalWinGames = totalWinGames + ?`;

      const positiveAmount = isSetWinPoint && numAmountWin ? numBalanceWin.toString() : bigNumAmount.gt(0) ? bigNumAmount.toString() : "0";
      const negativeAmount =
        !isSetWinPoint && numAmountWin ? numBalanceWin.abs().toString() : bigNumAmount.lt(0) ? bigNumAmount.abs().toString() : "0";

      params.push(bigNumAmount.toString(), positiveAmount, bigNumAmount.toString(), negativeAmount, isWin ? 1 : 0);
    }

    query += ` WHERE idUserZalo = ?`;
    params.push(idUser);

    const [result] = await connection.execute(query, params);

    if (result.affectedRows === 1) {
      if (isWin !== null) {
        await connection.execute(
          `UPDATE ${NAME_TABLE_PLAYERS} 
          SET winRate = (totalWinGames / NULLIF(totalGames, 0)) * 100
          WHERE idUserZalo = ?`,
          [idUser]
        );
      }

      return {
        success: true,
        oldBalance: oldBalance.toString(),
        newBalance: newBalance.toString(),
      };
    } else {
      return { success: false, message: `${nameServer}: Cập nhật thất bại. ❌` };
    }
  } catch (error) {
    console.error("Lỗi khi cập nhật số dư:", error);
    return { success: false, message: `${nameServer}: Đã xảy ra lỗi khi cập nhật số dư. ❌` };
  }
}

export async function getPlayerBalance(idUser) {
  try {
    const [rows] = await connection.execute(`SELECT balance FROM ${NAME_TABLE_PLAYERS} WHERE idUserZalo = ?`, [idUser]);

    if (rows.length > 0) {
      const balance = new Big(rows[0].balance);
      return { success: true, balance: balance.toString() };
    } else {
      return {
        success: false,
        message: `Không tìm thấy dữ liệu người chơi của bạn, nếu chưa đăng nhập, hãy chat lệnh game để xem hướng dẫn!`,
      };
    }
  } catch (error) {
    console.error("Lỗi khi lấy số dư người chơi:", error);
    return { success: false, message: `Đã xảy ra lỗi khi lấy số dư!` };
  }
}

export async function getPlayerInfo(idUserZalo) {
  try {
    const [rows] = await connection.execute(`SELECT * FROM ${NAME_TABLE_PLAYERS} WHERE idUserZalo = ?`, [idUserZalo]);

    if (rows.length > 0) {
      return rows[0];
    } else {
      return null;
    }
  } catch (error) {
    console.error("Lỗi khi lấy thông tin người chơi:", error);
    throw error;
  }
}

export async function getAccountVND(username) {
  try {
    const [rows] = await connection.execute(`SELECT vnd FROM ${NAME_TABLE_ACCOUNT} WHERE username = ?`, [username]);

    if (rows.length > 0) {
      return rows[0].vnd;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Lỗi khi lấy số dư VND của tài khoản:", error);
    throw error;
  }
}

export async function updateAccountVND(username, amount) {
  try {
    const [currentBalance] = await connection.execute(`SELECT vnd FROM ${NAME_TABLE_ACCOUNT} WHERE username = ?`, [username]);

    if (currentBalance.length === 0) {
      return { success: false, message: `${nameServer}: Không tìm thấy tài khoản!` };
    }

    const currentVND = new Big(currentBalance[0].vnd);
    const bigIntAmount = new Big(amount);
    const newBalance = currentVND.plus(bigIntAmount);

    const [result] = await connection.execute(`UPDATE ${NAME_TABLE_ACCOUNT} SET vnd = ? WHERE username = ?`, [
      newBalance.toString(),
      username,
    ]);

    if (result.affectedRows === 1) {
      return { success: true, message: `${nameServer}: Cập nhật số dư VND thành công. ✅` };
    } else {
      return { success: false, message: `${nameServer}: Cập nhật thất bại. ❌` };
    }
  } catch (error) {
    console.error("Lỗi khi cập nhật số dư VND của tài khoản:", error);
    return { success: false, message: `${nameServer}: Đã xảy ra lỗi khi cập nhật số dư VND!` };
  }
}

export async function registerAccount(username, password) {
  try {
    const [existingUsers] = await connection.execute(`SELECT username FROM ${NAME_TABLE_ACCOUNT} WHERE username = ?`, [username]);

    if (existingUsers.length > 0) {
      return {
        success: false,
        message: `${nameServer}: Tên tài khoản đã tồn tại. Vui lòng chọn tên khác!`,
      };
    }

    const specialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/;
    const vietnameseChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+/i;

    if (specialChars.test(password) || vietnameseChars.test(password) || specialChars.test(username) || vietnameseChars.test(username)) {
      return {
        success: false,
        message: `${nameServer}: Tài khoản hoặc mật khẩu Không được chứa ký tự đặc biệt hoặc dấu. Vui lòng thử lại (lưu ý bỏ dấu [ và ])!`,
      };
    }

    await connection.execute(`INSERT INTO ${NAME_TABLE_ACCOUNT} (username, password) VALUES (?, ?)`, [username, password]);

    return {
      success: true,
      message: `${nameServer}: Đăng ký tài khoản thành công, dùng lệnh daily để nhận quà hàng ngày!`,
    };
  } catch (error) {
    console.error("Lỗi khi đăng ký tài khoản:", error);
    return {
      success: false,
      message: `${nameServer}: Đã xảy ra lỗi khi đăng ký tài khoản!`,
    };
  }
}

export async function getUsernameByIdZalo(idUserZalo) {
  try {
    const [rows] = await connection.execute(`SELECT username FROM ${NAME_TABLE_PLAYERS} WHERE idUserZalo = ?`, [idUserZalo]);
    return rows[0].username;
  } catch (error) {
    return null;
  }
}

export async function updatePlayerBalanceByUsername(username, amount, isWin = null, numAmountWin) {
  try {
    const [playerRows] = await connection.execute(`SELECT balance FROM ${NAME_TABLE_PLAYERS} WHERE username = ?`, [username]);

    if (playerRows.length === 0) {
      return { success: false, message: `${nameServer}: Không tìm thấy người chơi. ❌` };
    }

    const oldBalance = new Big(playerRows[0].balance);
    const bigNumAmount = new Big(amount);
    const newBalance = oldBalance.plus(bigNumAmount);
    const numBalanceWin = numAmountWin ? new Big(numAmountWin) : new Big(0);
    const isSetWinPoint = numBalanceWin.gt(0) ? 1 : 0;

    let query = `UPDATE ${NAME_TABLE_PLAYERS} SET balance = ?`;
    let params = [newBalance.toString()];

    if (isWin !== null) {
      query += `, 
        totalWinnings = CASE WHEN ? > 0 THEN totalWinnings + ? ELSE totalWinnings END,
        totalLosses = CASE WHEN ? < 0 THEN totalLosses - ? ELSE totalLosses END,
        totalGames = totalGames + 1,
        totalWinGames = totalWinGames + ?`;

      const positiveAmount = isSetWinPoint && numAmountWin ? numBalanceWin.toString() : bigNumAmount.gt(0) ? bigNumAmount.toString() : "0";
      const negativeAmount =
        !isSetWinPoint && numAmountWin ? numBalanceWin.abs().toString() : bigNumAmount.lt(0) ? bigNumAmount.abs().toString() : "0";

      params.push(bigNumAmount.toString(), positiveAmount, bigNumAmount.toString(), negativeAmount, isWin ? 1 : 0);
    }

    query += ` WHERE username = ?`;
    params.push(username);

    const [result] = await connection.execute(query, params);

    if (result.affectedRows === 1) {
      if (isWin !== null) {
        await connection.execute(
          `UPDATE ${NAME_TABLE_PLAYERS} 
          SET winRate = (totalWinGames / NULLIF(totalGames, 0)) * 100
          WHERE username = ?`,
          [username]
        );
      }

      return {
        success: true,
        oldBalance: oldBalance.toString(),
        newBalance: newBalance.toString(),
      };
    } else {
      return { success: false, message: `${nameServer}: Cập nhật thất bại. ❌` };
    }
  } catch (error) {
    console.error("Lỗi khi cập nhật số dư:", error);
    return { success: false, message: `${nameServer}: Đã xảy ra lỗi khi cập nhật số dư. ❌` };
  }
}
