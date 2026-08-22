import { MultiMsgStyle, MessageStyle, MessageType } from "../../../api-zalo/index.js";
import { nameServer } from "../../../database/index.js";

export const COLOR_RED = "db342e";
export const COLOR_YELLOW = "f7b503";
export const COLOR_GREEN = "15a85f";
export const SIZE_18 = "18";
export const SIZE_16 = "14";
export const IS_BOLD = true;

export async function sendMessageInsufficientAuthority(api, message, caption, hasState = true) {
  try {
    const senderName = message.data.dName;
    const senderId = message.data.uidFrom;
    const threadId = message.threadId;
    const iconState = "\n🚫🚫🚫";
    const isGroup = message.type === MessageType.GroupMessage;

    const style = MultiMsgStyle([MessageStyle(isGroup ? senderName.length + 1 : 0, nameServer.length, COLOR_RED, SIZE_18, IS_BOLD)]);

    let msg = `${isGroup ? senderName + "\n" : ""}${nameServer}` + `\n${caption}${hasState ? iconState : ""}`;
    await api.sendMessage(
      {
        msg: msg,
        quote: message,
        mentions: [{ pos: 0, uid: senderId, len: senderName.length }],
        ttl: 60000,
        style: style,
        linkOn: false,
      },
      threadId,
      message.type
    );
  } catch (error) {
    console.log(error);
  }
}

export async function sendMessageQuery(api, message, caption, hasState = true) {
  try {
    const senderName = message.data.dName;
    const senderId = message.data.uidFrom;
    const threadId = message.threadId;
    const isGroup = message.type === MessageType.GroupMessage;
    const iconState = "\n❓❓❓";

    const style = MultiMsgStyle([MessageStyle(isGroup ? senderName.length + 1 : 0, nameServer.length, COLOR_RED, SIZE_18, IS_BOLD)]);

    let msg = `${isGroup ? senderName + "\n" : ""}${nameServer}` + `\n${caption}${hasState ? iconState : ""}`;
    await api.sendMessage(
      {
        msg: msg,
        quote: message,
        mentions: [{ pos: 0, uid: senderId, len: senderName.length }],
        ttl: 60000,
        style: style,
        linkOn: false,
      },
      threadId,
      message.type
    );
  } catch (error) {
    console.log(error);
  }
}

export async function sendMessageWarning(api, message, caption, hasState = true) {
  try {
    const senderName = message.data.dName;
    const senderId = message.data.uidFrom;
    const threadId = message.threadId;
    const isGroup = message.type === MessageType.GroupMessage;
    const iconState = "\n🚨🚨🚨";

    const style = MultiMsgStyle([MessageStyle(isGroup ? senderName.length + 1 : 0, nameServer.length, COLOR_RED, SIZE_18, IS_BOLD)]);

    let msg = `${isGroup ? senderName + "\n" : ""}${nameServer}` + `\n${caption}${hasState ? iconState : ""}`;
    await api.sendMessage(
      {
        msg: msg,
        quote: message,
        mentions: [{ pos: 0, uid: senderId, len: senderName.length }],
        ttl: 60000,
        style: style,
        linkOn: false,
      },
      threadId,
      message.type
    );
  } catch (error) {
    console.log(error);
  }
}

export async function sendMessageComplete(api, message, caption, hasState = true) {
  try {
    const senderName = message.data.dName;
    const senderId = message.data.uidFrom;
    const threadId = message.threadId;
    const isGroup = message.type === MessageType.GroupMessage;
    const iconState = "\n✅✅✅";

    const style = MultiMsgStyle([MessageStyle(isGroup ? senderName.length + 1 : 0, nameServer.length, COLOR_RED, SIZE_18, IS_BOLD)]);

    let msg = `${isGroup ? senderName + "\n" : ""}${nameServer}` + `\n${caption}${hasState ? iconState : ""}`;
    await api.sendMessage(
      {
        msg: msg,
        quote: message,
        mentions: [{ pos: 0, uid: senderId, len: senderName.length }],
        ttl: 60000,
        style: style,
        linkOn: false,
      },
      threadId,
      message.type
    );
  } catch (error) {
    console.log(error);
  }
}

