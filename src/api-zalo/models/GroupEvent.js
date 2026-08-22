import { appContext } from "../context.js";
import { logMessageToFile } from "../../utils/io-json.js";

export const GroupEventType = {
  JOIN_REQUEST: 0,
  JOIN: 1,
  LEAVE: 2,
  REMOVE_MEMBER: 3,
  BLOCK_MEMBER: 4,
  UPDATE_SETTING: 5,
  UPDATE: 6,
  NEW_LINK: 7,
  ADD_ADMIN: 8,
  REMOVE_ADMIN: 9,
  NEW_PIN_TOPIC: 10,
  UPDATE_TOPIC: 11,
  UPDATE_BOARD: 12,
  REORDER_PIN_TOPIC: 13,
  UNPIN_TOPIC: 14,
  REMOVE_TOPIC: 15,
  UNKNOWN: 16,
};

export function initializeGroupEvent(data, type) {
  const threadId = data.groupId;
  if (type === GroupEventType.JOIN_REQUEST) {
    return { type, data: data, threadId, isSelf: false };
  } else if (
    type === GroupEventType.NEW_PIN_TOPIC ||
    type === GroupEventType.UNPIN_TOPIC ||
    type === GroupEventType.REORDER_PIN_TOPIC
  ) {
    return {
      type,
      data: data,
      threadId,
      isSelf: data.actorId === appContext.uid,
    };
  } else {
    const baseData = data;
    logMessageToFile(
      `${data.groupName}\nType Sự Kiện: ${typeToString(type)} - Số Lượng Member Trong Sự Kiện: ${
        baseData.updateMembers ? baseData.updateMembers.length : 0
      }\n`,
      "group"
    );
    if (baseData.updateMembers) {
      return {
        type,
        data: baseData,
        threadId,
        isSelf:
          baseData.updateMembers.some((member) => member.id === appContext.uid) || baseData.sourceId === appContext.uid,
      };
    } else {
      return {
        type,
        data: baseData,
        threadId,
        isSelf: false,
      };
    }
  }
}

function typeToString(type) {
  switch (type) {
    case GroupEventType.JOIN_REQUEST:
      return "JOIN_REQUEST";
    case GroupEventType.JOIN:
      return "JOIN";
    case GroupEventType.LEAVE:
      return "LEAVE";
    case GroupEventType.REMOVE_MEMBER:
      return "REMOVE_MEMBER";
    case GroupEventType.BLOCK_MEMBER:
      return "BLOCK_MEMBER";
    case GroupEventType.UPDATE_SETTING:
      return "UPDATE_SETTING";
    case GroupEventType.UPDATE:
      return "UPDATE";
    case GroupEventType.NEW_LINK:
      return "NEW_LINK";
    case GroupEventType.ADD_ADMIN:
      return "ADD_ADMIN";
    case GroupEventType.REMOVE_ADMIN:
      return "REMOVE_ADMIN";
    case GroupEventType.NEW_PIN_TOPIC:
      return "NEW_PIN_TOPIC";
    case GroupEventType.UPDATE_TOPIC:
      return "UPDATE_TOPIC";
    case GroupEventType.UPDATE_BOARD:
      return "UPDATE_BOARD";
    case GroupEventType.REORDER_PIN_TOPIC:
      return "REORDER_PIN_TOPIC";
    case GroupEventType.UNPIN_TOPIC:
      return "UNPIN_TOPIC";
    case GroupEventType.REMOVE_TOPIC:
      return "REMOVE_TOPIC";
    default:
      return String(type);
  }
}
