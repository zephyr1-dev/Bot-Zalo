import { LRUCache } from 'lru-cache';
import { getBotId, isAdmin } from "../../index.js";
import { sendMessageComplete, sendMessageCompleteRequest, sendMessageFailed, sendMessageQuery, sendMessageTag, sendMessageWarning } from "../../service-debug/chat-zalo/chat-style/chat-style.js";
import { getGroupAdmins } from "../../service-debug/info-service/group-info.js";
import { getGlobalPrefix } from "../../service-debug/service.js";
import { removeMention } from "../../utils/format-util.js";

const TIME_WAIT_SELECTION = 60000;
const scanResultsMap = new LRUCache({
	max: 500,
	ttl: TIME_WAIT_SELECTION
});

// Thêm hàm helper để chia mảng
function chunkArray(array, chunkSize) {
	const chunks = [];
	for (let i = 0; i < array.length; i += chunkSize) {
		chunks.push(array.slice(i, i + chunkSize));
	}
	return chunks;
}

// Thêm hàm helper để lấy members
async function getMembersInfo(api, memberIds) {
	try {
		if (memberIds.length <= 500) {
			const result = await api.getGroupMembers(memberIds);
			return Object.values(result.profiles);
		}

		// Chia thành các chunks nhỏ hơn 500
		const chunks = chunkArray(memberIds, 500);
		let allMembers = [];

		// Request từng chunk và gộp kết quả
		for (const chunk of chunks) {
			const result = await api.getGroupMembers(chunk);
			allMembers = [...allMembers, ...Object.values(result.profiles)];
		}

		return allMembers;
	} catch (error) {
		console.error("Error getting members info:", error);
		throw error;
	}
}

export async function scanGroupsWithAction(api, message, groupInfo, aliasCommand) {
	const prefixCommand = getGlobalPrefix();
	let content = removeMention(message);
	content = content.replace(`${prefixCommand}${aliasCommand}`, "").trim();
	const idBot = getBotId();
	const groupAdmins = await getGroupAdmins(groupInfo);
	const botIsAdminBox = groupAdmins.includes(idBot.toString());

	const args = content.split(" ");
	const action = args[0]?.toLowerCase();
	const searchTerm = args.slice(1).join(" ");

	const VALID_ACTIONS = {
		find: "kết quả khớp hoàn toàn",
		findmatch: "kết quả khớp một phần",
		tìm: "kết quả khớp hoàn toàn",
		findtag: "kết quả khớp hoàn toàn và tag",
		findmatchtag: "kết quả khớp một phần và tag",
	};

	if (!action || !VALID_ACTIONS[action]) {
		return sendMessageQuery(
			api,
			message,
			`⚠️ Vui lòng nhập lệnh với 1 trong các hành động: ${Object.keys(VALID_ACTIONS).join(", ")}!\n` +
			`Ví dụ: ${prefixCommand}${aliasCommand} find tên_thành_viên`,
			true
		);
	}

	if (!searchTerm) {
		return sendMessageQuery(
			api,
			message,
			"⚠️ Vui lòng nhập từ khóa tìm kiếm!",
			true
		);
	}
	try {
		const members = await getMembersInfo(api, groupInfo.memVerList);

		const searchFunction = action === "findmatch" || action === "findmatchtag"
			? member => {
				const memberName = member.zaloName.toLowerCase();
				const search = searchTerm.toLowerCase();
				return (memberName.includes(search)) && idBot !== member.id;
			}
			: member => member.zaloName.toLowerCase() === searchTerm.toLowerCase() && idBot !== member.id;

		const searchResults = members.filter(searchFunction);

		let msg;
		let mentions = [];
		let mentionPos = 0;

		if (searchResults.length) {
			if (action === "findmatchtag" || action === "findtag") {
				msg = `🔍 Kết quả tìm kiếm cho "${searchTerm}" trong nhóm ${groupInfo.name}:\n\n`;
				mentionPos = msg.length;

				msg += searchResults.map((member, index) => {
					const indexString = `${index + 1}. `;
					const memberText = `${indexString}@${member.zaloName}\n  - ID: ${member.id}`;

					// Tính lại mentionPos cho mỗi mention
					const currentPos = mentionPos + indexString.length;

					mentions.push({
						uid: member.id,
						len: member.zaloName.length + 1,
						pos: currentPos
					});

					// Cập nhật mentionPos cho item tiếp theo
					mentionPos += memberText.length + 2; // +2 cho \n\n
					return memberText;
				}).join("\n\n");

				if (botIsAdminBox) {
					msg += `\n\nReply tin nhắn với từ khóa kick/block để thực hiện hành động với các tài khoản này!`;
				}
			} else {
				msg = `🔍 Kết quả tìm kiếm cho "${searchTerm}" trong nhóm ${groupInfo.name}:\n` +
					`${searchResults.map((member, index) => `${index + 1}. ${member.zaloName}\n  - ID: ${member.id}`).join("\n")}\n` +
					`${botIsAdminBox ? `\nReply tin nhắn với từ khóa kick/block để thực hiện hành động với các tài khoản này!` : ""}`;
			}
		} else {
			msg = `🔍 Không tìm thấy thành viên nào trong nhóm ${groupInfo.name} có ${VALID_ACTIONS[action]} với "${searchTerm}"!`;
		}

		let sentMessage;
		if (action === "findmatchtag" || action === "findtag") {
			sentMessage = await sendMessageTag(api, message, {
				caption: msg,
				mentions: mentions
			}, TIME_WAIT_SELECTION);
		} else {
			sentMessage = await sendMessageCompleteRequest(api, message, {
				caption: msg,
			}, TIME_WAIT_SELECTION);
		}

		if (searchResults.length > 0) {
			scanResultsMap.set(sentMessage.message.msgId.toString(), {
				results: searchResults,
				groupInfo,
				timestamp: Date.now(),
				userRequest: message.data.uidFrom,
				botIsAdminBox
			});
		}

		return;
	} catch (error) {
		console.error(`Lỗi khi thực hiện lệnh scanGroupsWithAction:`, error);
		await sendMessageFailed(
			api,
			message,
			"❌ Đã xảy ra lỗi khi quét thành viên nhóm, vui lòng thử lại hoặc nhập thông tin cụ thể hơn!",
			true
		);
		return;
	}
}

