
import { sendMessageCompleteRequest, sendMessageProcessingRequest, sendMessageWarningRequest, sendMessageStateQuote } from "../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../service.js";
import * as fs from 'fs';
import path from 'path';
import axios from 'axios';
/* Author:HA HUY HOANG
Date:2025-08-15
Description:file này dùng để quản lý dữ liệu */
const BASE_DATA_PATH = path.resolve(process.cwd(), "src", "service-debug","chat-zalo", "chat-special", "data-send");
const removedLinksDir = path.resolve(process.cwd(), "src", "service-debug", "chat-zalo", "chat-special", "data-send", "removed-links");

if (!fs.existsSync(removedLinksDir)) {
    fs.mkdirSync(removedLinksDir, { recursive: true });
}

const VALID_STATUS_CODES = [200, 201, 202, 204, 301, 302, 307, 308];

const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; LinkChecker/1.0)',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9'
};

function isValidUrl(string) {
    try {
        const url = new URL(string.trim());
        return ['http:', 'https:'].includes(url.protocol);
    } catch {
        return false;
    }
}

async function checkLinkStatus(url, retryCount = 0, maxRetries = 3) {
    try {
        const response = await axios.head(url, {
            timeout: 5000,
            maxRedirects: 5,
            headers: DEFAULT_HEADERS,
            validateStatus: (status) => status < 500
        });
        return VALID_STATUS_CODES.includes(response.status);
    } catch (error) {
        if (error.response?.status === 405) {
            try {
                const response = await axios.get(url, {
                    timeout: 5000,
                    maxRedirects: 5,
                    headers: DEFAULT_HEADERS,
                    responseType: 'stream',
                    validateStatus: (status) => status < 500
                });
                response.data.destroy();
                return VALID_STATUS_CODES.includes(response.status);
            } catch (getError) {
                console.log(`GET request failed for ${url}: ${getError.message}`);
                return false;
            }
        }

        if (error.response?.status === 429 && retryCount < maxRetries) {
            const backoffTime = 2000 * Math.pow(2, retryCount); // Exponential backoff
            console.log(`Rate limited for ${url}, retrying in ${backoffTime}ms (attempt ${retryCount + 1}/${maxRetries})`);
            await new Promise(r => setTimeout(r, backoffTime));
            return checkLinkStatus(url, retryCount + 1, maxRetries);
        }

        console.log(`Link check failed for ${url}: ${error.message} (Status: ${error.response?.status || 'N/A'})`);
        return false;
    }
}

