import path from "path";
import fs from "fs/promises";
import schedule from "node-schedule";
import chalk from "chalk";
import { checkUrlStatus } from "./util.js";

const CACHE_FILE_PATH = path.join(process.cwd(), "assets", "json-data", "cache-link.json");

export const cacheState = {
	data: {
		youtube: {},
		tiktok: {},
		zingmp3: {},
		soundcloud: {},
		nhaccuatui: {},
	},
	hasChanges: false,
};

async function loadCache() {
  try {
    const data = await fs.readFile(CACHE_FILE_PATH, "utf8");
    cacheState.data = JSON.parse(data);
    console.log(chalk.magentaBright("Đã nạp dữ liệu cache từ file thành công"));
  } catch (error) {
    console.error("File cache chưa tồn tại, sẽ tạo mới:", error.message);
    // Tạo file rỗng
    await fs.mkdir(path.dirname(CACHE_FILE_PATH), { recursive: true });
    await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(cacheState.data, null, 2));
  }
}


async function saveCache() {
	try {
		await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(cacheState.data, null, 2));
	} catch (error) {
		console.error("Lỗi khi ghi file cache:", error);
	}
}

async function checkAndSaveChanges() {
	if (cacheState.hasChanges) {
		await saveCache();
		cacheState.hasChanges = false;
	}
}

export async function initializeCacheService() {
	await loadCache();

	schedule.scheduleJob("*/5 * * * * *", async () => {
		await checkAndSaveChanges();
	});

	console.log(chalk.magentaBright("Khởi động service quản lý cache link platform hoàn tất"));
}

function getCacheData(platform, id) {
	if (!cacheState.data[platform]) return null;

	const cache = cacheState.data[platform][id];
	if (!cache) return null;
	return cache;
}

export async function getCachedMedia(platform, id, quality = null, title = null) {
	const isValid = await validateCache(platform, id, quality);
	if (!isValid) return null;

	const cachedData = getCacheData(platform, id);
	if (!cachedData) return null;
	if (title && (!cachedData.title || cachedData.title !== title)) {
		cachedData.title = title;
		cacheState.hasChanges = true;
	}
	const linkChoose = quality ? cachedData[quality] : cachedData;

	return {
		fileUrl: linkChoose.fileUrl,
		title: linkChoose.title || cachedData.title,
		platform: linkChoose.platform || platform,
		width: linkChoose.width || cachedData.width,
		height: linkChoose.height || cachedData.height,
		duration: linkChoose.duration || cachedData.duration,
	};
}

export async function setCacheData(platform, id, data, quality = null) {
	if (!cacheState.data[platform]) cacheState.data[platform] = {};

	if (!cacheState.data[platform][id]) cacheState.data[platform][id] = {};

	if (data.title) {
		if (!cacheState.data[platform][id].title || cacheState.data[platform][id].title !== data.title) {
			cacheState.data[platform][id].title = data.title;
		}
		delete data.title;
	}

	if (data.artist) {
		if (!cacheState.data[platform][id].artist || cacheState.data[platform][id].artist !== data.artist) {
			cacheState.data[platform][id].artist = data.artist;
		}
		delete data.artist;
	}

	if (quality) {
		cacheState.data[platform][id][quality] = {
			...data,
			timestamp: Date.now(),
		};
	} else {
		cacheState.data[platform][id] = {
			...cacheState.data[platform][id],
			...data,
			timestamp: Date.now(),
		};
	}

	cacheState.hasChanges = true;
}

function deleteCacheData(platform, id, quality = null) {
	if (!cacheState.data[platform]?.[id]) return;

	if (quality) {
		delete cacheState.data[platform][id][quality];
		if (Object.keys(cacheState.data[platform][id]).length === 0) {
			delete cacheState.data[platform][id];
		}
	} else {
		delete cacheState.data[platform][id];
	}

	cacheState.hasChanges = true;
}

async function validateCache(platform, id, quality = null) {
	const cacheEntry = getCacheData(platform, id);
	if (!cacheEntry) return false;

	const linkChoose = quality ? cacheEntry[quality] : cacheEntry;
	if (!linkChoose) return false;

	const isValid = await checkUrlStatus(linkChoose.fileUrl);
	if (!isValid) {
		deleteCacheData(platform, id, quality);
		return false;
	}

	return true;
}