export async function handleScanGroupsReply(api, message) {
	const idBot = getBotId();
	const threadId = message.threadId;

	try {
		if (!message.data.quote || !message.data.quote.globalMsgId) return false;

		const quotedMsgId = message.data.quote.globalMsgId.toString();
		if (!scanResultsMap.has(quotedMsgId)) return false;

		const scanData = scanResultsMap.get(quotedMsgId);
		if (scanData.userRequest !== message.data.uidFrom) {
			await sendMessageWarning(
				api,
				message,
				"Bạn Không phải người yêu cầu hành động này!",
				true
			);
			return true;
		}

		const content = removeMention(message);
		const action = content === "kick" ? "kick" : content === "block" ? "block" : null;

		if (!action) {
			await sendMessageQuery(
				api,
				message,
				"⚠️ Vui lòng sử dụng một trong các từ khóa 'kick' hoặc 'block'!",
				true
			);
			return true;
		}

		if (!scanData.botIsAdminBox) {
			await sendMessageQuery(
				api,
				message,
				"Tôi Không đủ quyền để thực hiện hành động này!",
				true
			);
			return true;
		}

		const groupAdmins = await getGroupAdmins(scanData.groupInfo);
		const uidFinal = [];
		const results = [];

		for (const member of scanData.results) {
			if (isAdmin(member.id, threadId)) {
				results.push(`${member.zaloName} -> Không thể ${action === "kick" ? "Kick" : "Block"} quản trị nhóm!`);
			} else {
				uidFinal.push(member);
			}
		}

		if (action === "kick") {
			for (const member of uidFinal) {
				try {
					await api.removeUserFromGroup(threadId, [member.id]);
					results.push(`${member.zaloName} -> Đã Kick!`);
				} catch (error) {
					results.push(`${member.zaloName} -> Không thể Kick do ${error.message}!`);
				}
			}
		} else {
			for (const member of uidFinal) {
				try {
					await api.blockUser(threadId, [member.id]);
					results.push(`${member.zaloName} -> Đã Block!`);
				} catch (error) {
					results.push(`${member.zaloName} -> Không thể Block do ${error.message}!`);
				}
			}
		}

		const msgDel = {
			type: message.type,
			threadId: message.threadId,
			data: {
				cliMsgId: message.data.quote.cliMsgId,
				msgId: message.data.quote.globalMsgId,
				uidFrom: idBot,
			},
		};
		await api.deleteMessage(msgDel, false);
		// await api.undoMessage(message);
		scanResultsMap.delete(quotedMsgId);

		await sendMessageComplete(
			api,
			message,
			`Kết quả thực hiện ${action}:\n${results.join("\n")}`,
			false
		);

		return true;
	} catch (error) {
		console.error(`Lỗi khi xử lý reply scan:`, error);
		await sendMessageQuery(
			api,
			message,
			"❌ Đã xảy ra lỗi khi thực hiện hành động. Vui lòng thử lại sau!",
			true
		);
		return true;
	}
}