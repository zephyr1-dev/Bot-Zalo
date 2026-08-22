import fs from "fs";
import path from "path";
import { spawn } from "child_process";
const projectRoot = path.resolve(process.cwd());
const myBotDir = path.join(projectRoot, "mybot");
const botsDir = path.join(myBotDir, "bots");
const myBotsPath = path.join(myBotDir, "mybots.json");
const defaultCommand = path.join(myBotDir, "defaultCommand.json");
const isWindows = process.platform === "win32";
const launcherPath = path.join(projectRoot, "index.js");
export async function restartPM2Process(processName) {
   return new Promise((resolve) => {
     const pm2Command = isWindows ? "pm2.cmd" : "pm2";
     const pm2Process = spawn(pm2Command, ["restart", processName], {
       stdio: "pipe",
       shell: true,
       windowsHide: isWindows
     });
     let output = "";
     let errorOutput = "";
     pm2Process.stdout?.on("data", (data) => {
       output += data.toString();
     });
     pm2Process.stderr?.on("data", (data) => {
       errorOutput += data.toString();
     });
     pm2Process.on("close", (code) => {
       if (code === 0) {
         console.log(`Successfully restarted PM2 process: ${processName}`);
         resolve(true);
       } else {
         console.error(`Failed to restart PM2 process: ${processName}`);
         if (errorOutput) console.error(`Error: ${errorOutput}`);
         resolve(false);
       }
     });
     pm2Process.on("error", (error) => {
       console.error(`Error restarting PM2 process: ${error.message}`);
       resolve(false);
     });
     setTimeout(() => {
       pm2Process.kill();
       console.error(`Timeout restarting PM2 process: ${processName}`);
       resolve(false);
     }, 30000);
   });
 }
export async function deletePM2Process(processName) {
  return new Promise((resolve) => {
    const pm2Command = isWindows ? "pm2.cmd" : "pm2";
    const pm2Process = spawn(pm2Command, ["delete", processName], {
      stdio: "pipe",
      shell: true,
      windowsHide: isWindows
    });
    let output = "";
    let errorOutput = "";
    pm2Process.stdout?.on("data", (data) => {
      output += data.toString();
    });
    pm2Process.stderr?.on("data", (data) => {
      errorOutput += data.toString();
    });
    pm2Process.on("close", (code) => {
      if (code === 0) {
        console.log(`Successfully deleted PM2 process: ${processName}`);
        resolve(true);
      } else {
        console.log(`PM2 process ${processName} not found or already deleted`);
        resolve(true);
      }
    });
    pm2Process.on("error", (error) => {
      console.error(`Error deleting PM2 process: ${error.message}`);
      resolve(false);
    });
    setTimeout(() => {
      pm2Process.kill();
      console.error(`Timeout deleting PM2 process: ${processName}`);
      resolve(false);
    }, 15000);
  });
}


export async function checkBotExists(uidFrom) {
  try {
    if (!fs.existsSync(myBotsPath)) {
      return { exists: false };
    }
    const myBots = JSON.parse(fs.readFileSync(myBotsPath, "utf8"));
    const botInfo = myBots[uidFrom];
    if (!botInfo) {
      return { exists: false };
    }
    return { exists: true, botInfo };
  } catch (error) {
    console.error(`Lỗi kiểm tra bot: ${error.message}`);
    return { exists: false };
  }
}

