import { checkExstentionFileRemote, checkLinkIsValid } from "../../../utils/util";
import { sendMessageStateQuote } from "../chat-style/chat-style";

const TIME_SHOW_CONTENT = 1800000;

export async function chatGeneralTypeContent(api, message, object) {
	const threadId = message.threadId;
	const threadType = message.type;
	const caption = object.message;

	if (checkLinkIsValid(caption)) {
		const ext = await checkExstentionFileRemote(caption);
		if (ext === "png" || ext === "jpg" || ext === "jpeg") {
			await api.sendImage(caption,
				message,
				"",
				TIME_SHOW_CONTENT
			);
		} else if (ext === "mp4") {
			await api.sendVideo({
				videoUrl: caption,
				thumbnail: "",
				threadId: threadId,
				threadType: threadType,
				message: { text: "" },
				ttl: TIME_SHOW_CONTENT,
			});
		} else if (ext === "gif") {
			await api.sendGif(caption,
				message,
				"",
				TIME_SHOW_CONTENT);
		} else if (ext === "webp") {
			await api.sendCustomSticker(
				message,
				caption,
				caption,
				null,
				null,
				TIME_SHOW_CONTENT
			);
		} else if (ext === "aac" || ext === "mp3" || ext === "m4a") {
			await api.sendVoice(
				{ threadId: threadId, type: threadType },
				caption,
				TIME_SHOW_CONTENT
			);
		} else if (ext === "apk" || ext === "ipa" || ext === "zip" || ext === "rar" || ext === "7z" || ext === "tar" || ext === "gz" || ext === "bz2" || ext === "xz") {
			await api.sendFile(message, caption, TIME_SHOW_CONTENT, caption, null, ext, null);
		} else {
			await sendMessageStateQuote(api, message, caption, true, TIME_SHOW_CONTENT, false);
		}
	} else {
		await sendMessageStateQuote(api, message, caption, true, TIME_SHOW_CONTENT, false);
	}
}