async function processInBatches(links, batchSize = 5) {
    const validLinks = [];
    const invalidLinks = [];

    console.log(`Starting to process ${links.length} links in batches of ${batchSize}`);

    for (let i = 0; i < links.length; i += batchSize) {
        const batch = links.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(links.length / batchSize)}`);

        const results = await Promise.allSettled(
            batch.map(link => checkLinkStatus(link.trim()))
        );

        results.forEach((result, index) => {
            const link = batch[index].trim();
            if (result.status === "fulfilled" && result.value === true) {
                validLinks.push(link);
            } else {
                invalidLinks.push({
                    url: link,
                    error: result.reason?.message || 'Link not accessible',
                    status: result.reason?.response?.status || 'N/A'
                });
            }
        });

        if (i + batchSize < links.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return { validLinks, invalidLinks };
}

export async function handleDataCommand(api, message, aliasCommand) {
    const content = message.data?.content?.trim() || "";
    const senderName = message.data?.dName || "Người dùng";
    const quote = message.data?.quote;
    const prefix = getGlobalPrefix(api.getBotId());

    const mentionRegex = /^@\w+\s+/;
    const contentWithoutMention = content.replace(mentionRegex, "").trim();
    const commandRegex = new RegExp(`^${prefix}${aliasCommand}\\s+`, 'i');
    const contentWithoutCommand = contentWithoutMention.replace(commandRegex, "").trim();

    const args = contentWithoutCommand.split(/\s+/);
    const action = args[0]?.toLowerCase() === 'check' ? 'check' : 'add';
    let fileName = args[0] === 'check' ? args[1] || "default" : args[0] || "default";

    if (!action || !['add', 'check'].includes(action)) {
        await sendMessageWarningRequest(api, message, {
            caption: `${senderName}, cú pháp không đúng!\n` +
                `Sử dụng:\n` +            
                `• ${prefix}${aliasCommand} <tên_file> (để thêm link video)\n` +
                `• ${prefix}${aliasCommand} check <tên file> (để kiểm tra link)`
        }, 30000);
        return;
    }

    if (action === "check") {
        try {
            if (!fileName) {
                await sendMessageWarningRequest(api, message, {
                    caption: `${senderName}, vui lòng chỉ định tên file cần kiểm tra.`
                }, 30000);
                return;
            }

            if (!fileName.toLowerCase().endsWith('.txt')) {
                fileName += '.txt';
            }

            const fullPath = path.join(BASE_DATA_PATH, fileName);

            if (!fs.existsSync(fullPath)) {
                await sendMessageWarningRequest(api, message, {
                    caption: `${senderName}, không tìm thấy file ${fileName}.`
                }, 30000);
                return;
            }

            let fileContent = fs.readFileSync(fullPath, "utf-8").trim();

            let links = fileContent.split("\n")
                .map(link => link.trim())
                .filter(link => link && !link.startsWith('#') && isValidUrl(link));

            if (links.length === 0) {
                await sendMessageWarningRequest(api, message, {
                    caption: `${senderName}, file ${fileName} không chứa link hợp lệ nào.`
                }, 30000);
                return;
            }

            links = [...new Set(links)];

            await sendMessageProcessingRequest(api, message, {
                caption: `${senderName}, đang kiểm tra ${links.length} links (đã loại bỏ trùng lặp)...`
            }, 60000);

            const { validLinks, invalidLinks } = await processInBatches(links, 5);

            const updatedContent = validLinks.length > 0 ? validLinks.join("\n") : "# No valid links left";
            fs.writeFileSync(fullPath, updatedContent);

            if (invalidLinks.length > 0) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const removedLinksFile = path.join(
                    removedLinksDir,
                    `removed_links_${fileName.replace('.txt', '')}_${timestamp}.txt`
                );

                const removedLinksContent =
                    `# Links đã xóa từ file ${fileName}\n` +
                    `# Thời gian: ${new Date().toLocaleString('vi-VN')}\n` +
                    `# Số lượng: ${invalidLinks.length}\n` +
                    `# Tổng links đã kiểm tra: ${links.length}\n\n` +
                    invalidLinks.map(item => `${item.url} # Error: ${item.error} (Status: ${item.status})`).join("\n");

                fs.writeFileSync(removedLinksFile, removedLinksContent);

                await sendMessageCompleteRequest(api, message, {
                    caption: `${senderName}, kết quả kiểm tra file ${fileName}:\n\n` +
                        `✅ Links còn hoạt động: ${validLinks.length}\n` +
                        `❌ Links đã xóa: ${invalidLinks.length}\n`
                }, 300000);
            } else {
                await sendMessageCompleteRequest(api, message, {
                    caption: `${senderName},Tất cả ${validLinks.length} links trong file ${fileName} đều hoạt động tốt.`
                }, 60000);
            }
        } catch (error) {
            console.error("Lỗi xử lý lệnh kiểm tra:", error);
            await sendMessageWarningRequest(api, message, {
                caption: `${senderName}, đã xảy ra lỗi khi thực hiện lệnh kiểm tra: ${error.message}\nVui lòng thử lại sau.`
            }, 30000);
        }
    } else if (action === "add") {
        if (!quote || !quote.attach) {
            await sendMessageStateQuote(api, message, "Mày Reply vào cái video đó xem nào!", false, 10000);
            return;
        }

        const finalFileName = fileName ? `${fileName}.txt` : "default.txt";
        const filePath = path.join(BASE_DATA_PATH, finalFileName);

        try {
            const attachData = JSON.parse(quote.attach);
            const fileUrl = attachData.hdUrl || attachData.href || attachData.oriUrl || attachData.normalUrl || attachData.thumbUrl;

            if (!fileUrl) {
                await sendMessageStateQuote(api, message, "Không tìm thấy URL hợp lệ", false, 10000);
                return;
            }

            if (!isValidUrl(fileUrl)) {
                await sendMessageStateQuote(api, message, "URL không hợp lệ", false, 10000);
                return;
            }

            const apiEndpoint = `https://catbox.moe/user/api.php`;
            console.log("URL gửi tới API:", apiEndpoint);
            console.log("File URL:", fileUrl);

            let response;
            try {
                const formData = new URLSearchParams();
                formData.append('reqtype', 'urlupload');
                formData.append('url', fileUrl);

                response = await axios.post(apiEndpoint, formData, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        ...DEFAULT_HEADERS
                    },
                    timeout: 30000
                });
            } catch (error) {
                console.error("Lỗi khi gọi API upload:", error.message);
                await sendMessageStateQuote(api, message, `Upload thất bại do lỗi kết nối: ${error.message}`, false, 10000);
                return;
            }

            const uploadedLink = response.data.trim();
            console.log("Phản hồi từ API:", uploadedLink);

            if (!uploadedLink || uploadedLink.startsWith('Error') || !isValidUrl(uploadedLink)) {
                const errorMessage = uploadedLink.replace('Error: ', '');
                await sendMessageStateQuote(api, message, `Upload thất bại. Thông báo từ API: ${errorMessage}`, false, 30000);
                return;
            }

            try {
                await fs.promises.mkdir(BASE_DATA_PATH, { recursive: true });
            } catch (error) {
                console.error("Lỗi khi tạo thư mục:", error.message);
                await sendMessageStateQuote(api, message, `Đã xảy ra lỗi khi tạo thư mục lưu trữ: ${error.message}`, false, 10000);
                return;
            }

            let existingContent = "";
            try {
                existingContent = fs.readFileSync(filePath, "utf8");
                if (existingContent.includes(uploadedLink)) {
                    await sendMessageStateQuote(api, message, `Link này đã tồn tại trong file ${fileName || 'default'}`, false, 10000);
                    return;
                }
            } catch (error) {
            }

            try {
                await fs.promises.appendFile(filePath, `${uploadedLink}\n`, "utf8");
            } catch (error) {
                console.error("Lỗi khi ghi vào file:", error.message);
                await sendMessageStateQuote(api, message, `Đã xảy ra lỗi khi lưu link: ${error.message}`, false, 10000);
                return;
            }

            await sendMessageStateQuote(api, message, `✅ Lưu thành công vào tệp ${fileName || 'default'}`, true, 30000);
        } catch (error) {
            console.error("Lỗi khi xử lý upload:", error.message);
            await sendMessageStateQuote(api, message, `Đã xảy ra lỗi khi xử lý: ${error.message}`, false, 10000);
        }
    }
}