export async function sendMessageFailed(api, message, caption, hasState = true) {
  try {
    const senderName = message.data.dName;
    const senderId = message.data.uidFrom;
    const threadId = message.threadId;
    const isGroup = message.type === MessageType.GroupMessage;
    const iconState = "\n❌❌❌";

    const style = MultiMsgStyle([MessageStyle(isGroup ? senderName.length + 1 : 0, nameServer.length, COLOR_RED, SIZE_18, IS_BOLD)]);

    let msg = `${isGroup ? senderName + "\n" : ""}${nameServer}` + `\n${caption}${hasState ? iconState : ""}`;
    await api.sendMessage(
      {
        msg: msg,
        quote: message,
        mentions: [{ pos: 0, uid: senderId, len: senderName.length }],
        ttl: 60000,
        style: style,
        linkOn: false,
      },
      threadId,
      message.type
    );
  } catch (error) {
    console.log(error);
  }
}

export async function sendMessageStateQuote(api, message, caption, state, ttl = 0, onState = true) {
  try {
    const senderName = message.data.dName;
    const senderId = message.data.uidFrom;
    const threadId = message.threadId;
    const iconState = state ? "✅✅✅" : "❌❌❌";
    const style = MultiMsgStyle([MessageStyle(senderName.length + 1, nameServer.length, COLOR_RED, SIZE_18, IS_BOLD)]);
    let msg = `${senderName}\n${nameServer}` + `\n${caption}${onState ? "\n" + iconState : ""}`;
    await api.sendMessage(
      {
        msg: msg,
        quote: message,
        mentions: [{ pos: 0, uid: senderId, len: senderName.length }],
        style: style,
        ttl: ttl,
        linkOn: false,
      },
      threadId,
      message.type
    );
  } catch (error) {
    console.log(error);
  }
}

export async function sendMessageState(api, threadId, caption, state, ttl = 0) {
  try {
    const iconState = state ? "✅✅✅" : "❌❌❌";
    const style = MultiMsgStyle([MessageStyle(0, nameServer.length, COLOR_RED, SIZE_18, IS_BOLD)]);
    let msg = `${nameServer}` + `\n${caption}\n${iconState}`;
    await api.sendMessage(
      {
        msg: msg,
        style: style,
        ttl: ttl,
        linkOn: false,
      },
      threadId,
      MessageType.GroupMessage
    );
  } catch (error) {
    console.log(error);
  }
}

export async function sendMessageResultRequest(api, type = MessageType.GroupMessage, threadId, caption, state, ttl = 0) {
  try {
    const iconState = state ? "✅✅✅" : "❌❌❌";
    const style = MultiMsgStyle([MessageStyle(0, nameServer.length, COLOR_RED, SIZE_18, IS_BOLD)]);
    let msg = `${nameServer}` + `\n${caption}\n${iconState}`;
    await api.sendMessage(
      {
        msg: msg,
        style: style,
        ttl: ttl,
        linkOn: false,
      },
      threadId,
      type
    );
  } catch (error) {
    console.log(error);
  }
}

export async function sendMessageFromSQL(api, message, result, hasState = true, ttl = 0) {
  try {
    const threadId = message.threadId;
    const senderId = message.data.uidFrom;
    const senderName = message.data.dName;
    const isGroup = message.type === MessageType.GroupMessage;

    const style = MultiMsgStyle([MessageStyle(isGroup ? senderName.length + 1 : 0, nameServer.length, COLOR_RED, SIZE_18, IS_BOLD)]);

    let msg = `${isGroup ? senderName + "\n" : ""}${nameServer}` + `\n${result.message}`;
    if (hasState) {
      const state = result.success ? "✅✅✅" : "❌❌❌";
      msg += `\n${state}`;
    }
    await api.sendMessage(
      {
        msg: msg,
        mentions: [{ pos: 0, uid: senderId, len: senderName.length }],
        style: style,
        quote: message,
        linkOn: false,
        ttl: ttl,
      },
      threadId,
      message.type
    );
  } catch (error) {
    console.log(error);
  }
}

export async function sendMessageImageNotQuote(api, result, threadId, waitingImagePath, ttl = 0, isUseProphylactic = false) {
  const style = MultiMsgStyle([MessageStyle(0, nameServer.length, COLOR_RED, SIZE_18, IS_BOLD)]);
  try {
    await api.sendMessage(
      {
        msg: result.message,
        attachments: [waitingImagePath],
        isUseProphylactic: isUseProphylactic,
        ttl: ttl,
        style: style,
        linkOn: false,
        mentions: result.mentions,
      },
      threadId,
      MessageType.GroupMessage
    );
  } catch (error) {
    console.log(error);
  }
}

