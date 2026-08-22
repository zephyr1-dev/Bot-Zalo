import { handleReactionConfirmJoinGroup } from "../commands/bot-manager/remote-action-group.js";
// import { handleReactionLinkConfirm } from "../service-debug/chat-zalo/chat-special/send-image/send-image.js";
import { handleTikTokReaction } from "../service-debug/api-crawl/tiktok/tiktok-service.js";
//import { handleCaroReaction } from "../service-debug/game-service/mini-game/caro-game/caro.js"
import { handleReactionConfirmAutoJoin } from "../service-debug/anti-service/auto-join.js";

//Xử Lý Sự Kiện Reaction
export async function reactionEvents(api, reaction) {
  if (await handleReactionConfirmJoinGroup(api, reaction)) return;
  // if (await handleReactionLinkConfirm(api, reaction)) return;
  if (await handleTikTokReaction(api, reaction)) return;
  //if (await handleCaroReaction(api, reaction)) return;
  if (await handleReactionConfirmAutoJoin(api, reaction)) return;
}
