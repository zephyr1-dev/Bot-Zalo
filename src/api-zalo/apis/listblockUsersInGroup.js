import { Zalo } from "../zalo.js";
import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { appContext } from "../context.js";
import { encodeAES, handleZaloResponse, request, makeURL } from "../utils.js";

export function getBlockedMembersFactory(api) {
  const serviceURL = makeURL(`${api.zpwServiceMap.group[0]}/api/group/blockedmems/list`, {
    zpw_ver: Zalo.API_VERSION,
    zpw_type: Zalo.API_TYPE,
  });

  /**
   * Lấy danh sách thành viên bị chặn trong nhóm, thử lấy tất cả hoặc dùng phân trang
   *
   * @param {string|number} groupId - ID của nhóm
   * @param {Object} [options] - Tùy chọn
   * @param {number} [options.offset=0] - Vị trí bắt đầu (dùng cho phân trang)
   * @param {number} [options.count=1000] - Số lượng thành viên mỗi lần lấy
   * @param {boolean} [options.all=false] - Thử lấy toàn bộ danh sách
   * @returns {Promise<Object>} - { blockedMembers: Array, total: number }
   * @throws {ZaloApiError}
   */
  return async function getBlockedMembers(groupId, options = {}) {
    if (!appContext.secretKey) throw new ZaloApiError("Secret key is not available");
    if (!appContext.imei) throw new ZaloApiError("IMEI is not available");
    if (!appContext.cookie) throw new ZaloApiError("Cookie is not available");
    if (!appContext.userAgent) throw new ZaloApiError("User agent is not available");
    if (!groupId) throw new ZaloApiError("Missing groupId");

    const { offset = 0, count = 1000, all = false } = options;

    const params = {
      grid: String(groupId),
      imei: appContext.imei,
    };

    if (!all) {
      params.offset = offset;
      params.count = count;
    }

    const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(params));
    if (!encryptedParams) throw new ZaloApiError("Failed to encrypt params");

    const response = await request(serviceURL, {
      method: "POST",
      headers: {
        Cookie: appContext.cookie,
        "User-Agent": appContext.userAgent,
      },
      body: new URLSearchParams({
        params: encryptedParams,
      }),
    });

    const result = await handleZaloResponse(response);
    if (result.error) throw new ZaloApiError(result.error.message, result.error.code);

    return {
      blockedMembers: result.data.blockedMembers || result.data.blocked_members || [],
      total: result.data.total || result.data.blockedMembers?.length || result.data.blocked_members?.length || 0,
    };
  };
}