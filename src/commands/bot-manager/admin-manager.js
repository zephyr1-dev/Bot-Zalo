import { writeGroupSettings } from "../../utils/io-json.js";
import { sendMessageComplete, sendMessageInsufficientAuthority, sendMessageQuery, sendMessageWarning } from "../../service-debug/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../service-debug/service.js";
import { removeMention } from "../../utils/format-util.js";
import fs from "fs/promises";
import path from "path";
import { createAdminListImage } from "../../utils/canvas/listadmin-canvas.js";
import { getBotInfo } from "../../utils/env.js";
import { appContext } from "../../api-zalo/context.js";

export async function handleListAdmin(api, message, groupSettings) {
  const threadId = message.threadId;
  let imagePath = null;

  try {
    const botInfo = await getBotInfo();
    const adminFilePath = botInfo.adminFilePath;
    
    // Kiểm tra đường dẫn admin
    if (!adminFilePath) {
      throw new Error("Đường dẫn tệp admin (adminFilePath) không được định nghĩa trong botInfo.");
    }
    console.debug(`Đang sử dụng adminFilePath: ${adminFilePath}`);

    // Khởi tạo groupSettings[threadId].adminList nếu chưa tồn tại
    if (!groupSettings[threadId]) {
      groupSettings[threadId] = { adminList: {} };
    }
    if (!groupSettings[threadId].adminList) {
      groupSettings[threadId].adminList = {};
    }

    // Kiểm tra và khởi tạo tệp admin nếu không tồn tại
    const dir = path.dirname(adminFilePath);
    await fs.mkdir(dir, { recursive: true });
    if (!(await fs.access(adminFilePath).then(() => true).catch(() => false))) {
      await fs.writeFile(adminFilePath, JSON.stringify([]), "utf8");
      console.debug(`Tạo tệp admin mới tại: ${adminFilePath}`);
    }

    // Tải danh sách quản trị cấp cao từ tệp
    let highLevelAdmins = [];
    try {
      const data = await fs.readFile(adminFilePath, "utf8");
      highLevelAdmins = JSON.parse(data);
      if (!Array.isArray(highLevelAdmins)) {
        throw new Error(`Tệp ${adminFilePath} không chứa mảng hợp lệ`);
      }
      highLevelAdmins = highLevelAdmins
        .filter(id => typeof id === "string" && id.trim() !== "")
        .map(id => id.trim());
    } catch (error) {
      console.error(`Lỗi khi phân tích ${adminFilePath}:`, error.message);
      highLevelAdmins = [];
    }

    // Thêm admin mặc định nếu danh sách rỗng
    if (highLevelAdmins.length === 0 && appContext.uid) {
      highLevelAdmins.push(appContext.uid.toString());
      try {
        await fs.writeFile(adminFilePath, JSON.stringify(highLevelAdmins, null, 2));
        console.debug(`Đã thêm bot UID ${appContext.uid} vào ${adminFilePath}`);
      } catch (error) {
        console.error("Lỗi khi ghi admin mặc định:", error.message);
      }
    }

    // Lấy thông tin quản trị cấp cao
    let highLevelAdminInfo = { unchanged_profiles: {}, changed_profiles: {} };
    if (highLevelAdmins.length > 0) {
      try {
        highLevelAdminInfo = await api.getUserInfo(highLevelAdmins);
      } catch (error) {
        console.error("Lỗi khi lấy thông tin quản trị cấp cao:", error.message);
        highLevelAdminInfo = { unchanged_profiles: {}, changed_profiles: {} };
      }
    }

    // Kiểm tra nếu highLevelAdminInfo rỗng
    const highLevelAdminCount = Object.keys(highLevelAdminInfo.unchanged_profiles || {}).length +
                               Object.keys(highLevelAdminInfo.changed_profiles || {}).length;
    if (highLevelAdmins.length > 0 && highLevelAdminCount === 0) {
      console.warn(`Cảnh báo: Không lấy được thông tin cho ${highLevelAdmins.length} quản trị viên cấp cao`);
      try {
        const adminSearch = await api.findUser("+84789305260");
        const adminUid = adminSearch?.uid?.toString();
        if (adminUid && !highLevelAdmins.includes(adminUid)) {
          highLevelAdmins.push(adminUid);
          await fs.writeFile(adminFilePath, JSON.stringify(highLevelAdmins, null, 2));
          highLevelAdminInfo = await api.getUserInfo([adminUid]);
          console.debug(`Đã thêm admin mặc định ${adminUid} vào ${adminFilePath}`);
        }
      } catch (error) {
        console.error("Lỗi khi thêm admin mặc định:", error.message);
      }
    }

    // Tạo danh sách quản trị viên
    let adminList = [
      ...Object.values(highLevelAdminInfo.unchanged_profiles || {}).map(user => ({
        name: user.zaloName || "Không xác định",
        role: "Quản trị Cấp Cao",
        avatar: user.avatar || null
      })),
      ...Object.values(highLevelAdminInfo.changed_profiles || {}).map(user => ({
        name: user.zaloName || "Không xác định",
        role: "Quản trị Cấp Cao",
        avatar: user.avatar || null
      })),
      ...(await Promise.all(
        Object.entries(groupSettings[threadId].adminList || {}).map(async ([id, name]) => {
          let avatar = null;
          try {
            const groupMembers = await api.getGroupMembers([`${id}_0`]);
            avatar = groupMembers.profiles?.[id]?.avatar || null;
          } catch (error) {
            console.error(`Lỗi khi lấy avatar của ID ${id}:`, error.message);
          }
          return {
            name: name || "Không xác định",
            role: "Quản trị Nhóm",
            avatar
          };
        })
      )),
    ];

    // Kiểm tra nếu danh sách trống
    if (adminList.length === 0) {
      await sendMessageWarning(
        api,
        message,
        `Không có quản trị viên nào được tìm thấy! Vui lòng thêm quản trị viên bằng lệnh !add @user hoặc kiểm tra ID trong ${adminFilePath} (${highLevelAdmins.join(", ")}).`,
        true,
        false
      );
      return;
    }

    // Tạo và gửi ảnh danh sách quản trị
    imagePath = await createAdminListImage(adminList);

    const fileExists = await fs.access(imagePath).then(() => true).catch(() => false);
    if (!fileExists) {
      throw new Error("Không thể tạo tệp ảnh danh sách quản trị");
    }

    await api.sendMessage({
      msg: "Danh sách quản trị viên:",
      attachments: [imagePath],
      ttl: 600000,
    }, message.threadId, message.type);

    // Xóa tệp ảnh sau 30 giây
    setTimeout(async () => {
      try {
        await fs.unlink(imagePath);
      } catch (error) {
        console.error("Lỗi khi xóa tệp ảnh:", error.message);
      }
    }, 30 * 1000);
  } catch (error) {
    console.error("Lỗi trong handleListAdmin:", error.message);
    await sendMessageWarning(
      api,
      message,
      `Đã xảy ra lỗi khi xử lý danh sách quản trị: ${error.message}. Vui lòng thử lại sau.`,
      true,
      false
    );
  }
}

