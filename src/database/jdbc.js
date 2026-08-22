import { connection, NAME_TABLE_PLAYERS } from './index.js';
import Big from 'big.js';

export async function getTopPlayers() {
  try {
    // Lấy tất cả người chơi
    const [rows] = await connection.execute(
      `SELECT idUserZalo, playerName, balance FROM ${NAME_TABLE_PLAYERS}`
    );

    // Chuyển đổi balance sang Big và sắp xếp lại
    const sortedPlayers = rows
      .map(player => ({
        idUser: player.idUserZalo,
        playerName: player.playerName,
        balance: new Big(player.balance)
      }))
      .sort((a, b) => b.balance.minus(a.balance))
      .slice(0, 20) // Lấy top 20
      .map((player, index) => ({
        rank: index + 1,
        idUser: player.idUser,
        playerName: player.playerName,
        balance: player.balance.toString()
      }));

    return sortedPlayers;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách top người chơi:', error);
    return [];
  }
}
