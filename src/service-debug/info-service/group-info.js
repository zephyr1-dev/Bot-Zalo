import { MessageType } from "zlbotdqt";
import { createGroupInfoImage, clearImagePath } from "../../utils/canvas/index.js";
import { sendMessageWarning } from "../chat-zalo/chat-style/chat-style.js";
import { getUserInfoData } from "./user-info.js";

const groupInfoCache = new Map();
const CACHE_DURATION = 10000;

export async function groupInfoCommand(api, message) {
  const threadId = message.threadId;

  try {
    const groupInfo = await getGroupInfoData(api, threadId);
    const owner = await getUserInfoData(api, groupInfo.creatorId);
    const imagePath = await createGroupInfoImage(groupInfo, owner);
    await api.sendMessage({ msg: "", attachments: [imagePath], quote: message, ttl:600000 }, threadId, MessageType.GroupMessage);
    clearImagePath(imagePath);
  } catch (error) {
    await sendMessageWarning(api, message, "Đã xảy ra lỗi khi lấy thông tin nhóm. Vui lòng thử lại sau!");
  }
}

export async function getGroupAdmins(groupInfo) {
  try {
    const admins = groupInfo.adminIds || [];
    const creatorId = groupInfo.creatorId;

    if (creatorId && !admins.includes(creatorId)) {
      admins.push(creatorId);
    }

    return admins;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách quản trị viên nhóm:", error);
    return [];
  }
}

export async function getGroupName(api, threadId) {
  try {
    const groupInfoResponse = await api.getGroupInfo(threadId);
    const groupName = groupInfoResponse.gridInfoMap[threadId].name;

    return groupName;
  } catch (error) {
    console.error("Lỗi khi lấy tên nhóm:", error);
    return [];
  }
}

export async function getGroupInfoData(api, threadId) {
  const now = Date.now();
  const cachedData = groupInfoCache.get(threadId);

  if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
    return cachedData.data;
  }

  const groupInfo = await api.getGroupInfo(threadId);
  const processedInfo = getAllInfoGroup(groupInfo, threadId);

  groupInfoCache.set(threadId, {
    data: processedInfo,
    timestamp: now
  });

  return processedInfo;
}

function getAllInfoGroup(groupInfo, threadId) {
  return {
    name: groupInfo.gridInfoMap[threadId].name,
    memberCount: groupInfo.gridInfoMap[threadId].memVerList.length,
    createdTime: new Date(groupInfo.gridInfoMap[threadId].createdTime).toLocaleString(),
    groupType: groupInfo.gridInfoMap[threadId].type,
    memVerList: groupInfo.gridInfoMap[threadId].memVerList,
    creatorId: groupInfo.gridInfoMap[threadId].creatorId,
    adminIds: groupInfo.gridInfoMap[threadId].adminIds,
    admins: groupInfo.gridInfoMap[threadId].admins,
    avt: groupInfo.gridInfoMap[threadId].avt,
    fullAvt: groupInfo.gridInfoMap[threadId].fullAvt,
    globalId: groupInfo.gridInfoMap[threadId].globalId,
    groupId: groupInfo.gridInfoMap[threadId].groupId,
    desc: groupInfo.gridInfoMap[threadId].desc,
    setting: groupInfo.gridInfoMap[threadId].setting,
    totalMember: groupInfo.gridInfoMap[threadId].totalMember,
  };
}

export async function getDataAllGroup(api) {
  try {
    const allGroupsResult = await api.getAllGroups();

    if (!allGroupsResult || !allGroupsResult.gridVerMap) {
      throw new Error("Không thể lấy danh sách nhóm");
    }

    const groupIds = Object.keys(allGroupsResult.gridVerMap);

    const allGroupsInfo = await Promise.all(
      groupIds.map(async (threadId) => {
        try {
          const groupInfo = await getGroupInfoData(api, threadId);
          return groupInfo;
        } catch (error) {
          console.error(`Lỗi khi lấy thông tin nhóm ${threadId}:`, error);
          return null;
        }
      })
    );

    const validGroupsInfo = allGroupsInfo.filter((info) => info !== null);

    return validGroupsInfo;
  } catch (error) {
    console.error("Lỗi khi lấy thông tin tất cả các nhóm:", error);
    throw error;
  }
}