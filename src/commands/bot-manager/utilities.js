import { GroupMessage, Message, MessageMention } from "../../api-zalo/index.js";
import { getCommandConfig, isAdmin } from "../../index.js";
import { sendMessageFailed, sendMessageFromSQL, sendMessageStateQuote } from "../../service-debug/chat-zalo/chat-style/chat-style.js";
import { getUserInfoData } from "../../service-debug/info-service/user-info.js";
import { getGlobalPrefix } from "../../service-debug/service.js";
import { removeMention } from "../../utils/format-util.js";
import { writeCommandConfig } from "../../utils/io-json.js";
import { permissionLevels } from "../command.js";
import { getPermissionCommandName } from "../manager-command/set-command.js";

let activeTodo = false;

export function stopTodo() {
  activeTodo = false;
}

export async function handleChangeGroupLink(api, message) {
  try {
    const threadId = message.threadId;
    await api.changeGroupLink(threadId);
  } catch (error) {
    const result = {
      success: false,
      message: `Lỗi khi đổi link nhóm: ${error.message}`,
    };
    await sendMessageFailed(api, message, result);
  }
}

export async function handleUndoMessage(api, message) {
  try {
    await api.undoMessage(message);
  } catch (error) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Lỗi khi xử lý lệnh undo: ${error.message}`,
      },
      false,
      30000
    );
  }
}

export async function handleSendToDo(api, message) {
  const content = removeMention(message);

  const mentions = message.data.mentions;
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const prefix = getGlobalPrefix();

  const parts = content.split("_");

  if (parts.length == 2 && parts[1].toLowerCase() === "stop") {
    if (activeTodo) {
      stopTodo();
      await sendMessageFromSQL(
        api,
        message,
        {
          success: true,
          message: "Đã dừng tất cả các todo đang chạy!",
        },
        false,
        30000
      );
    } else {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: "Không có todo nào đang chạy!",
        },
        false,
        30000
      );
    }
    return;
  }

  if (parts.length < 2) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message:
          `Cú pháp Không đúng. Vui lòng sử dụng:\n` +
          `${prefix}todo_[Nội dung công việc]_[Số lần] @user\n` +
          `hoặc: ${prefix}todo_[Nội dung công việc]_[Số lần]_[ID người nhận]`,
      },
      false,
      30000
    );
    return;
  }

  try {
    let todoContent = parts[1].trim();

    if (todoContent.length === 0) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Không Có Nội Dung Công Việc!`,
        },
        false,
        30000
      );
      return;
    }

    let repeatCount = 1;
    let userIds = [];

    if (parts.length >= 3) {
      const count = parseInt(parts[2]);
      if (!isNaN(count)) {
        repeatCount = count;
      }
    }

    if (!isAdmin(senderId) && repeatCount > 3) {
      repeatCount = 3;
    }

    if (mentions && Object.keys(mentions).length > 0) {
      userIds = Object.values(mentions).map((mention) => mention.uid);
    } else if (parts.length >= 4) {
      const specificId = parts[3].trim();
      if (specificId) {
        userIds = [specificId];
      }
    } else {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Không Tìm Thấy Mục Tiêu Để Giao Việc!`,
        },
        false,
        30000
      );
      return;
    }

    const userInfo = await getUserInfoData(api, userIds[0]);

    const targetText =
      userIds.length === 1 && userIds[0] === senderId
        ? "bản thân"
        : userIds.length === 1
        ? `người dùng ${userInfo.name}`
        : `${userIds.length} người`;

    await sendMessageFromSQL(
      api,
      message,
      {
        success: true,
        message: `Đã giao việc "${todoContent}" ${repeatCount} lần cho ${targetText}`,
      },
      false,
      30000
    );

    activeTodo = true;
    for (let i = 0; i < repeatCount; i++) {
      if (!activeTodo) {
        break;
      }
      await api.sendTodo(message, todoContent, userIds, -1, todoContent);
    }
  } catch (error) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Lỗi khi giao việc: ${error.message}`,
      },
      false,
      30000
    );
  }
}

/**
 * Tính độ tương đồng giữa 2 chuỗi sử dụng thuật toán Levenshtein Distance
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1)
    .fill()
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j - 1] + 1, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
      }
    }
  }

  return dp[m][n];
}

/**
 * Tìm các lệnh tương tự dựa trên độ tương đồng của chuỗi
 */
