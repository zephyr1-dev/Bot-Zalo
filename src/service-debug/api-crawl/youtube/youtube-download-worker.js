import { parentPort, workerData } from 'worker_threads';
import youtubedl from 'youtube-dl-exec';

async function downloadVideo(videoUrl, videoPath, format) {
  try {
    let options;
    if (format === 'bestaudio[ext=aac]/bestaudio[ext=m4a]/bestaudio') {
      options = {
        output: videoPath,
        format: format,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        bufferSize: "16K",
        addHeader: ["referer:youtube.com"],
      };
    } else {
      options = {
        output: videoPath,
        format: format,
        mergeOutputFormat: "mp4", 
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        bufferSize: "16K",
        addHeader: [
          "referer:youtube.com",
          "user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        ],
      };
    }

    await youtubedl(videoUrl, options);
    parentPort.postMessage({ success: true, videoPath });
    
  } catch (error) {
    parentPort.postMessage({ 
      success: false, 
      error: error.message 
    });
  }
}

downloadVideo(workerData.videoUrl, workerData.videoPath, workerData.format); 