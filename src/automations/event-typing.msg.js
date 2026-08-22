import { MessageType } from "../../src/api-zalo/index.js";
import { isAdmin } from "../../src/index.js";

export async function typingEvents(api, typingData) {
    const threadId = typingData.groupId || null;
    const isPC = typingData.isPC;
    const type = typingData.type === "gtyping" ? MessageType.GroupMessage : MessageType.DirectMessage;
    const userId = typingData.userId;
    const isAdminLevelHighest = isAdmin(userId);
    if (typingData.type === "gtyping") {
        if (!isAdminLevelHighest) {
            const userInfo = await api.getGroupMembers([userId + "_0"]);
            const nameUser = userInfo.profiles[userId].zaloName;
            await api.sendMessage(
                { msg: `${nameUser} đang định nhắn gì đó bằng ${isPC ? "Máy Tính" : "Điện Thoại"}`, ttl: 5000 },
                threadId || userId,
                type
            );
        }
    }
}