import { isAdmin } from "../../index.js";
import { sendMessageComplete, sendMessageFailed, sendMessageQuery } from "../../service-debug/chat-zalo/chat-style/chat-style.js";
import { getContent } from "../../utils/format-util.js";

export async function handleRenameCommand(api, message) {
  const senderId = message.data?.uidFrom || message.senderID;
  if (!isAdmin(senderId)) {
    await sendMessageFailed(api, message, "Tuổi cặc đổi tên tao!", false, 10000);
    return true;
  }
  const content = getContent(message);
  const args = content.split(" ");
  args.shift();
  const newName = args.join(" ").trim();
  if (!newName) {
    await sendMessageQuery(api, message, "Vui lòng nhập tên mới để đổi!");
    return true;
  }
  const defaultDob = "2002-12-06";
  const defaultGender = 0;
  try {
    // Convert newName to uppercase
    const transformedName = newName.toUpperCase();
    await api.changeAccountSetting(transformedName, defaultDob, defaultGender);
    await sendMessageComplete(api, message, `Đã đổi tên bot thành: ${transformedName}`);
  } catch (err) {
    console.error(err);
    await sendMessageFailed(api, message, `Đổi tên thất bại: ${err.message}`);
  }
  return true;
}