import fs from "fs";
import path from "path";
import { MessageType } from "zlbotdqt";
import { readGroupSettings } from "../../utils/io-json.js";

const rankInfoPath = path.join(process.cwd(), "assets", "json-data", "rank-info.json");

function readRankInfo() {
  try {
    const data = JSON.parse(fs.readFileSync(rankInfoPath, "utf8"));
    if (!data) data = {};
    if (!data.groups) data.groups = {};
    return data;
  } catch (error) {
    console.error("Lỗi khi đọc file rank-info.json:", error);
    return { groups: {} };
  }
}

function writeRankInfo(data) {
  try {
    fs.writeFileSync(rankInfoPath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Lỗi khi ghi file rank-info.json:", error);
  }
}

export function updateUserRank(groupId, userId, userName, nameGroup) {
  const rankInfo = readRankInfo();
  if (!rankInfo.groups[groupId]) {
    rankInfo.groups[groupId] = { users: [] };
  }
  if (rankInfo.groups[groupId].nameGroup !== nameGroup) {
    rankInfo.groups[groupId].nameGroup = nameGroup;
  }

  const userIndex = rankInfo.groups[groupId].users.findIndex((user) => user.UID === userId);
  if (userIndex !== -1) {
    rankInfo.groups[groupId].users[userIndex].Rank++;
    rankInfo.groups[groupId].users[userIndex].UserName = userName;
  } else {
    rankInfo.groups[groupId].users.push({
      UserName: userName,
      UID: userId,
      Rank: 1,
    });
  }

  writeRankInfo(rankInfo);
}

export async function handleRankCommand(api, message) {
  const threadId = message.threadId;

  const rankInfo = readRankInfo();
  const groupUsers = rankInfo.groups[threadId]?.users || [];

  if (groupUsers.length === 0) {
    await api.sendMessage(
      { msg: "Chưa có dữ liệu xếp hạng cho nhóm này.", quote: message },
      threadId,
      MessageType.GroupMessage
    );
    return;
  }

  const sortedUsers = groupUsers.sort((a, b) => b.Rank - a.Rank);
  const top10Users = sortedUsers.slice(0, 10);

  let rankMessage = "🏆 Bảng xếp hạng tương tác top 10:\n\n";
  top10Users.forEach((user, index) => {
    rankMessage += `${index + 1}. ${user.UserName}: ${user.Rank} tin nhắn\n`;
  });

  await api.sendMessage({ msg: rankMessage, quote: message }, threadId, MessageType.GroupMessage);
}

export async function initRankSystem() {
  const groupSettings = readGroupSettings();
  const rankInfo = readRankInfo();

  for (const [groupId, groupData] of Object.entries(groupSettings)) {
    if (!rankInfo.groups[groupId]) {
      rankInfo.groups[groupId] = { users: [] };
    }

    if (groupData["adminList"]) {
      for (const [userId, userName] of Object.entries(groupData["adminList"])) {
        const existingUser = rankInfo.groups[groupId].users.find((user) => user.UID === userId);
        if (!existingUser) {
          rankInfo.groups[groupId].users.push({
            UserName: userName,
            UID: userId,
            Rank: 0,
          });
        }
      }
    }
  }

  writeRankInfo(rankInfo);
}
