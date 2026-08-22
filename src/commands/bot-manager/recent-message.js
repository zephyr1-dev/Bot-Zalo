import { getBotId, isAdmin } from "../../index.js";
import { sendMessageStateQuote } from "../../service-debug/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../service-debug/service.js";
import { removeMention } from "../../utils/format-util.js";

export async function handleDeleteMessage(api, message, groupAdmins, aliasCommand) {
  const content = removeMention(message);
  const prefixGlobal = getGlobalPrefix(message);
  const keyContent = content.replace(`${prefixGlobal}${aliasCommand}`, "").trim();
  const [count, target = "normal"] = keyContent.split(" ");
  const idBot = getBotId();
  let countDelete = 0;
  let countDeleteFail = 0;

  if (message.data?.quote) {
    const cliMsgId = message.data.quote.cliMsgId;
    const msgId = message.data.quote.globalMsgId;
    const uidFrom = message.data.quote.ownerId === "0" ? idBot : message.data.quote.ownerId;
    
    const msgDel = await findAndDeleteMessage(api, message, {
      cliMsgId,
      msgId,
      uidFrom
    });

    if (msgDel) {
      await sendMessageStateQuote(api, message, "Tin nhắn đã được xóa rồi nhé", true, 5000);
    } else {
      await sendMessageStateQuote(api, message, "Đếch tìm thấy tin nhắn cần xóa", false, 5000);
    }
    return;
  }

  if (count <= 0) {
    await sendMessageStateQuote(api, message, "Hãy nhập phạm vi số lượng tin nhắn cần check", false, 10000);
    return;
  }

  const recentMessage = await getRecentMessage(api, message, count);
  let mentionTarget = [];
  if (message.data.mentions) {
    for (const mention of message.data.mentions) {
      mentionTarget.push(mention.uid);
    }
  }

  const deletePromises = recentMessage
    .filter(msg =>
      target === "all" ||
      mentionTarget.includes(msg.uidFrom) ||
      (mentionTarget.includes(idBot) && msg.uidFrom === "0")
    )
    .map(msg => {
      const msgDel = {
        type: message.type,
        threadId: message.threadId,
        data: {
          cliMsgId: msg.cliMsgId,
          msgId: msg.msgId,
          uidFrom: msg.uidFrom === "0" ? idBot : msg.uidFrom,
        },
      };

      return api.deleteMessage(msgDel, false)
        .then(() => {
          countDelete++;
          return true;
        })
        .catch(error => {
          countDeleteFail++;
          return false;
        });
    });

  await Promise.all(deletePromises);

  const caption = `${countDelete > 0 ? `Thành công xóa ${countDelete} tin nhắn` : "Đếch có tin nhắn nào được xóa"}` +
    `${countDeleteFail > 0 ? `\nCó ${countDeleteFail} tin nhắn Không xóa được` : ""}`;
  await sendMessageStateQuote(api, message, caption, true, 60000);
}

export async function getRecentMessage(api, message, count = 50) {
  const threadId = message.threadId || message.idTo;
  const globalMsgId = message.data.msgId || message.msgId;
  let allMessages = [];
  let currentMsgId = globalMsgId;

  try {
    while (allMessages.length < count) {
      const recentMessage = await api.getRecentMessages(threadId, currentMsgId, 50);
      const parsedMessage = JSON.parse(recentMessage);
      const messages = parsedMessage.groupMsgs;

      if (!messages || messages.length === 0) {
        break;
      }

      allMessages = [...allMessages, ...messages.sort((a, b) => b.ts - a.ts)];
      currentMsgId = messages[messages.length - 1].msgId;
    }
  } catch (error) {
    console.log(error);
  }

  const sortedMessages = allMessages.sort((a, b) => b.ts - a.ts);
  return sortedMessages.slice(0, count);
}

async function findAndDeleteMessage(api, message, targetMsg) {
  const threadId = message.threadId || message.idTo;
  const globalMsgId = message.data.msgId || message.msgId;
  let currentMsgId = globalMsgId;
  const maxAttempts = 100;
  let attempts = 0;
  
  const currentTime = Date.now();
  const oneDayInMs = 24 * 60 * 60 * 1000;

  try {
    while (attempts < maxAttempts) {
      const recentMessage = await api.getRecentMessages(threadId, currentMsgId, 50);
      const parsedMessage = JSON.parse(recentMessage);
      
      if (parsedMessage.groupMsgs) {
        parsedMessage.groupMsgs.sort((a, b) => Number(b.ts) - Number(a.ts));
      }
      
      const messages = parsedMessage.groupMsgs;

      if (!messages || messages.length === 0) {
        break;
      }

      const lastMessageTime = Number(messages[messages.length - 1].ts);
      if (currentTime - lastMessageTime > oneDayInMs) {
        break;
      }

      const foundMsg = messages.find(msg => 
        msg.cliMsgId === String(targetMsg.cliMsgId) && 
        msg.msgId === String(targetMsg.msgId)
      );

      if (foundMsg) {
        const msgDel = {
          type: message.type,
          threadId: message.threadId,
          data: {
            cliMsgId: foundMsg.cliMsgId,
            msgId: foundMsg.msgId,
            uidFrom: foundMsg.uidFrom === "0" ? getBotId() : foundMsg.uidFrom,
          },
        };

        try {
          await api.deleteMessage(msgDel, false);
          return true;
        } catch (error) {
          console.error("Lỗi khi xóa tin nhắn:", error);
          return false;
        }
      }

      currentMsgId = messages[messages.length - 1].msgId;
      attempts++;
    }
  } catch (error) {
    console.error("Lỗi khi tìm tin nhắn:", error);
  }

  return false;
}

