import Big from "big.js";

function formatTime(date) {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function getTimeNow() {
  const now = new Date();
  return new Date(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  );
}

function formatDate(date) {
  return date.toLocaleString("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function getTimeToString(timeInput) {
  const year = timeInput.getFullYear();
  const month = String(timeInput.getMonth() + 1).padStart(2, "0");
  const day = String(timeInput.getDate()).padStart(2, "0");
  const hours = String(timeInput.getHours()).padStart(2, "0");
  const minutes = String(timeInput.getMinutes()).padStart(2, "0");
  const seconds = String(timeInput.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Hàm helper để format số Big.js thành chuỗi đầy đủ Không có ký hiệu e+
function formatBigNumber(bigNum) {
  // Chuyển đổi sang chuỗi khoa học
  const scientificStr = bigNum.toString();

  // Nếu Không có ký hiệu e, format luôn với dấu chấm
  if (!scientificStr.includes('e')) {
    return scientificStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  // Tách phần số và số mũ
  const [base, exponent] = scientificStr.split('e');
  const exp = parseInt(exponent);

  // Xử lý phần cơ số
  const baseNum = base.replace('.', '');
  const baseLength = baseNum.length;

  let result;
  if (exp > 0) {
    // Thêm số 0 vào cuối nếu cần
    const zerosToAdd = exp - (baseLength - 1);
    result = baseNum + '0'.repeat(Math.max(0, zerosToAdd));
  } else {
    // Xử lý số âm nếu cần
    const absExp = Math.abs(exp);
    result = '0.' + '0'.repeat(absExp - 1) + baseNum;
  }

  // Thêm dấu chấm phân cách mỗi 3 số
  return result.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatCurrency(value, minChange = 900_000_000_000_000_000n) {
  const tempValue = Big(value).abs();
  if (tempValue <= minChange) return formatBigNumber(value);

  const locale = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 1,
  });

  // Lưu lại dấu của số
  const isNegative = value < 0;
  // Lấy giá trị tuyệt đối xử lý
  value = Math.abs(value);

  let strConvert = "";
  let conD = 0;

  // Xử lý tỷ
  while (value >= 1_000_000_000) {
    value /= 1_000_000_000;
    strConvert = " Tỷ " + strConvert;
    conD = 3;
  }

  // Xử lý triệu
  while (value >= 1_000_000) {
    value /= 1_000_000;
    strConvert = " Triệu " + strConvert;
    conD = 2;
  }

  // Xử lý nghìn
  while (value >= 1_000) {
    value /= 1_000;
    strConvert = " Nghìn " + strConvert;
    conD = 1;
  }

  // Xử lý các trường hợp đặc biệt
  switch (conD) {
    case 1:
      value *= 1000;
      strConvert = strConvert.substring(6);
      break;
    default:
      break;
  }

  strConvert = strConvert.replaceAll("  ", " ");
  // Thêm dấu trừ vào kết quả nếu là số âm
  return (isNegative ? "-" : "") + locale.format(value) + strConvert;
}

export function formatStatistic(value) {
  if (!value) return null;

  const matches = value.toString().replace(/[,.]/g, '').match(/^(\d+[,.]?\d*)\s*(.*)$/);
  if (!matches) return value;

  const [_, numberPart, textPart] = matches;
  const cleanNumber = numberPart.replace(/[,.]/g, '');

  const number = parseInt(cleanNumber);
  if (isNaN(number)) return value;

  let formattedNumber;
  if (number >= 1000000000) {
    formattedNumber = (number / 1000000000).toFixed(1).replace('.', ',') + 'B';
  } else if (number >= 1000000) {
    formattedNumber = (number / 1000000).toFixed(1).replace('.', ',') + 'M';
  } else if (number >= 1000) {
    formattedNumber = (number / 1000).toFixed(1).replace('.', ',') + 'K';
  } else {
    formattedNumber = number.toString();
  }

  return textPart ? `${formattedNumber} ${textPart}` : formattedNumber;
}

function normalizeSymbolName(input) {
  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a")
    .replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e")
    .replace(/ì|í|ị|ỉ|ĩ/g, "i")
    .replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o")
    .replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u")
    .replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y")
    .replace(/đ/g, "d")
    .replace(/\s+/g, "");
  return normalized;
}

// Thêm hàm mới để xử lý parse số tiền
function parseGameAmount(amount, currentBalance) {
  if (!amount) return null;

  amount = amount.toString().toLowerCase().trim();
  let value = new Big(0);

  // Xử lý all/allin
  if (amount === 'all' || amount === 'allin') {
    return 'allin';
  }

  try {
    // Xử lý phần trăm
    if (amount.endsWith('%')) {
      const percentage = parseFloat(amount.slice(0, -1));
      if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
        throw new Error('Phần trăm cược Không hợp lệ (1-100%)');
      }
      value = new Big(currentBalance).mul(percentage).div(100).round(0, Big.roundDown);
    }
    // Xử lý các đơn vị tiền tệ
    else {
      let normalized = amount.toLowerCase();
      let multiplier = new Big(1);

      // Tạo map các đơn vị và giá trị
      const units = {
        'k': new Big(1000),
        'm': new Big(1000000),
        'b': new Big(1000000000),
        'kb': new Big(100000), // 100k
        'bb': new Big(1000000000000) // 1000b
      };

      // Xử lý từng ký tự đơn vị từ phải sang trái
      while (normalized.length > 0) {
        let found = false;
        for (const [unit, value] of Object.entries(units)) {
          if (normalized.endsWith(unit)) {
            multiplier = multiplier.mul(value);
            normalized = normalized.slice(0, -1);
            found = true;
            break;
          }
        }
        if (!found) break;
      }

      // Xử lý số
      const number = parseFloat(normalized);
      if (isNaN(number)) {
        throw new Error('Số tiền Không hợp lệ');
      }

      value = new Big(number).mul(multiplier);
    }

    if (value.lt(0)) {
      throw new Error('Số tiền cược phải lớn hơn 0');
    }

    return value;
  } catch (error) {
    throw new Error('Số tiền Không hợp lệ: ' + error.message);
  }
}

function formatSeconds(seconds) {
  // Tính số giờ
  const hours = Math.floor(seconds / 3600);
  // Tính số phút còn lại sau khi trừ giờ
  const minutes = Math.floor((seconds % 3600) / 60);
  // Tính số giây còn lại
  const remainingSeconds = seconds % 60;

  // Format chuỗi kết quả
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes}p`);
  }
  parts.push(`${remainingSeconds}s`);

  return parts.join(' ');
}

function getContent(message) {
  return message.data.content.title || message.data.content;
}
 
function removeMention(message) {
  let content = message.data.content;
  try {
    content = content.title ? content.title : content;
    const mentions = message.data.mentions || [];
    if (content && typeof content === "string") {
      if (!mentions) return content.trim();
      const sortedMentions = [...mentions].sort((a, b) => b.pos - a.pos);
      sortedMentions.forEach((mention) => {
        content = content.replace(content.substr(mention.pos, mention.len), "");
      });
      return content.replace(/\s+/g, " ").trim();
    } else {
      return "";
    }
  } catch (error) {
    console.log("Error remove mention: ", content);
    return message.data.content;
  }
}

function capitalizeEachWord(string) {
  if (!string) return '';
  return string
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export {
  formatDate,
  formatTime,
  getTimeToString,
  getTimeNow,
  formatCurrency,
  normalizeSymbolName,
  formatBigNumber,
  parseGameAmount,
  formatSeconds,
  getContent,
  removeMention,
  capitalizeEachWord,
};
