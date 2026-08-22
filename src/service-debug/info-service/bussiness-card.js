import { removeMention } from "../../utils/format-util.js";
import { getGlobalPrefix } from "../service.js";

export async function userBussinessCardCommand(api, message, aliasCommand) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const prefixCommand = getGlobalPrefix();
  const content = removeMention(message);
  const textString = content
    .replace(`${prefixCommand}${aliasCommand}`, "")
    .trim();

  try {
    const targetUserId =
      message.data.mentions?.length > 0
        ? message.data.mentions.map((mention) => mention.uid)
        : [senderId];
    for (const userId of targetUserId) {
      await api.sendBusinessCard(
        null,
        userId,
        textString,
        message.type,
        threadId,
        600000
      );
    }
  } catch (error) {
    console.error("Lỗi khi lấy thông tin người dùng:", error);
  }
}