function findSimilarCommands(command, availableCommands, threshold = 0.6) {
  const similarCommands = [];
  const commandLower = command.toLowerCase();

  // Tách command thành các ký tự riêng lẻ
  const commandChars = commandLower.split("");

  // Map các viết tắt phổ biến
  const commonShortcuts = {
    dy: "daily",
    dk: "dangky",
    nt: "nongtrai",
    tx: "taixiu",
    kbb: "keobuabao",
    tt: "thongtin",
    bg: "background",
  };

  for (const cmd of availableCommands) {
    const cmdNameLower = cmd.name.toLowerCase();

    // Kiểm tra các trường hợp:
    const isStartsWith = cmdNameLower.startsWith(commandLower);

    // Kiểm tra viết tắt phổ biến
    const isCommonShortcut = commonShortcuts[commandLower] === cmdNameLower;

    // Kiểm tra xem các ký tự của command có xuất hiện theo thứ tự trong tên lệnh Không
    let matchesSequence = true;
    let lastIndex = -1;
    for (const char of commandChars) {
      const index = cmdNameLower.indexOf(char, lastIndex + 1);
      if (index === -1) {
        matchesSequence = false;
        break;
      }
      lastIndex = index;
    }

    // Tính độ tương đồng bằng Levenshtein
    const distance = levenshteinDistance(commandLower, cmdNameLower);
    const similarity = 1 - distance / Math.max(command.length, cmd.name.length);

    // Thêm vào danh sách nếu thỏa mãn một trong các điều kiện
    if (isStartsWith || isCommonShortcut || matchesSequence || similarity >= threshold) {
      similarCommands.push({
        command: cmd,
        similarity: isStartsWith ? 1 : isCommonShortcut ? 0.95 : matchesSequence ? 0.9 : similarity,
      });
    }
  }

  return similarCommands
    .sort((a, b) => {
      // Đầu tiên sắp xếp theo quyền hạn
      const permissionDiff = permissionLevels[a.permission] - permissionLevels[b.permission];
      if (permissionDiff !== 0) return permissionDiff;

      // Nếu cùng quyền hạn thì sắp xếp theo độ tương đồng (cao xuống thấp)
      return b.similarity - a.similarity;
    })
    .slice(0, 5)
    .map((item) => item.command);
}

/**
 * Kiểm tra và gợi ý lệnh khi Không tìm thấy command
 */
export async function checkNotFindCommand(api, message, command, availableCommands) {
  const prefix = getGlobalPrefix();

  if (!command || command.trim() === "") {
    // Trường hợp Không có lệnh
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message:
          `Nếu Mày Thắc Mắc Tao Có Những Lệnh Gì, Hãy:\n` +
          `${prefix}help - Xem hướng dẫn sử dụng\n` +
          `${prefix}game - Xem hướng dẫn chơi game\n` +
          `${prefix}command - Xem danh sách lệnh có sẵn`,
      },
      false,
      30000
    );
    return;
  }

  // Tìm các lệnh tương tự
  const similarCommands = findSimilarCommands(command, availableCommands);

  if (similarCommands.length > 0) {
    // Có lệnh tương tự, đưa ra gợi ý
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message:
          `Không tìm thấy lệnh "${command}"\n` +
          `Có phải mày muốn dùng:\n` +
          similarCommands.map((cmd) => `${prefix}${cmd.name} [${getPermissionCommandName(cmd)}]`).join("\n"),
      },
      false,
      30000
    );
  } else {
    // Không có lệnh tương tự
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message:
          `Không tìm thấy lệnh "${command}". Vui lòng sử dụng:\n` +
          `${prefix}help - Xem hướng dẫn sử dụng\n` +
          `${prefix}game - Xem hướng dẫn chơi game\n` +
          `${prefix}command - Xem danh sách lệnh có sẵn`,
      },
      false,
      30000
    );
  }
}

/**
 * Xử lý thêm alias cho command
 */
