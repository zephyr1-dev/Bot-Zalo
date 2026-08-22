import { loadImageBuffer } from "./util.js";

const TIME_CLEANUP = 1 * 60 * 1000;
const TIME_CACHE = 3 * 60 * 1000;

class ImageBufferCache {
  constructor() {
    this.cache = new Map();
    this.downloading = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), TIME_CLEANUP);
  }

  async getBuffer(url, options = {}) {
    const cacheKey = this.getCacheKey(url, options);
    
    // Kiểm tra cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey).buffer;
    }

    // Nếu đang download, đợi kết quả
    if (this.downloading.has(cacheKey)) {
      return (await this.downloading.get(cacheKey)).buffer;
    }

    // Tạo promise download mới
    const downloadPromise = this.downloadBuffer(url, options);
    this.downloading.set(cacheKey, downloadPromise);

    try {
      const result = await downloadPromise;
      this.cache.set(cacheKey, {
        buffer: result,
        timestamp: Date.now()
      });
      this.downloading.delete(cacheKey);
      return result;
    } catch (error) {
      this.downloading.delete(cacheKey);
      throw error;
    }
  }

  getCacheKey(url, options) {
    return `${url}:${JSON.stringify(options)}`;
  }

  async downloadBuffer(url, options) {
    try {
      return await loadImageBuffer(url);
    } catch (error) {
      console.error(`Error downloading image from ${url}:`, error);
      throw error;
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.cache.entries()) {
      if (now - data.timestamp > TIME_CACHE) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
    this.downloading.clear();
  }
}

export const imageBufferCache = new ImageBufferCache(); 