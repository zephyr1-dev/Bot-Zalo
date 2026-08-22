import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';

export async function uploadOnce(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error('File does not exist:', filePath);
    return null;
  }
  const fileName = path.basename(filePath);
  const fileStream = fs.createReadStream(filePath);
  const url = `https://soiz.online/${fileName}`;
  const headers = {
    'Max-Downloads': '1',
    'Max-Days': '1',
    'Content-Type': 'application/octet-stream'
  };

  try {
    const response = await axios.put(url, fileStream, { headers });
    return response.data; // Trả về liên kết
  } catch (error) {
    console.error('Upload failed:', error.message);
    return null;
  }
}

export async function shareSrc(api, message, aliasCommand) {
    const { type, threadId } = message;
    const senderId = message.data.uidFrom;
    const messageContent = message.data.content.split(" ");
    
    // Đường dẫn đến thư mục share  
    const SHARE_DIR = path.join(process.cwd(), "assets/resources/file");

    // Kiểm tra xem thư mục share có tồn tại không  
    if (!fs.existsSync(SHARE_DIR)) {
      return api.sendMessage({
        msg: `Không tìm thấy thư mục!`, 
        quote: message, 
        ttl: 60000
      }, threadId, type);
    }

    // Hàm chia sẻ file - Di chuyển ra ngoài để tránh lỗi ReferenceError  
    async function shareFile(filePath) {
      try {
        const fileName = path.basename(filePath);
        
        try {
          api.sendMessage({
            msg: `Đã gửi cho bạn, hãy kiểm tra tin nhắn riêng hoặc bật tính năng chấp nhận tin nhắn từ người lạ!`, 
            quote: message, 
            ttl: 60000 * 60
          }, threadId, type);
          api.sendMessage({
            msg: `Xin chào!\n🗂️ Đây là file bạn yêu cầu, vui lòng kiểm tra.`, 
            attachments: [filePath], 
            ttl: 60000 * 60
          }, senderId, 0).catch(console.error);
        } catch (error) {
          console.error("Lỗi khi gửi file:", error);
          api.sendMessage({
            msg: `❌ Lỗi khi gửi file: ${error.message}`,
            ttl: 60000
          }, threadId, type);
        }
      } catch (error) {
        console.error("Lỗi xử lý file:", error);
        api.sendMessage({
          msg: `❌ Đã xảy ra lỗi: ${error.message}`,
          ttl: 60000
        }, threadId, type);
      }
    }

    // Hàm quét tất cả file trong thư mục và thư mục con  
    function scanFiles(directory) {
      let results = [];
      
      try {
        const items = fs.readdirSync(directory);

        for (const item of items) {
          const itemPath = path.join(directory, item);
          const stat = fs.statSync(itemPath);

          if (stat.isDirectory()) {
            // Thêm các file từ thư mục con  
            results = results.concat(scanFiles(itemPath));
          } else {
            // Thêm file vào danh sách kết quả  
            results.push(itemPath);
          }
        }
      } catch (error) {
        console.error(`Lỗi khi đọc thư mục ${directory}:`, error);
      }

      return results;
    }

    // Lấy tất cả file có thể chia sẻ  
    const allFilesUnsorted = scanFiles(SHARE_DIR);

    // Nếu không có file nào  
    if (allFilesUnsorted.length === 0) {
      return api.sendMessage({ 
        msg: "⚠️ Không có file nào để chia sẻ trong thư mục!", 
        quote: message, 
        ttl: 60000 * 60
      }, threadId, type);
    }

    // Tạo cấu trúc nhóm theo thư mục  
    const filesByFolder = {};
    allFilesUnsorted.forEach(file => {
      const relativePath = path.relative(SHARE_DIR, file);
      const parts = relativePath.split(path.sep);
      const folderName = parts.length > 1 ? parts[0] : "Other";
      
      if (!filesByFolder[folderName]) {
        filesByFolder[folderName] = [];
      }
      filesByFolder[folderName].push(file);
    });

    // Tạo chuỗi hiển thị và đồng thời xây dựng mảng các file theo thứ tự hiển thị
    let sortedFiles = [];
    let fileList = "🔍 Danh sách file có thể chia sẻ:\n*Lưu ý đây là những src sưu tầm từ mọi nguồn, 1 số được update lại\n\n";
    let counter = 1;

    // Lấy danh sách các thư mục được sắp xếp theo thứ tự alphabet
    const folderKeys = Object.keys(filesByFolder).sort();
    
    // Xử lý các thư mục (ngoại trừ "Other" nếu có nhiều thư mục)
    folderKeys.forEach(folder => {
      if (folder === "Other" && folderKeys.length > 1) return;
      
      fileList += `🗂️ ${folder}:\n`;
      
      // Sắp xếp file trong thư mục theo tên
      const sortedFolderFiles = filesByFolder[folder].sort((a, b) => 
        path.basename(a).localeCompare(path.basename(b))
      );
      
      sortedFolderFiles.forEach(file => {
        const relativePath = path.relative(SHARE_DIR, file);
        const displayPath = folder === "Other"
          ? path.basename(file)
          : relativePath.substring(folder.length + 1); // loại bỏ tên thư mục cha
          
        fileList += `${counter}. ${displayPath}\n`;
        sortedFiles.push(file);
        counter++;
      });
      
      fileList += "\n";
    });
    
    // Xử lý thư mục "Other" ở cuối nếu cần
    if (filesByFolder["Other"] && folderKeys.length > 1) {
      fileList += `🗂️ Other:\n`;
      
      // Sắp xếp file trong thư mục "Other" theo tên
      const sortedOtherFiles = filesByFolder["Other"].sort((a, b) => 
        path.basename(a).localeCompare(path.basename(b))
      );
      
      sortedOtherFiles.forEach(file => {
        fileList += `${counter}. ${path.basename(file)}\n`;
        sortedFiles.push(file);
        counter++;
      });
      
      fileList += "\n";
    }

    // Nếu không có tham số, hiển thị danh sách file được phân loại theo thư mục  
    if (messageContent.length < 2) {
      const helpText = fileList.trim() + "\n\n" +
        "Để lấy file, hãy sử dụng:\n" +
        "share [số thứ tự/hoặc tên file]\n" +
        "🗨️ File sẽ được gửi qua tin nhắn riêng.\n";
        
      return api.sendMessage({
        msg: helpText,
        quote: message,
        ttl: 60000 * 60
      }, threadId, type);
    }

    // Nếu tham số là số, lấy file theo số thứ tự dựa trên danh sách đã sắp xếp
    const argNum = Number(messageContent[1]);
    if (!isNaN(argNum) && argNum > 0 && argNum <= sortedFiles.length) {
      const selectedFile = sortedFiles[argNum - 1];
      return shareFile(selectedFile);
    }

    // Nếu tham số là tên file, tìm file theo tên (chạy trên toàn bộ file có thể chia sẻ)  
    const requestedFile = messageContent.slice(1).join(" ");
    const matchedFile = sortedFiles.find(file => {
      const relativePath = path.relative(SHARE_DIR, file);
      return relativePath === requestedFile || path.basename(file) === requestedFile;
    });

    if (matchedFile) {
      return shareFile(matchedFile);
    } else {
      return api.sendMessage({ 
        msg: `⚠️ Không tìm thấy file "${requestedFile}". Vui lòng kiểm tra lại tên file hoặc sử dụng "share" để xem danh sách file.`, 
        quote: message, 
        ttl: 500 * 60
      }, threadId, type);
    }
  }