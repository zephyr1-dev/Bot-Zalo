import { MessageType } from "zlbotdqt";
import { getDataAllGroup } from "../service-debug/info-service/group-info.js";
import { readWebConfig } from "../utils/io-json.js";

let bulkMessageInterval = null;

export async function sendBulkMessage(api, socket, data) {
  const { content, interval, filePaths } = data;
  console.log("Nhận yêu cầu startBulkMessage:", content, interval);
  const bulkMessageContent = content ?? "";
  const bulkImageUrls = Array.isArray(filePaths) ? filePaths : [];
  if (bulkMessageInterval) {
    clearInterval(bulkMessageInterval);
  }

  const sendMessages = async () => {
    try {
      const webConfig = readWebConfig() || { selectedFriends: {}, selectedGroups: {} };
      const selectedFriends = webConfig.selectedFriends ?? {};
      const selectedGroups = webConfig.selectedGroups ?? {};

      for (const friendId in selectedFriends) {
        if (selectedFriends[friendId]) {
          try {
            await api.sendMessage(
              {
                msg: bulkMessageContent,
                attachments: bulkImageUrls,
                ttl: interval,
              },
              friendId,
              MessageType.DirectMessage
            );
          } catch (error) {
            console.warn("Failed to send bulk message to friend", friendId, error?.message || error);
          }
        }
      }

      for (const groupId in selectedGroups) {
        if (selectedGroups[groupId]) {
          try {
            await api.sendMessage(
              {
                msg: bulkMessageContent,
                attachments: bulkImageUrls,
                ttl: interval,
              },
              groupId,
              MessageType.GroupMessage
            );
          } catch (error) {
            console.warn("Failed to send bulk message to group", groupId, error?.message || error);
          }
        }
      }
    } catch (err) {
      console.error("sendBulkMessage encountered an error:", err?.stack || err);
    }
  };

  // interval from client might be in seconds or milliseconds; ensure a safe millisecond value
  const msInterval = Math.max(1000, Number(interval) || 10000);

  await sendMessages();

  bulkMessageInterval = setInterval(sendMessages, msInterval);

  console.log("Đã bắt đầu gửi tin nhắn hàng loạt");
  if (socket && typeof socket.emit === "function") socket.emit("bulkMessageStatus", "started");
}

export async function stopBulkMessage() {
  if (bulkMessageInterval) {
    clearInterval(bulkMessageInterval);
    bulkMessageInterval = null;
  }
}