export async function handleAdminHighLevelCommands(api, message, groupAdmins, groupSettings, isAdminLevelHighest) {
  const content = removeMention(message);
  const prefix = getGlobalPrefix();

  if (!content.includes(`${prefix}add`) && !content.includes(`${prefix}remove`)) {
    return false;
  }

  let action = null;
  if (content.includes(`${prefix}add`)) action = "add";
  if (content.includes(`${prefix}remove`)) action = "remove";

  if (!action) return false;

  const botInfo = await getBotInfo();
  const adminFilePath = botInfo.adminFilePath;

  // Kiểm tra quyền của người gửi hoặc bot
  let highLevelAdmins = [];
  try {
    const data = await fs.readFile(adminFilePath, "utf8");
    highLevelAdmins = JSON.parse(data).filter(id => typeof id === "string" && id.trim() !== "").map(id => id.trim());
  } catch (error) {
    console.error(`Lỗi khi đọc ${adminFilePath}:`, error.message);
  }

  if (!isAdminLevelHighest && !highLevelAdmins.includes(message.data.uidFrom) && !highLevelAdmins.includes(appContext.uid.toString())) {
    const caption = "Chỉ có quản trị bot cấp cao mới được sử dụng lệnh này!";
    await sendMessageInsufficientAuthority(api, message, caption);
    return false;
  }

  await handleAddRemoveAdmin(api, message, groupSettings, action, adminFilePath);
  writeGroupSettings(groupSettings);
  return true;
}

