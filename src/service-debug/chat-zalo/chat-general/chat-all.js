import { MultiMsgStyle, MessageStyle } from "../../../api-zalo/models/Message.js";
import { getBotId } from "../../../index.js";
import { removeMention } from "../../../utils/format-util.js";
import { getGroupAdmins } from "../../info-service/group-info.js";
import { getGlobalPrefix } from "../../service.js";

export async function chatAll(api, message, groupInfo, aliasCommand) {
  const content = removeMention(message);
  const prefix = getGlobalPrefix();
  const threadId = message.threadId;
  const botId = getBotId();
  const chatMessage = content.replace(`${prefix}${aliasCommand}`, "").trim();
  const [contentTag, countTag = 1, delayTag = 1,ttl = 0] =chatMessage.split("|");
  const groupAdmins = await getGroupAdmins(groupInfo);

  if (chatMessage) {
    for (let i = 0; i < countTag; i++) {
      if (!groupAdmins.includes(botId)) {
        let newChatMessage = contentTag;
        const mentions = groupInfo.memVerList.map((member, index) => {
          newChatMessage += " ";
          return {
            pos: newChatMessage.length + index,
            uid: member.replace(/_0$/, ""),
            len: 1
          };
        });
        await api.sendMessage(
          {
            msg: newChatMessage,
            // style: MultiMsgStyle([MessageStyle(0, newChatMessage.length, "ff3131", "18")]),
            mentions: mentions,
          },
          threadId,
          message.type
        );
      } else {
        await api.sendMessage(
          {
            msg: contentTag,
            // style: MultiMsgStyle([MessageStyle(0, chatMessage.length, "ff3131", "18")]),
            mentions: [{ pos: 0, uid: -1, len: contentTag.length }],
          },
          threadId,
          message.type
        );
      }
      await new Promise(resolve => setTimeout(resolve, delayTag));
    }
  }
}

export async function getObject(api, message, aliasCommand) {
  const content = removeMention(message);
  const prefix = getGlobalPrefix();
  const threadId = message.threadId;
  const botId = getBotId();
  const msgcopy = JSON.parse(JSON.stringify(message));

  if (msgcopy.data?.quote?.attach) {
    msgcopy.data.quote.attach = JSON.stringify(JSON.parse(msgcopy.data.quote.attach));
  }

  if (msgcopy.data?.quote) {
    const objectAsString = JSON.stringify(msgcopy.data.quote, null, 2);
    return api.sendMessage({ msg: objectAsString, ttl: 60000 * 5, quote: message }, threadId, message.type);
  } else {
    return api.sendMessage({ msg: 'Lỗi: Không tìm thấy thông tin quote.', ttl: 60000, quote: message }, threadId, message.type);
  }
}