export async function checkPM2Status(processName) {
   return new Promise((resolve) => {
     const pm2Command = isWindows ? "pm2.cmd" : "pm2";
     const pm2Process = spawn(pm2Command, ["describe", processName], {
       stdio: "pipe",
       shell: true,
       windowsHide: isWindows
     });
     let output = "";
     let errorOutput = "";
     pm2Process.stdout?.on("data", (data) => {
       output += data.toString();
     });
     pm2Process.stderr?.on("data", (data) => {
       errorOutput += data.toString();
     });
     pm2Process.on("close", (code) => {
       if (code === 0 && output.includes("online")) {
         resolve({ running: true, status: "online" });
       } else if (code === 0 && output.includes("stopped")) {
         resolve({ running: false, status: "stopped" });
       } else {
         resolve({ running: false, status: "not_found" });
       }
     });
     pm2Process.on("error", () => {
       resolve({ running: false, status: "error" });
     });
     setTimeout(() => {
       pm2Process.kill();
       resolve({ running: false, status: "timeout" });
     }, 10000);
   });
 }

 export async function startBotWithLauncher(uidFrom) {
  return new Promise((resolve) => {
    console.log(`Khởi động bot ${uidFrom} qua launcher: ${launcherPath}`);
    const launcherProcess = spawn("node", [launcherPath, uidFrom], {
      stdio: "pipe",
      shell: isWindows,
      windowsHide: isWindows,
      detached: !isWindows,
      env: {
        ...process.env,
        UID_FROM: uidFrom
      }
    });
    let output = "";
    let errorOutput = "";
    let hasStarted = false;
    launcherProcess.stdout?.on("data", (data) => {
      const text = data.toString();
      output += text;
      if (text.includes("Successfully") || text.includes("started") || text.includes("listening")) {
        hasStarted = true;
      }
    });
    launcherProcess.stderr?.on("data", (data) => {
      errorOutput += data.toString();
    });
    const checkTimeout = setTimeout(async () => {
      console.log(`Checking PM2 status for bot ${uidFrom}...`);
      try {
        const isRunning = await waitForPM2Process(uidFrom, 45000);
        if (isRunning) {
          console.log(`Bot ${uidFrom} confirmed running in PM2`);
          resolve(true);
        } else {
          console.error(`Bot ${uidFrom} failed to start in PM2`);
          if (output) console.log(`Output: ${output}`);
          if (errorOutput) console.error(`Error: ${errorOutput}`);
          resolve(false);
        }
      } catch (error) {
        console.error(`Error checking PM2 status: ${error.message}`);
        resolve(false);
      }
    }, 5000);
    launcherProcess.on("close", (code) => {
      clearTimeout(checkTimeout);
      if (code === 0 || hasStarted) {
        console.log(`Launcher exited with code ${code}, checking PM2 status...`);
        setTimeout(async () => {
          const status = await checkPM2Status(uidFrom);
          resolve(status.running);
        }, 2000);
      } else {
        console.error(`Launcher failed with exit code: ${code}`);
        if (errorOutput) console.error(`Error: ${errorOutput}`);
        if (output) console.error(`Output: ${output}`);
        resolve(false);
      }
    });
    launcherProcess.on("error", (error) => {
      clearTimeout(checkTimeout);
      console.error(`Launcher process error: ${error.message}`);
      resolve(false);
    });
    if (!isWindows) {
      launcherProcess.unref();
    }
  });
}

export async function waitForPM2Process(processName, maxWaitTime = 60000) {
   const startTime = Date.now();
   const checkInterval = 2000;
   while (Date.now() - startTime < maxWaitTime) {
     const status = await checkPM2Status(processName);
     if (status.running && status.status === "online") {
       console.log(`Bot ${processName} is now running in PM2`);
       return true;
     }
     if (status.status === "stopped") {
       console.log(`Bot ${processName} stopped in PM2`);
       return false;
     }
     console.log(`Waiting for bot ${processName}... Status: ${status.status}`);
     await new Promise(resolve => setTimeout(resolve, checkInterval));
   }
   console.log(`Timeout waiting for bot ${processName} to start`);
   return false;
 }

export async function updateBotStatus(uidFrom, status) {
  try {
    if (!fs.existsSync(myBotsPath)) {
      throw new Error("File mybots.json không tồn tại");
    }
    const myBots = JSON.parse(fs.readFileSync(myBotsPath, "utf8"));
    if (!myBots[uidFrom]) {
      throw new Error("Bot không tồn tại trong danh sách");
    }
    myBots[uidFrom].status = status;
    myBots[uidFrom].lastUpdated = new Date().toISOString();
    fs.writeFileSync(myBotsPath, JSON.stringify(myBots, null, 2));
    console.log(`Đã cập nhật trạng thái bot ${uidFrom} thành ${status}`);
  } catch (error) {
    console.error(`Lỗi cập nhật trạng thái bot: ${error.message}`);
    throw error;
  }
}

export async function stopPM2Process(processName) {
  return new Promise((resolve) => {
    const pm2Command = isWindows ? "pm2.cmd" : "pm2";
    const pm2Process = spawn(pm2Command, ["stop", processName], {
      stdio: "pipe",
      shell: true,
      windowsHide: isWindows
    });
    let output = "";
    let errorOutput = "";
    pm2Process.stdout?.on("data", (data) => {
      output += data.toString();
    });
    pm2Process.stderr?.on("data", (data) => {
      errorOutput += data.toString();
    });
    pm2Process.on("close", (code) => {
      if (code === 0) {
        console.log(`Successfully stopped PM2 process: ${processName}`);
        resolve(true);
      } else {
        console.error(`Failed to stop PM2 process: ${processName}`);
        if (errorOutput) console.error(`Error: ${errorOutput}`);
        resolve(false);
      }
    });
    pm2Process.on("error", (error) => {
      console.error(`Error stopping PM2 process: ${error.message}`);
      resolve(false);
    });
    setTimeout(() => {
      pm2Process.kill();
      console.error(`Timeout stopping PM2 process: ${processName}`);
      resolve(false);
    }, 15000);
  });
}

