import { getCommandConfig } from "../../index.js";
import { getGlobalPrefix } from "../../service-debug/service.js";
import { writeCommandConfig } from "../../utils/io-json.js";

const permissionMap = {
    1: {
        key: "all",
        name: "Tất Cả Người Dùng",
    },
    2: {
        key: "adminBox",
        name: "Trưởng / Phó Cộng Đồng",
    },
    3: {
        key: "adminBot",
        name: "Quản Trị Bot",
    },
    4: {
        key: "adminLevelHigh",
        name: "Quản Trị Cấp Cao",
    },
};

export function getPermissionCommandName(command) {
    const permission = Object.values(permissionMap).find((p) => p.key === command.permission);
    return permission ? permission.name : "Tất Cả Người Dùng";
}


export async function handleSetCommandActive(api, message, commandParts) {
    const commandConfig = getCommandConfig();
    const prefix = getGlobalPrefix();

    if (commandParts.length < 3) {
        await api.sendMessage(
            {
                msg: "⚠️ Vui lòng nhập đúng cú pháp:" +
                    `\n${prefix}setcmd on/off <tên_lệnh> - Bật/tắt lệnh` +
                    `\n${prefix}setcmd p <tên_lệnh> <level> - Đặt quyền hạn lệnh (1-4)` +
                    `\n${prefix}setcmd cd <tên_lệnh> <giây> - Đặt thời gian chờ lệnh`,
                quote: message,
                ttl: 300000,
            },
            message.threadId,
            message.type
        );
        return;
    }

    const action = commandParts[1].toLowerCase();
    const cmdName = commandParts[2].toLowerCase();
    const command = commandConfig.commands.find(cmd => cmd.name === cmdName);

    if (!command) {
        await api.sendMessage(
            {
                msg: `❌ Không tìm thấy lệnh "${cmdName}"`,
                quote: message,
                ttl: 300000,
            },
            message.threadId,
            message.type
        );
        return;
    }

    switch (action) {
        case "on":
        case "off":
            const newActive = action === "on";
            command.active = newActive;
            writeCommandConfig(commandConfig);
            await api.sendMessage(
                {
                    msg: `✅ Đã ${newActive ? "bật" : "tắt"} lệnh "${cmdName}"`,
                    quote: message,
                    ttl: 300000,
                },
                message.threadId,
                message.type
            );
            break;

        case "p":
            if (commandParts.length < 4) {
                await api.sendMessage(
                    {
                        msg: "⚠️ Vui lòng nhập level quyền hạn (1-4):" +
                            "\n1: all (Tất cả)" +
                            "\n2: adminBox (Quản trị viên nhóm)" +
                            "\n3: adminBot (Quản trị viên bot)" +
                            "\n4: adminLevelHigh (Quản trị viên cấp cao)",
                        quote: message,
                        ttl: 300000,
                    },
                    message.threadId,
                    message.type
                );
                return;
            }

            const permissionLevel = parseInt(commandParts[3]);
            const newPermissionObj = permissionMap[permissionLevel];

            if (!newPermissionObj) {
                await api.sendMessage(
                    {
                        msg: "❌ Level quyền hạn Không hợp lệ. Vui lòng chọn từ 1-4:\n" +
                            Object.entries(permissionMap)
                                .map(([level, { key, name }]) => `${level}: ${key} (${name})`)
                                .join("\n"),
                        quote: message,
                        ttl: 300000,
                    },
                    message.threadId,
                    message.type
                );
                return;
            }

            command.permission = newPermissionObj.key;
            writeCommandConfig(commandConfig);
            await api.sendMessage(
                {
                    msg: `✅ Đã thay đổi quyền hạn của lệnh "${cmdName}":\n- Quyền hạn mới: ${newPermissionObj.name}`,
                    quote: message,
                    ttl: 300000,
                },
                message.threadId,
                message.type
            );
            break;

        case "cd":
            if (commandParts.length < 4) {
                await api.sendMessage(
                    {
                        msg: `⚠️ Vui lòng nhập thời gian chờ (tính bằng giây)`,
                        quote: message,
                        ttl: 300000,
                    },
                    message.threadId,
                    message.type
                );
                return;
            }

            const newCountdown = parseInt(commandParts[3]);
            if (isNaN(newCountdown) || newCountdown < 0) {
                await api.sendMessage(
                    {
                        msg: "❌ Thời gian countdown phải là số nguyên dương",
                        quote: message,
                        ttl: 300000,
                    },
                    message.threadId,
                    message.type
                );
                return;
            }

            const oldCountdown = command.countdown || 0;
            command.countdown = newCountdown;
            writeCommandConfig(commandConfig);
            await api.sendMessage(
                {
                    msg: `✅ Đã cập nhật thời gian chờ của lệnh "${cmdName}":\n- Cũ: ${oldCountdown}s\n- Mới: ${newCountdown}s`,
                    quote: message,
                    ttl: 300000,
                },
                message.threadId,
                message.type
            );
            break;

        default:
            await api.sendMessage(
                {
                    msg: `❌ Hành động Không hợp lệ. Vui lòng sử dụng:` +
                        `\n- on/off: Bật/tắt lệnh` +
                        `\n- p: Đặt quyền hạn` +
                        `\n- cd: Đặt thời gian chờ`,
                    quote: message,
                    ttl: 300000,
                },
                message.threadId,
                message.type
            );
            break;
    }
}