async function handleAddRemoveAdmin(api, message, groupSettings, action, adminFilePath) {
  const mentions = message.data.mentions;
  const threadId = message.threadId;
  const content = removeMention(message);
  const prefix = getGlobalPrefix();

  // Kiểm tra đường dẫn admin
  if (!adminFilePath) {
    await sendMessageWarning(
      api,
      message,
      "Đường dẫn tệp admin (adminFilePath) không được định nghĩa. Vui lòng kiểm tra cấu hình bot.",
      true,
      false
    );
    return;
  }

  // Kiểm tra và khởi tạo tệp admin nếu không tồn tại
  const dir = path.dirname(adminFilePath);
  await fs.mkdir(dir, { recursive: true });
  if (!(await fs.access(adminFilePath).then(() => true).catch(() => false))) {
    await fs.writeFile(adminFilePath, JSON.stringify([]), "utf8");
    console.debug(`Tạo tệp admin mới tại: ${adminFilePath}`);
  }

  // Handle index-based removal
  if (action === "remove" && /\d+/.test(content)) {
    const indexMatch = content.match(/\d+/);
    if (indexMatch) {
      const index = parseInt(indexMatch[0]) - 1;
      
      // Đọc danh sách quản trị viên cấp cao từ tệp
      let highLevelAdmins = [];
      try {
        const data = await fs.readFile(adminFilePath, "utf8");
        highLevelAdmins = JSON.parse(data);
        if (!Array.isArray(highLevelAdmins)) {
          throw new Error(`Tệp ${adminFilePath} không chứa mảng hợp lệ`);
        }
        highLevelAdmins = highLevelAdmins
          .filter(id => typeof id === "string" && id.trim() !== "")
          .map(id => id.trim());
      } catch (error) {
        console.error(`Lỗi khi đọc ${adminFilePath}:`, error.message);
        await sendMessageWarning(api, message, "Lỗi khi đọc danh sách quản trị cấp cao. Vui lòng thử lại sau.");
        return;
      }

      const highLevelAdminInfo = await api.getUserInfo(highLevelAdmins);
      const groupAdminList = Object.entries(groupSettings[threadId].adminList);

      // Combine high-level and group admins for index-based removal
      const combinedAdminList = [
        ...Object.values(highLevelAdminInfo.unchanged_profiles || {}).map(user => ({
          id: user.userId,
          name: user.zaloName,
          type: "qtv"
        })),
        ...Object.values(highLevelAdminInfo.changed_profiles || {}).map(user => ({
          id: user.userId,
          name: user.zaloName,
          type: "qtv"
        })),
        ...groupAdminList.map(([id, name]) => ({
          id,
          name,
          type: "group"
        }))
      ];

      if (index >= 0 && index < combinedAdminList.length) {
        const { id, name, type } = combinedAdminList[index];
        if (type === "qtv") {
          const updatedHighLevelAdmins = highLevelAdmins.filter(adminId => adminId !== id);
          await fs.writeFile(adminFilePath, JSON.stringify(updatedHighLevelAdmins, null, 2));
          await sendMessageComplete(api, message, `Đã xóa ${name} khỏi danh sách quản trị cấp cao.`);
        } else {
          delete groupSettings[threadId]["adminList"][id];
          await sendMessageComplete(api, message, `Đã xóa ${name} khỏi danh sách quản trị bot của nhóm này.`);
        }
        return;
      } else {
        await sendMessageWarning(api, message, `Số thứ tự không hợp lệ. Vui lòng kiểm tra lại danh sách quản trị viên.`);
        return;
      }
    }
  }

  // Handle high-level admin addition or removal by mention
  if ((action === "add" || action === "remove") && content.includes(`${prefix}${action} qtv`)) {
    if (!mentions || mentions.length === 0) {
      const caption = `Vui lòng đề cập (@mention) người dùng cần ${action === "add" ? "thêm vào" : "xóa khỏi"} danh sách quản trị cấp cao.`;
      await sendMessageQuery(api, message, caption);
      return;
    }

    // Đọc danh sách quản trị viên cấp cao từ tệp
    let highLevelAdmins = [];
    try {
      const data = await fs.readFile(adminFilePath, "utf8");
      highLevelAdmins = JSON.parse(data);
      if (!Array.isArray(highLevelAdmins)) {
        throw new Error(`Tệp ${adminFilePath} không chứa mảng hợp lệ`);
      }
      highLevelAdmins = highLevelAdmins
        .filter(id => typeof id === "string" && id.trim() !== "")
        .map(id => id.trim());
    } catch (error) {
      console.error(`Lỗi khi đọc ${adminFilePath}:`, error.message);
      await sendMessageWarning(api, message, "Lỗi khi đọc danh sách quản trị cấp cao. Vui lòng thử lại sau.");
      return;
    }

    for (const mention of mentions) {
      const targetId = mention.uid;
      const targetName = message.data.content.substring(mention.pos, mention.pos + mention.len).replace("@", "");

      if (action === "add") {
        if (!highLevelAdmins.includes(targetId)) {
          highLevelAdmins.push(targetId);
          await fs.writeFile(adminFilePath, JSON.stringify(highLevelAdmins, null, 2));
          await sendMessageComplete(api, message, `Đã thêm ${targetName} vào danh sách quản trị cấp cao.`);
        } else {
          await sendMessageWarning(api, message, `${targetName} đã có trong danh sách quản trị cấp cao.`);
        }
      } else if (action === "remove") {
        if (highLevelAdmins.includes(targetId)) {
          const updatedHighLevelAdmins = highLevelAdmins.filter(adminId => adminId !== targetId);
          await fs.writeFile(adminFilePath, JSON.stringify(updatedHighLevelAdmins, null, 2));
          await sendMessageComplete(api, message, `Đã xóa ${targetName} khỏi danh sách quản trị cấp cao.`);
        } else {
          await sendMessageWarning(api, message, `${targetName} không có trong danh sách quản trị cấp cao.`);
        }
      }
    }
    return;
  }

  // Handle group admin addition/removal by mention
  if (!mentions || mentions.length === 0) {
    const caption = "Vui lòng đề cập (@mention) người dùng cần thêm/xóa khỏi danh sách quản trị bot của nhóm.";
    await sendMessageQuery(api, message, caption);
    return;
  }

  for (const mention of mentions) {
    const targetId = mention.uid;
    const targetName = message.data.content.substring(mention.pos, mention.pos + mention.len).replace("@", "");

    switch (action) {
      case "add":
        if (!groupSettings[threadId]["adminList"][targetId]) {
          groupSettings[threadId]["adminList"][targetId] = targetName;
          await sendMessageComplete(api, message, `Đã thêm ${targetName} vào danh sách quản trị bot của nhóm này.`);
        } else {
          await sendMessageWarning(api, message, `${targetName} đã có trong danh sách quản trị bot của nhóm này.`);
        }
        break;
      case "remove":
        if (groupSettings[threadId]["adminList"][targetId]) {
          delete groupSettings[threadId]["adminList"][targetId];
          await sendMessageComplete(api, message, `Đã xóa ${targetName} khỏi danh sách quản trị bot của nhóm này.`);
        } else {
          await sendMessageWarning(api, message, `${targetName} không có trong danh sách quản trị bot của nhóm này.`);
        }
        break;
    }
  }
}