export async function checkExistingBot(uidFrom) {
  try {
    if (!fs.existsSync(myBotsPath)) {
      return { exists: false };
    }
    const myBots = JSON.parse(fs.readFileSync(myBotsPath, "utf8"));
    const existingBot = myBots[uidFrom];
    if (!existingBot) {
      return { exists: false };
    }
    const pm2Status = await checkPM2Status(uidFrom);
    if (pm2Status.running) {
      return { exists: true, message: "Bạn đã có một bot đang hoạt động! Mỗi người chỉ được tạo 1 bot." };
    }
    switch (existingBot.status) {
      case "running":
        if (!pm2Status.running) {
          existingBot.status = "stopped";
          myBots[uidFrom] = existingBot;
          fs.writeFileSync(myBotsPath, JSON.stringify(myBots, null, 2));
          return { exists: false };
        }
        return { exists: true, message: "Bạn đã có một bot đang hoạt động! Mỗi người chỉ được tạo 1 bot." };
      case "trialExpired":
        return { exists: true, message: "Bạn đã hết thời gian dùng thử! Hãy gia hạn bot của bạn." };
      case "expired":
        return { exists: true, message: "Bot của bạn đã hết hạn! Hãy gia hạn để tiếp tục sử dụng." };
      case "stopping":
        return { exists: true, message: "Bot của bạn đang trong trạng thái bảo trì! Hãy liên hệ admin." };
      default:
        return { exists: true };
    }
  } catch (error) {
    console.error(`Lỗi kiểm tra bot hiện có: ${error.message}`);
    return { exists: false };
  }
}

export function getAvailablePort() {
  try {
    if (!fs.existsSync(myBotsPath)) {
      return 4444;
    }
    const myBots = JSON.parse(fs.readFileSync(myBotsPath, "utf8"));
    const usedPorts = Object.values(myBots).map(bot => parseInt(bot.webPort));
    for (let port = 4444; port <= 6666; port++) {
      if (!usedPorts.includes(port)) {
        return port;
      }
    }
    throw new Error("Không còn port khả dụng (4444-6666)");
  } catch (error) {
    console.error(`Lỗi lấy port: ${error.message}`);
    return 4444;
  }
}

export function validateCredentials(args, prefix, aliasCommand) {
  const defaultUserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
  let cookie;
  try {
    cookie = JSON.parse(args[2]);
    if (typeof cookie !== "object" || cookie === null || Array.isArray(cookie)) {
      return {
        valid: false,
        message: `Cookie phải là JSON Raw object hợp lệ!`
      };
    }
  } catch (error) {
    return {
      valid: false,
      message: `Cookie không đúng định dạng JSON!`
    };
  }
  const imei = args[1];
  if (typeof imei !== "string" || imei.trim() === "") {
    return {
      valid: false,
      message: `IMEI phải là chuỗi không rỗng!`
    };
  }
  let userAgent = args.slice(3).join(" ") || defaultUserAgent;
  if (args[3] && !isValidUserAgent(args[3])) {
    userAgent = defaultUserAgent;
  }
  return {
    valid: true,
    credentials: { cookie, imei, userAgent }
  };
}

export function isValidUserAgent(userAgent) {
  if (typeof userAgent !== "string" || userAgent.trim() === "") return false;
  const commonPatterns = [/Mozilla/i, /Chrome/i, /Safari/i, /Firefox/i, /Edge/i, /Opera/i];
  return commonPatterns.some(pattern => pattern.test(userAgent)) && userAgent.length > 20;
}

export function createBotConfig(uidFrom, webPort) {
  return {
    "name": uidFrom,
    "configFilePath": `mybot/credentials/${uidFrom}.json`,
    "groupSettingsPath": `mybot/settings/groupSettings-${uidFrom}.json`,
    "adminFilePath": `mybot/configs/list_admin-${uidFrom}.json`,
    "commandFilePath": `mybot/json-data/command-${uidFrom}.json`,
    "MANAGER_FILE_PATH": `mybot/json-data/manager-${uidFrom}.json`,
    "DATA_GAME_FILE_PATH": `mybot/json-data/game_data-${uidFrom}.json`,
    "DATA_NT_PATH": `mybot/json-data/nong-trai-${uidFrom}.json`,
    "PROPHYLACTIC_CONFIG_PATH": `mybot/json-data/prophylactic-${uidFrom}.json`,
    "logDir": `logs/${uidFrom}`,
    "resourceDir": `assets/resources/${uidFrom}`,
    "tempDir": `assets/temp/${uidFrom}`,
    "dataGifPath": `assets/resources/gif/${uidFrom}`,
    "WEB_CONFIG_PATH": `mybot/json-data/web_config-${uidFrom}.json`,
    "webPort": webPort.toString(),
    "databaseFile": `mybot/json-data/database_config-${uidFrom}.json`,
    "dataTrainingPath": `mybot/json-data/data_training-${uidFrom}.json`,
    "rankInfoPath": `mybot/json-data/rank_info-${uidFrom}.json`
  };
}

