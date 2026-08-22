import FormData from "form-data";
import fs from "fs";
import path from "path";
import { appContext } from "../context.js";
import { Zalo, ZaloApiError } from "../index.js";
import { MessageType } from "../models/Message.js";
import { encodeAES, getFileSize, getImageMetaData, getMd5LargeFileObject, handleZaloResponse, makeURL, request } from "../utils.js";
import { checkConfigUploadAttachment, getProphylacticUploadAttachment, setProphylacticUploadAttachment } from "../../index.js";
import { uploadTempFile } from "../../utils/util.js";
const urlType = {
  image: "photo_original/upload",
  aac: "voice/upload",
  video: "asyncfile/upload",
  gif: "gif?",
  others: "asyncfile/upload",
};
// Original: HA HUY HOANG
// Custom: BUG ( DEO XOA CAI NAY, XOA T CHAT CU M )
export function uploadAttachmentFactory(api) {
  const serviceURL = `${api.zpwServiceMap.file[0]}/api`;
  return async function uploadAttachment(filePaths, threadId, type = MessageType.DirectMessage, isUseProphylactic = false) {
    if (!appContext.secretKey || !appContext.imei || !appContext.cookie || !appContext.userAgent)
      throw new ZaloApiError("Missing required app context fields");
    if (!filePaths?.length) throw new ZaloApiError("Missing filePaths");
    if (!threadId) throw new ZaloApiError("Missing threadId");
    const results = [];
    for (const filePath of filePaths) {
      if (!fs.existsSync(filePath)) throw new ZaloApiError(`${filePath} not found`);
      const extFile = path.extname(filePath).slice(1).toLowerCase();
      const maxSize = 9 * 1000 * 1000; 
      const fileSize = await getFileSize(filePath);
      let fileType = "";
      let maxType = "";
      if (["jpg", "jpeg", "png"].includes(extFile)) {
        fileType = "image";
      } else if (["mp3", "aac"].includes(extFile)) {
        if (fileSize > maxSize) {
          fileType = "others";
          maxType = "HaHuyHoang.aac";
        } else {
          fileType = "aac";
        }
      } else if (extFile === "mp4") {
        fileType = "video";
      } else {
        fileType = "others";
      }
      if (getProphylacticUploadAttachment() || isUseProphylactic) {
        try {
          if (["jpg", "jpeg", "png", "webp"].includes(extFile)) {
            const imageData = await getImageMetaData(filePath);
            const url = await uploadTempFile(filePath);
            results.push({
              fileType: "image",
              width: imageData.width,
              height: imageData.height,
              totalSize: imageData.totalSize,
              photoId: Math.floor(Date.now() / 1000),
              normalUrl: url,
              hdUrl: url,
              thumbUrl: url,
            });
            continue;
          }
        } catch (error) {
          console.error("Upload Attachment API Thứ 3 Đã Xảy Ra Lỗi, Vui Lòng Kiểm Tra Lại!");
          console.error("Chuyển sang dùng api chính từ zalo (Không khả thi khi upload nhiều file trong thời gian ngắn)!");
        }
      }
      const chunkSize = 3145728; 
      const isGroupMessage = type === MessageType.GroupMessage;
      const baseUrl = `${serviceURL}/${isGroupMessage ? "group" : "message"}/`;
      const query = {
        zpw_ver: Zalo.API_VERSION,
        zpw_type: Zalo.API_TYPE,
        type: isGroupMessage ? "11" : "2",
      };
      const fileName = path.basename(filePath);
      const totalSize = fileSize;
      const totalChunks = Math.ceil(totalSize / chunkSize);
      const clientId = Date.now();
      const processUpload = async () => {
        const data = {
          filePath,
          chunkContent: [],
          params: {
            imei: appContext.imei,
            isE2EE: 0,
            jxl: 0,
            chunkId: 1,
            clientId,
            fileName,
            totalChunk: totalChunks,
            totalSize,
            fileType,
            ...(isGroupMessage ? { grid: threadId } : { toid: threadId }),
          },
        };
        if (["jpg", "jpeg", "png"].includes(extFile)) {
          const imageData = await getImageMetaData(filePath);
          data.fileType = "image";
          data.fileData = imageData;
        } else {
          data.fileType = fileType;
          data.fileData = { fileName, totalSize };
        }
        const fileBuffer = await fs.promises.readFile(filePath);
        for (let i = 0; i < totalChunks; i++) {
          const formData = new FormData();
          formData.append("chunkContent", fileBuffer.subarray(i * chunkSize, (i + 1) * chunkSize), {
            filename: fileName,
            contentType: "application/octet-stream",
          });
          data.chunkContent[i] = formData;
        }
        const maxConcurrentUploads = 99; // Tăng tốc độ upload :D
        const activeUploads = [];
        let uploadedChunks = 0;
        const uploadChunk = async (chunkContent, chunkId) => {
          data.params.chunkId = chunkId;
          const encryptedParams = encodeAES(appContext.secretKey, JSON.stringify(data.params));
          if (!encryptedParams) throw new ZaloApiError("Failed to encrypt message");
          const maxRetries = 5;
          let retryCount = 0;
          let success = false;
          let response;
          while (retryCount < maxRetries && !success) {
            try {
              response = await request(makeURL(`${baseUrl}${urlType[data.fileType]}`, { ...query, params: encryptedParams }), {
                method: "POST",
                headers: chunkContent.getHeaders(),
                body: chunkContent.getBuffer(),
              });

              const result = await handleZaloResponse(response);
              if (result.error) {
                setProphylacticUploadAttachment(true);
                throw new ZaloApiError(result.error.message, result.error.code);
              }
              success = true;
              checkConfigUploadAttachment(extFile);

              const resData = result.data;
              if (resData) {
                if (resData.fileId && resData.fileId !== "-1") {
                  return new Promise((resolve) => {
                    appContext.uploadCallbacks.set(resData.fileId, async (wsData) => {
                      const resultData = {
                        ...data.fileData,
                        ...resData,
                        ...wsData,
                        fileType: data.fileType,
                        checksum: (await getMd5LargeFileObject(data.filePath, data.fileData.totalSize)).data,
                      };
                      if (maxType) {
                        resultData.fileUrl = `${resultData.fileUrl}/${maxType}`;
                      }
                      results.push(resultData);
                      resolve(resultData);
                    });
                  });
                }
                if (resData.photoId && resData.finished) {
                  const resultData = {
                    fileType: data.fileType,
                    width: data.fileData.width,
                    height: data.fileData.height,
                    totalSize: data.fileData.totalSize,
                    ...resData,
                  };
                  results.push(resultData);
                  return resultData;
                }
              }
            } catch (error) {
              retryCount++;
              if (retryCount < maxRetries) {
                console.log(`Retrying chunk ${chunkId}/${totalChunks} attempt ${retryCount}...`);
                await new Promise(resolve => setTimeout(resolve, 2000)); 
              } else {
                throw new ZaloApiError(`Failed to upload chunk after ${maxRetries} attempts`);
              }
            }
          }
        };

        const startTime = Date.now();
        for (let i = 0; i < data.chunkContent.length; i++) {
          while (activeUploads.length >= maxConcurrentUploads) {
            await Promise.race(activeUploads);
          }
          const uploadPromise = uploadChunk(data.chunkContent[i], i + 1).then((result) => {
            uploadedChunks++;
            const percent = (uploadedChunks / totalChunks) * 100;
            console.log(`Upload progress: ${uploadedChunks}/${totalChunks} chunks (${percent.toFixed(2)}%)`);
            return result;
          });
          activeUploads.push(uploadPromise);
          uploadPromise.finally(() => {
            activeUploads.splice(activeUploads.indexOf(uploadPromise), 1);
          });
        }

        const uploadedResults = await Promise.all(activeUploads);
        const duration = (Date.now() - startTime) / 1000;
        if (duration > 0) {
          console.log(`Upload speed: ${(totalChunks / duration).toFixed(2)} chunk(s)/s (${totalChunks} chunks in ${duration.toFixed(2)}s)`);
        } else {
          console.log("Upload completed instantly.");
        }

        for (const result of uploadedResults) {
          if (result) return result;
        }
        throw new ZaloApiError("Upload failed: No successful chunk returned.");
      };

      try {
        await processUpload();
      } catch (error) {
        console.error("Lỗi upload lần 1, thử lại sau 1s:", error);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await processUpload();
      }
    }

    return results;
  };
}