import mysql from "mysql2/promise";
import chalk from "chalk";
import fs from "fs/promises";
import path from "path";
import { claimDailyReward, getMyCard } from "./player.js";
import { getTopPlayers } from "./jdbc.js";

export * from "./player.js";
export * from "./jdbc.js";

let nameServer = "";
let connection;
let NAME_TABLE_PLAYERS;
let NAME_TABLE_ACCOUNT;
let DAILY_REWARD;

async function loadConfig() {
  const configPath = path.join(
    process.cwd(),
    "assets",
    "json-data",
    "database-config.json"
  );
  const configFile = await fs.readFile(configPath, "utf8");
  return JSON.parse(configFile);
}

export async function initializeDatabase() {
  try {
    const config = await loadConfig();

    nameServer = config.nameServer;
    NAME_TABLE_PLAYERS = config.tablePlayerZalo;
    NAME_TABLE_ACCOUNT = config.tableAccount;
    DAILY_REWARD = config.dailyReward;

    // Tạo kết nối tạm thời Không cần chọn database
    const tempConnection = await mysql.createConnection({
      host: config.host,
      user: config.user,
      password: config.password,
    });

    // Tạo database nếu chưa tồn tại
    await tempConnection.execute(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\``
    );

    // Đóng kết nối tạm thời
    await tempConnection.end();

    // Tạo pool connection với database đã chọn
    connection = mysql.createPool({
      host: config.host,
      user: config.user,
      password: config.password,
      database: config.database,
      port: config.port,
    });

    const [tablesAccount] = await connection.execute(
      `SHOW TABLES LIKE '${NAME_TABLE_ACCOUNT}'`
    );
    if (tablesAccount.length === 0) {
      // Tạo bảng account nếu chưa tồn tại
      await connection.execute(`
            CREATE TABLE IF NOT EXISTS ${NAME_TABLE_ACCOUNT} (
                id INT PRIMARY KEY AUTO_INCREMENT,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                is_admin BOOLEAN DEFAULT false,
                vnd BIGINT DEFAULT 0
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
      console.log(`✓ Đã kiểm tra/tạo bảng ${NAME_TABLE_ACCOUNT}`);
    }

    // Kiểm tra và tạo bảng players
    const [tables] = await connection.execute(
      `SHOW TABLES LIKE '${NAME_TABLE_PLAYERS}'`
    );

    if (tables.length === 0) {
      // Nếu bảng chưa tồn tại, tạo bảng mới
      await connection.execute(`
                CREATE TABLE ${NAME_TABLE_PLAYERS} (
                    id INT AUTO_INCREMENT,
                    username VARCHAR(255) NOT NULL,
                    idUserZalo VARCHAR(255) DEFAULT '-1',
                    playerName VARCHAR(255) NOT NULL,
                    balance BIGINT DEFAULT 10000,
                    registrationTime DATETIME,
                    totalWinnings BIGINT DEFAULT 0,
                    totalLosses BIGINT DEFAULT 0,
                    netProfit BIGINT DEFAULT 0,
                    totalWinGames BIGINT DEFAULT 0,
                    totalGames BIGINT DEFAULT 0,
                    winRate DECIMAL(5, 2) DEFAULT 0,
                    lastDailyReward DATETIME,
                    isBanned BOOLEAN DEFAULT FALSE,
                    PRIMARY KEY (id),
                    UNIQUE KEY (username)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
      console.log(`✓ Đã tạo bảng ${NAME_TABLE_PLAYERS}`);
    } else {
      // Kiểm tra và thêm các cột còn thiếu
      const [columns] = await connection.execute(
        `SHOW COLUMNS FROM ${NAME_TABLE_PLAYERS}`
      );
      const existingColumns = columns.map((col) => col.Field);

      const requiredColumns = [
        {
          name: "username",
          query: "ADD COLUMN username VARCHAR(255) NOT NULL UNIQUE",
        },
        {
          name: "idUserZalo",
          query: "ADD COLUMN idUserZalo VARCHAR(255) DEFAULT '-1'",
        },
        {
          name: "playerName",
          query: "ADD COLUMN playerName VARCHAR(255) NOT NULL",
        },
        {
          name: "balance",
          query: "ADD COLUMN balance bigint(20) DEFAULT 10000",
        },
        {
          name: "registrationTime",
          query: "ADD COLUMN registrationTime DATETIME",
        },
        {
          name: "totalWinnings",
          query: "ADD COLUMN totalWinnings bigint(20) DEFAULT 0",
        },
        {
          name: "totalLosses",
          query: "ADD COLUMN totalLosses bigint(20) DEFAULT 0",
        },
        {
          name: "netProfit",
          query: "ADD COLUMN netProfit bigint(20) DEFAULT 0",
        },
        {
          name: "totalWinGames",
          query: "ADD COLUMN totalWinGames bigint(20) DEFAULT 0",
        },
        {
          name: "totalGames",
          query: "ADD COLUMN totalGames bigint(20) DEFAULT 0",
        },
        {
          name: "winRate",
          query: "ADD COLUMN winRate DECIMAL(5, 2) DEFAULT 0",
        },
        {
          name: "lastDailyReward",
          query: "ADD COLUMN lastDailyReward DATETIME",
        },
        {
          name: "isBanned",
          query: "ADD COLUMN isBanned BOOLEAN DEFAULT FALSE",
        },
      ];

      for (const column of requiredColumns) {
        if (!existingColumns.includes(column.name)) {
          await connection.execute(
            `ALTER TABLE ${NAME_TABLE_PLAYERS} ${column.query}`
          );
          console.log(
            `Đã thêm/sửa cột ${column.name} vào bảng ${NAME_TABLE_PLAYERS}`
          );
        }
      }
    }

    console.log(chalk.green("✓ Khởi tạo database thành công"));
  } catch (error) {
    console.error(chalk.red("Lỗi khi khởi tạo cơ sở dữ liệu: "), error);
    console.error(chalk.red("Vui lòng mở XAMPP MySQL và khởi động lại!"));
  }
}

export {
  connection,
  NAME_TABLE_PLAYERS,
  NAME_TABLE_ACCOUNT,
  claimDailyReward,
  getTopPlayers,
  getMyCard,
  nameServer,
  DAILY_REWARD,
};
