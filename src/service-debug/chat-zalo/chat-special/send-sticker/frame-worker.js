import { workerData, parentPort } from 'worker_threads';
import sharp from 'sharp';
import path from 'path';

async function processFrames() {
    const { startFrame, endFrame, size, totalFrames, framesDir, imageBuffer, circleMask } = workerData;

    try {
        for (let i = startFrame; i < endFrame; i++) {
            const frameFile = path.join(framesDir, `frame_${String(i).padStart(3, '0')}.png`);
            const angle = (i * 360 / totalFrames) * Math.PI / 180;
            const rotatedSize = Math.abs(size * Math.cos(angle)) + Math.abs(size * Math.sin(angle));
            const offset = Math.floor((rotatedSize - size) / 2);

            await sharp(imageBuffer)
                .rotate((i * 360) / totalFrames, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .extract({
                    left: offset,
                    top: offset,
                    width: size,
                    height: size
                })
                .composite([{
                    input: circleMask,
                    blend: 'dest-in'
                }])
                .toFile(frameFile);
        }
        parentPort.postMessage('done');
    } catch (error) {
        throw error;
    }
}

processFrames().catch(error => {
    console.error('Worker error:', error);
    process.exit(1);
}); 