export async function handleAliasCommand(api, message, commandParts) {
  const prefix = getGlobalPrefix();
  const subCommand = commandParts[1]?.toLowerCase();
  const cmdName = commandParts[2]?.toLowerCase();
  const aliasName = commandParts[3]?.toLowerCase();

  if (!subCommand) {
    await handleListAlias(api, message);
    return;
  }

  switch (subCommand) {
    case "add":
      if (!cmdName || !aliasName) {
        await sendMessageFromSQL(
          api,
          message,
          {
            success: false,
            message: `Cú pháp Không đúng. Vui lòng sử dụng:\n${prefix}alias add [tên lệnh] [tên alias]`,
          },
          false,
          300000
        );
        return;
      }
      await handleAddAlias(api, message, cmdName, aliasName);
      break;

    case "remove":
      if (!cmdName || !aliasName) {
        await sendMessageFromSQL(
          api,
          message,
          {
            success: false,
            message: `Cú pháp Không đúng. Vui lòng sử dụng:\n${prefix}alias remove [tên lệnh] [tên alias]`,
          },
          false,
          300000
        );
        return;
      }
      await handleRemoveAlias(api, message, cmdName, aliasName);
      break;

    case "list":
      await handleListAlias(api, message, cmdName);
      break;

    default:
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message:
            `Cú pháp Không đúng. Sử dụng:\n` +
            `${prefix}alias add [tên lệnh] [tên alias] - Thêm alias\n` +
            `${prefix}alias remove [tên lệnh] [tên alias] - Xóa alias\n` +
            `${prefix}alias list [tên lệnh] - Xem danh sách alias\n` +
            `${prefix}alias - Xem tất cả alias`,
        },
        false,
        300000
      );
      break;
  }
}

export async function handleAddAlias(api, message, commandName, aliasName) {
  try {
    const commandConfig = getCommandConfig();
    const command = commandConfig.commands.find((cmd) => cmd.name === commandName);

    if (!command) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Không tìm thấy lệnh "${commandName}" để thêm alias`,
        },
        false,
        300000
      );
      return;
    }

    if (!command.alias) {
      command.alias = [];
    }

    if (command.alias.includes(aliasName)) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Alias "${aliasName}" đã tồn tại cho lệnh "${commandName}"`,
        },
        false,
        300000
      );
      return;
    }

    const isAliasExist = commandConfig.commands.some((cmd) => cmd.name === aliasName || (cmd.alias && cmd.alias.includes(aliasName)));

    if (isAliasExist) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Không thể thêm alias "${aliasName}" vì đã tồn tại như một lệnh hoặc alias khác`,
        },
        false,
        300000
      );
      return;
    }

    command.alias.push(aliasName);
    writeCommandConfig(commandConfig);

    await sendMessageFromSQL(
      api,
      message,
      {
        success: true,
        message: `Đã thêm alias "${aliasName}" cho lệnh "${commandName}"`,
      },
      false,
      300000
    );
  } catch (error) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Lỗi khi thêm alias: ${error.message}`,
      },
      false,
      300000
    );
  }
}

/**
 * Xử lý xóa alias của command
 */
export async function handleRemoveAlias(api, message, commandName, aliasName) {
  try {
    const commandConfig = getCommandConfig();
    const command = commandConfig.commands.find((cmd) => cmd.name === commandName);

    if (!command) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Không tìm thấy lệnh "${commandName}" để xóa alias`,
        },
        false,
        300000
      );
      return;
    }

    if (!command.alias || !command.alias.includes(aliasName)) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Không tìm thấy alias "${aliasName}" trong lệnh "${commandName}"`,
        },
        false,
        300000
      );
      return;
    }

    command.alias = command.alias.filter((a) => a !== aliasName);
    writeCommandConfig(commandConfig);

    await sendMessageFromSQL(
      api,
      message,
      {
        success: true,
        message: `Đã xóa alias "${aliasName}" khỏi lệnh "${commandName}"`,
      },
      false,
      300000
    );
  } catch (error) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Lỗi khi xóa alias: ${error.message}`,
      },
      false,
      300000
    );
  }
}

/**
 * Xử lý hiển thị danh sách alias của command
 */
export async function handleListAlias(api, message, commandName) {
  try {
    const commandConfig = getCommandConfig();

    if (commandName) {
      const command = commandConfig.commands.find((cmd) => cmd.name === commandName);

      if (!command) {
        await sendMessageFromSQL(
          api,
          message,
          {
            success: false,
            message: `Không tìm thấy lệnh "${commandName}"`,
          },
          false,
          300000
        );
        return;
      }

      const aliases = command.alias || [];
      await sendMessageFromSQL(
        api,
        message,
        {
          success: true,
          message:
            aliases.length > 0
              ? `Danh sách alias của lệnh "${commandName}":\n${aliases.join(", ")}`
              : `Lệnh "${commandName}" Không có alias nào`,
        },
        false,
        300000
      );
    } else {
      const aliasInfo = commandConfig.commands
        .filter((cmd) => cmd.alias && cmd.alias.length > 0)
        .map((cmd) => `${cmd.name}: ${cmd.alias.join(", ")}`)
        .join("\n");

      await sendMessageFromSQL(
        api,
        message,
        {
          success: true,
          message: aliasInfo.length > 0 ? `Danh sách alias của các lệnh:\n${aliasInfo}` : "Không có alias nào được cấu hình",
        },
        false,
        300000
      );
    }
  } catch (error) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Lỗi khi hiển thị alias: ${error.message}`,
      },
      false,
      300000
    );
  }
}

