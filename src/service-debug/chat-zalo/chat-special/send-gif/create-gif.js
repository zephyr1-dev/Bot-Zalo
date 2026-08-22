import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "canvas";
import { tempDir } from "../../../../utils/io-json.js";

const createGif360 = (imagePath, outputGifPath) => {
  return new Promise((resolve, reject) => {
    const filter = `
      rotate=PI*2*t/5:c=black@0.0:ow=rotw(iw):oh=roth(ih)
    `;

    ffmpeg(imagePath)
      .inputOptions('-loop', '1')
      .outputOptions('-vf', filter)
      .outputOptions('-t', '5')
      .outputOptions('-r', '30')
      .outputOptions('-y')
      .save(outputGifPath)
      .on('end', () => {
        console.log('GIF xoay 360 độ đã được tạo thành công!');
        resolve(outputGifPath);
      })
      .on('error', (err) => {
        console.error('Lỗi khi tạo GIF:', err.message);
        reject(err);
      });
  });
};

export async function createSpinningDiscGif(imageUrl, idImage = Date.now()) {
  try {
    const size = 100;
    const fps = 40;
    const duration = 2;
    const totalFrames = fps * duration;
    
    const frameDir = path.join(tempDir, `frames_${idImage}`);
    const outputGif = path.join(tempDir, `spinning_${idImage}.gif`);
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    if (!fs.existsSync(frameDir)) {
      fs.mkdirSync(frameDir);
    }

    const image = await loadImage(imageUrl);
    
    for (let i = 0; i < totalFrames; i++) {
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");
      
      const rotation = (i / totalFrames) * Math.PI * 2;
      ctx.clearRect(0, 0, size, size);
      ctx.translate(size / 2, size / 2);
      ctx.rotate(rotation);
      ctx.beginPath();
      ctx.arc(0, 0, size / 2 - 10, 0, Math.PI * 2);
      ctx.clip();
      
      const scale = Math.max(size / image.width, size / image.height);
      ctx.drawImage(
        image,
        -image.width * scale / 2,
        -image.height * scale / 2,
        image.width * scale,
        image.height * scale
      );
      
      const frameFile = path.join(frameDir, `frame_${i.toString().padStart(4, '0')}.png`);
      const out = fs.createWriteStream(frameFile);
      const stream = canvas.createPNGStream();
      stream.pipe(out);
      await new Promise((resolve) => out.on('finish', resolve));
    }

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(path.join(frameDir, 'frame_%04d.png'))
        .inputFPS(fps)
        .outputOptions([
          '-vf', 'scale=300:-1:flags=lanczos',
          '-gifflags', '+transdiff',
          '-y'
        ])
        .toFormat('gif')
        .on('end', resolve)
        .on('error', reject)
        .save(outputGif);
    });

    fs.rmSync(frameDir, { recursive: true, force: true });

    return outputGif;

  } catch (error) {
    console.error("Lỗi khi tạo GIF:", error);
    throw error;
  }
}

export async function createTextScrollingGif(text, idImage = Date.now()) {
  let frameDir = null;
  let palettePath = null;

  try {
    const width = 500; 
    const height = 100;
    const fps = 20; 
    const speed = 150; 

    // Kiểm tra và tạo thư mục tempDir
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log(`Tạo thư mục tempDir: ${tempDir}`);
    }

    // Kiểm tra quyền ghi cho tempDir
    try {
      fs.accessSync(tempDir, fs.constants.W_OK);
    } catch (err) {
      throw new Error(`Không có quyền ghi vào thư mục tempDir: ${tempDir}`);
    }

    frameDir = path.join(tempDir, `frames_text_${idImage}`);
    const outputGif = path.join(tempDir, `scrolling_text_${idImage}.gif`);

    // Kiểm tra độ dài đường dẫn
    if (outputGif.length > 1000) {
      throw new Error(`Đường dẫn file GIF quá dài: ${outputGif}`);
    }

    if (!fs.existsSync(frameDir)) {
      fs.mkdirSync(frameDir);
      console.log(`Tạo thư mục frameDir: ${frameDir}`);
    }

    // Đo kích thước văn bản
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.font = 'bold 40px Arial';
    const textWidth = ctx.measureText(text).width;

    // Tính thời gian dựa trên tốc độ cố định
    const totalDistance = width + textWidth;
    const duration = totalDistance / speed;
    const totalFrames = Math.ceil(fps * duration);

    console.log(`Tạo GIF: textWidth=${textWidth}, totalDistance=${totalDistance}, duration=${duration}, totalFrames=${totalFrames}`);

    // Tạo từng frame
    for (let i = 0; i < totalFrames; i++) {
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      const progress = i / totalFrames;
      const x = width - (progress * totalDistance);

      ctx.font = 'bold 40px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, height / 2);

      const frameFile = path.join(frameDir, `frame_${i.toString().padStart(4, '0')}.png`);
      const out = fs.createWriteStream(frameFile);
      const stream = canvas.createPNGStream();
      stream.pipe(out);
      await new Promise((resolve, reject) => {
        out.on('finish', () => {
          if (fs.existsSync(frameFile)) {
            const stats = fs.statSync(frameFile);
            if (stats.size > 0) {
              resolve();
            } else {
              reject(new Error(`Frame ${frameFile} rỗng`));
            }
          } else {
            reject(new Error(`Frame ${frameFile} không được tạo`));
          }
        });
        out.on('error', (err) => reject(new Error(`Lỗi khi lưu frame ${frameFile}: ${err.message}`)));
      });
    }

    // Kiểm tra số lượng frame
    const frameCount = fs.readdirSync(frameDir).length;
    if (frameCount !== totalFrames) {
      throw new Error(`Số frame tạo được (${frameCount}) không khớp với số frame mong đợi (${totalFrames})`);
    }

    // Tạo GIF đơn giản hơn
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(path.join(frameDir, 'frame_%04d.png'))
        .inputFPS(fps)
        .outputOptions([
          `-vf scale=${width}:-1:flags=lanczos`,
          '-y'
        ])
        .toFormat('gif')
        .on('end', () => {
          console.log(`Tạo GIF thành công: ${outputGif}`);
          resolve();
        })
        .on('error', (err) => reject(new Error(`Lỗi khi tạo GIF: ${err.message}`)))
        .save(outputGif);
    });

    // Xóa thư mục tạm
    if (frameDir && fs.existsSync(frameDir)) {
      fs.rmSync(frameDir, { recursive: true, force: true });
    }

    return outputGif;

  } catch (error) {
    console.error("Lỗi khi tạo GIF văn bản:", error);
    if (frameDir && fs.existsSync(frameDir)) {
      fs.rmSync(frameDir, { recursive: true, force: true });
    }
    if (palettePath && fs.existsSync(palettePath)) {
      fs.unlinkSync(palettePath);
    }
    throw error;
  }
}