export async function sendMessageFromSQLImage(api, message, result, hasState = true, waitingImagePath) {
  try {
    const threadId = message.threadId;
    const senderId = message.data.uidFrom;
    const senderName = message.data.dName;
    const isGroup = message.type === MessageType.GroupMessage;

    const style = MultiMsgStyle([MessageStyle(isGroup ? senderName.length + 1 : 0, nameServer.length, COLOR_RED, SIZE_18, IS_BOLD)]);

    let msg = `${isGroup ? senderName + "\n" : ""}${nameServer}` + `\n${result.message}`;
    if (hasState) {
      const state = result.success ? "✅✅✅" : "❌❌❌";
      msg += `\n${state}`;
    }
    await api.sendMessage(
      {
        msg: msg,
        mentions: [{ pos: 0, uid: senderId, len: senderName.length }],
        attachments: waitingImagePath ? [waitingImagePath] : [],
        style: style,
        linkOn: false,
      },
      threadId,
      message.type
    );
  } catch (error) {
    console.log(error);
  }
}

export async function sendMessageWarningRequest(api, message, objectData, ttl = 0) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const isGroup = message.type === MessageType.GroupMessage;

  const style = MultiMsgStyle([MessageStyle(isGroup ? senderName.length + 1 : 0, objectData.caption.length, COLOR_RED, SIZE_16, IS_BOLD)]);
  let msg = `${isGroup ? senderName + "\n" : ""}` + `${objectData.caption}`;

  return await api.sendMessage(
    {
      msg: msg,
      mentions: [{ pos: 0, uid: senderId, len: senderName.length }],
      attachments: objectData.imagePath ? [objectData.imagePath] : [],
      style,
      ttl,
      linkOn: false,
    },
    threadId,
    message.type
  );
}

export async function sendMessageProcessingRequest(api, message, objectData, ttl = 0) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const isGroup = message.type === MessageType.GroupMessage;

  const style = MultiMsgStyle([
    MessageStyle(isGroup ? senderName.length + 1 : 0, objectData.caption.length, COLOR_YELLOW, SIZE_16, IS_BOLD),
  ]);
  let msg = `${isGroup ? senderName + "\n" : ""}` + `${objectData.caption}`;

  return await api.sendMessage(
    {
      msg: msg,
      mentions: [{ pos: 0, uid: senderId, len: senderName.length }],
      attachments: objectData.imagePath ? [objectData.imagePath] : [],
      style,
      ttl,
      linkOn: false,
    },
    threadId,
    message.type
  );
}

export async function sendMessageCompleteRequest(api, message, objectData, ttl = 0) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const isGroup = message.type === MessageType.GroupMessage;

  const style = MultiMsgStyle([
    MessageStyle(isGroup ? senderName.length + 1 : 0, objectData.caption.length, COLOR_GREEN, SIZE_16, IS_BOLD),
  ]);
  let msg = `${isGroup ? senderName + "\n" : ""}` + `${objectData.caption}`;

  return await api.sendMessage(
    {
      msg: msg,
      mentions: [{ pos: 0, uid: senderId, len: senderName.length }],
      attachments: objectData.imagePath ? [objectData.imagePath] : [],
      style,
      ttl,
      linkOn: false,
    },
    threadId,
    message.type
  );
}

export async function sendMessageTag(api, message, objectData, ttl = 0) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const isGroup = message.type === MessageType.GroupMessage;

  const style = MultiMsgStyle([
    MessageStyle(isGroup ? senderName.length + 1 : 0, objectData.caption.length, COLOR_GREEN, SIZE_16, IS_BOLD),
  ]);
  
  // Tạo prefix string
  let temp = `${isGroup ? senderName + "\n" : ""}`;
  let msg = temp + `${objectData.caption}`;

  // Điều chỉnh vị trí mentions
  if (objectData.mentions && Array.isArray(objectData.mentions)) {
    objectData.mentions = objectData.mentions.map(mention => ({
      ...mention,
      pos: mention.pos + temp.length // Cộng thêm độ dài của temp vào pos
    }));
  }

  return await api.sendMessage(
    {
      msg: msg,
      mentions: [
        { pos: 0, uid: senderId, len: senderName.length }, // Tag người gửi
        ...(objectData.mentions || []) // Tag các mentions khác
      ],
      attachments: objectData.imagePath ? [objectData.imagePath] : [],
      style,
      ttl,
      linkOn: false,
    },
    threadId,
    message.type
  );
}
