import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

const SVG_CACHE = new Map();

export async function convertSVGtoPNG(svgPath, size = 50) {
  const cacheKey = `${svgPath}_${size}`;
  
  // Kiểm tra cache
  if (SVG_CACHE.has(cacheKey)) {
    return SVG_CACHE.get(cacheKey);
  }

  try {
    // Đọc file SVG
    const svgContent = await fs.readFile(svgPath);
    
    // Chuyển đổi SVG sang PNG với kích thước mong muốn
    const pngBuffer = await sharp(svgContent)
      .resize(size, size)
      .png()
      .toBuffer();

    // Lưu vào cache
    SVG_CACHE.set(cacheKey, pngBuffer);
    
    return pngBuffer;
  } catch (error) {
    console.error("Lỗi chuyển đổi SVG sang PNG:", error);
    return null;
  }
} 