export async function handleSendMessagePrivate(api, message) {
  const content = removeMention(message);
  const mentions = message.data.mentions;
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const prefix = getGlobalPrefix();

  const parts = content.split("_");

  if (parts.length < 2) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message:
          `Cú pháp Không đúng. Vui lòng sử dụng:\n` +
          `${prefix}sendp_[Nội dung tin nhắn]_[Số lần] @user\n` +
          `hoặc: ${prefix}sendp_[Nội dung tin nhắn]_[Số lần]_[ID người nhận]`,
      },
      false,
      30000
    );
    return;
  }

  try {
    let smsContent = parts[1].trim();

    if (smsContent.length === 0) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Không có nội dung tin nhắn!`,
        },
        false,
        30000
      );
      return;
    }

    let repeatCount = 1;
    let userIds = [];

    if (parts.length >= 3) {
      const count = parseInt(parts[2]);
      if (!isNaN(count)) {
        repeatCount = count;
      }
    }

    if (!isAdmin(senderId) && repeatCount > 999) {
      repeatCount = 999;
    }

    if (mentions && Object.keys(mentions).length > 0) {
      userIds = Object.values(mentions).map((mention) => mention.uid);
    } else if (parts.length >= 4) {
      const specificId = parts[3].trim();
      if (specificId) {
        userIds = [specificId];
      }
    } else {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Không tìm thấy người nhận!`,
        },
        false,
        30000
      );
      return;
    }

    const userInfo = await getUserInfoData(api, userIds[0]);

    const targetText =
      userIds.length === 1 && userIds[0] === senderId
        ? "bản thân"
        : userIds.length === 1
        ? `người dùng ${userInfo.name}`
        : `${userIds.length} người`;

    await sendMessageFromSQL(
      api,
      message,
      {
        success: true,
        message: `Đã bắt đầu send tin nhắn riêng "${smsContent}" ${repeatCount} lần cho ${targetText}`,
      },
      false,
      30000
    );

    for (const userId of userIds) {
      for (let i = 0; i < repeatCount; i++) {
        try {
          await api.sendMessage(smsContent, userId);
        } catch (error) {
          console.error(`Lỗi khi gửi tin nhắn riêng cho ${userId}:`, error);
          continue;
        }
      }
    }

    await sendMessageFromSQL(
      api,
      message,
      {
        success: true,
        message: `Đã hoàn thành gửi tin nhắn riêng cho ${targetText}`,
      },
      false,
      30000
    );
  } catch (error) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Lỗi khi gửi tin nhắn riêng: ${error.message}`,
      },
      false,
      30000
    );
  }
}

export async function handleSendTaskCommand(api, message, groupSettings) {
  const content = removeMention(message);
  const status = content.split(" ")[1]?.toLowerCase();
  const threadId = message.threadId;

  if (!groupSettings[threadId]) {
    groupSettings[threadId] = {};
  }

  let newStatus;
  if (status === "on") {
    groupSettings[threadId].sendTask = true;
    newStatus = "bật";
  } else if (status === "off") {
    groupSettings[threadId].sendTask = false;
    newStatus = "tắt";
  } else {
    groupSettings[threadId].sendTask = !groupSettings[threadId].sendTask;
    newStatus = groupSettings[threadId].sendTask ? "bật" : "tắt";
  }

  const caption = `Đã ${newStatus} chức năng gửi nội dung tự động sau mỗi giờ vào nhóm này!`;
  await sendMessageStateQuote(api, message, caption, groupSettings[threadId].sendTask, 300000);

  return true;
}

export async function handleGetLinkInQuote(api, message) {
  const quote = message.data.quote;
  if (!quote || !quote.attach) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Không tìm thấy link trong tin nhắn được reply!`,
      },
      false,
      30000
    );
    return;
  }

  try {
    const attachData = JSON.parse(quote.attach);
    
    if (!attachData.href) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Không tìm thấy link trong tin nhắn được reply!`,
        },
        false,
        30000
      );
      return;
    }

    await sendMessageFromSQL(
      api,
      message,
      {
        success: true,
        message: `Link: ${attachData.href}`,
      },
      false,
      180000
    );
  } catch (error) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Lỗi khi xử lý link: ${error.message}`,
      },
      false,
      30000
    );
  }
}