export async function createAllRequiredFiles(uidFrom, args, botConfig) {
  const requiredDirs = [
    path.join(myBotDir, "credentials"),
    path.join(myBotDir, "configs"),
    path.join(myBotDir, "settings"),
    path.join(myBotDir, "json-data"),
    path.join(projectRoot, "logs", uidFrom),
    path.join(projectRoot, "assets", "resources", uidFrom),
    path.join(projectRoot, "assets", "temp", uidFrom),
    path.join(projectRoot, "assets", "resources", "gif", uidFrom)
  ];
  requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const credentialsData = {
    "cookie": JSON.parse(args[2]),
    "imei": args[1],
    "userAgent": args.slice(3).join(" ") || "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36"
  };

  const fileMap = {
    [path.join(projectRoot, botConfig.configFilePath)]: credentialsData,
    [path.join(projectRoot, botConfig.groupSettingsPath)]: {},
    [path.join(projectRoot, botConfig.adminFilePath)]: [],
    [path.join(projectRoot, botConfig.MANAGER_FILE_PATH)]: {
      "groupRequiredReset": "-1",
      "onGamePrivate": false,
      "onBotPrivate": false
    },
    [path.join(projectRoot, botConfig.DATA_GAME_FILE_PATH)]: {},
    [path.join(projectRoot, botConfig.PROPHYLACTIC_CONFIG_PATH)]: {
      "prophylacticUploadAttachment": {
        "enable": false,
        "lastBlocked": Date.now(),
        "numRequestZalo": 1,
        "lastRequestTime": Date.now()
      }
    },
    [path.join(projectRoot, botConfig.WEB_CONFIG_PATH)]: {},
    [path.join(projectRoot, botConfig.databaseFile)]: {
      "nameServer": "Bùi Quang Dũng",
      "host": "localhost",
      "user": "root",
      "password": "",
      "database": `${uidFrom}`,
      "port": 3306,
      "tablePlayerZalo": "players_zalo",
      "tableAccount": "account",
      "dailyReward": 100000000000
    },
    [path.join(projectRoot, botConfig.dataTrainingPath)]: {},
    [path.join(projectRoot, botConfig.rankInfoPath)]: {}
  };

  for (const [filePath, data] of Object.entries(fileMap)) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
      throw new Error(`Không thể tạo file ${filePath}: ${error.message}`);
    }
  }

  if (fs.existsSync(defaultCommand)) {
    try {
      await fs.promises.copyFile(defaultCommand, path.join(projectRoot, botConfig.commandFilePath));
    } catch (error) {
      throw new Error(`Không thể copy file defaultCommand.json: ${error.message}`);
    }
  } else {
    fs.writeFileSync(path.join(projectRoot, botConfig.commandFilePath), JSON.stringify({}, null, 2));
  }

  const botConfigPath = path.join(botsDir, `${uidFrom}.json`);
  try {
    fs.writeFileSync(botConfigPath, JSON.stringify(botConfig, null, 4));
  } catch (error) {
    throw new Error(`Không thể tạo file config bot: ${error.message}`);
  }
}

export async function saveBotToMyBots(uidFrom, dName, webPort, expiryTime) {
  try {
    let myBots = {};
    if (fs.existsSync(myBotsPath)) {
      myBots = JSON.parse(fs.readFileSync(myBotsPath, "utf8"));
    }
    myBots[uidFrom] = {
      name: uidFrom,
      displayName: dName,
      createdBy: dName,
      createdAt: new Date().toISOString(),
      expiryAt: expiryTime.toISOString(),
      webPort: webPort.toString(),
      status: "running",
      database: uidFrom
    };
    fs.writeFileSync(myBotsPath, JSON.stringify(myBots, null, 2));
    console.log(`Đã lưu thông tin bot ${uidFrom} vào mybots.json`);
  } catch (error) {
    console.error(`Lỗi khi lưu thông tin bot: ${error.message}`);
    throw error;
  }
}

export async function ensureDirectoriesExist() {
  const directories = [
    myBotDir,
    botsDir,
    path.join(myBotDir, "credentials"),
    path.join(myBotDir, "configs"),
    path.join(myBotDir, "settings"),
    path.join(myBotDir, "json-data")
  ];
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  if (!fs.existsSync(myBotsPath)) {
    fs.writeFileSync(myBotsPath, JSON.stringify({}, null, 2));
  }
}