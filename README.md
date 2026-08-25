# Bot Zalo Anpha1 - Quản Lý Nhóm Thông Minh

> Bot Zalo toàn năng với hơn 50+ lệnh quản lý nhóm, bảo mật, giải trí và tích hợp AI

---

## Mục Lục

- [Giới Thiệu](#-giới-thiệu)
- [Tính Năng Chính](#-tính-năng-chính)
- [Yêu Cầu Hệ Thống](#-yêu-cầu-hệ-thống)
- [Cài Đặt](#-cài-đặt)
- [Cấu Hình](#-cấu-hình)
- [Hướng Dẫn Sử Dụng](#-hướng-dẫn-sử-dụng)
- [Danh Sách Lệnh](#-danh-sách-lệnh-đầy-đủ)
- [Tính Năng Chi Tiết](#-tính-năng-chi-tiết)
- [Bảo Mật & Chính Sách](#-bảo-mật--chính-sách)
- [Hỗ Trợ & Đóng Góp](#-hỗ-trợ--đóng-góp)

---

## Giới Thiệu

**Bot Zalo Anpha1** là một bot Zalo mạnh mẽ được xây dựng bằng **JavaScript (Node.js 20)** sử dụng thư viện **zlbotdqt**. Bot được thiết kế để hỗ trợ:

-  **Quản lý nhóm tự động** - Quản lý thành viên, phân quyền, thiết lập chính sách
-  **Bảo vệ nhóm** - Chống spam, chống link rác, lọc từ cấm, phát hiện nội dung không phù hợp
-  **Giải trí & Media** - Tìm nhạc, video YouTube, TikTok, tạo hình ảnh động, gửi media đa dạng
-  **AI & Trợ Lý Thông Minh** - Tích hợp GPT, Gemini, dịch thuật, tra cứu thông tin
-  **Game & Gamification** - Trò chơi may rủi, game nông trại, xếp hạng, quản lý điểm
-  **Công Cụ Tiện Ích** - Kiểm tra IP, domain, thời tiết, tốc độ mạng, QR code

---

## Tính Năng Chính

### Quản Lý & Bảo Vệ Nhóm (25+ lệnh)

- Quản lý thành viên (mute, kick, block, unlock)
- Duyệt thành viên mới
- Chào mừng & thông báo tạm biệt
- Phân quyền admin
- Cấu hình prefix tùy chỉnh

### Chống Spam & Abuse (18+ lệnh)

- **Anti-Link** - Chặn liên kết
- **Anti-Spam** - Chống tin nhắn lặp lại
- **Anti-Tag** - Giới hạn tag thành viên
- **Anti-BadWord** - Lọc từ ngữ không phù hợp
- **Anti-Sticker** - Chặn sticker lạm dụng
- **Anti-Photo/Video** - Kiểm soát media
- **Anti-Voice** - Giới hạn voice
- **Anti-Nude** - Phát hiện ảnh nhạy cảm
- **Anti-Bot** - Chặn bot/tài khoản giả
- **Anti-Undo** - Chống thu hồi tin nhắn
- **Anti-File** - Chặn file
- **Anti-Forward** - Chặn chuyển tiếp
- **Anti-SDT** - Chặn số điện thoại
- **Anti-BlockAll** - Chống kick/block hàng loạt
- Và nhiều hơn nữa...

### Media & Giải Trí (10+ lệnh)

-  Tìm và gửi nhạc (Zing MP3, NhạcCuaTui)
-  Tìm video YouTube
-  Dữ liệu TikTok
-  Tạo GIF text động
-  Tạo voice từ văn bản (Text-to-Speech)
-  Gửi sticker
-  Gửi ảnh/video từ bot
-  Gửi audio
-  Gửi file

### AI & Công Cụ Thông Minh

-  **GPT & Gemini** - Hỏi đáp AI, xử lý văn bản
-  **Dịch Thuật** - Dịch đa ngôn ngữ
-  **Google Search** - Tìm kiếm thông tin
-  **Thời Tiết** - Cập nhật thời tiết
-  **Tải Xuống** - Hỗ trợ download tài nguyên

### Tra Cứu & Thông Tin

-  Thông tin nhóm (groupinfo)
-  Thông tin thành viên (userinfo)
-  Xếp hạng chat
-  Thông tin ngân hàng
-  Kiểm tra IP
-  Kiểm tra tên miền
-  Kiểm tra quốc gia
-  Đo tốc độ mạng
-  Tạo & quét QR code

### Game & Giải Trí (8+ trò chơi)

-  **Tài Xỉu** - Trò chơi đoán may rủi
-  **Bầu Cua** - Game truyền thống
-  **Kéo Búa Bao** - Game cơ bản
-  **Chẵn Lẻ** - Trò đoán số
-  **Vietlott** - Giả lập xổ số
-  **Nông Trại** - Game chuyên đề
-  Quản lý điểm/tiền trong game
-  Bảng xếp hạng người chơi

### AI Học Tập & Tự Động Hóa

-  Học từ người dùng (learn mode)
-  Trả lời tự động (auto-reply)
-  Chế độ "chui" - gửi lời chào vui với delay
-  Nhắc nhở theo mô-tả (scold)
- Hỗ trợ mention thành viên

### Bảo Mật & Cảnh Báo

-  Cảnh cáo người dùng (warn)
-  Danh sách cảnh cáo
-  Lọc từ khóa / cụm từ xấu
-  Giới hạn spam trong khoảng thời gian
-  Giới hạn tag thành viên

### Quản Lý & Công Cụ

-  Xem trợ giúp (help)
-  Danh sách lệnh admin
-  Danh sách tất cả lệnh
-  Xem trạng thái bot
-  Tải tài nguyên
-  Chia sẻ nội dung

---

## Yêu Cầu Hệ Thống

- **Node.js**: v20.x trở lên
- **npm**: v10.x trở lên
- **Hệ điều hành**: Windows, macOS, Linux
- **RAM**: Tối thiểu 512MB
- **Kết nối mạng**: Bắt buộc để kết nối Zalo
- **PM2** (tùy chọn): Để chạy bot ở chế độ daemon

---

## Cài Đặt

### 1. Clone Repository

```
git clone https://github.com/zephyr1-dev/Bot-Zalo-Anpha1.git
cd Bot-Zalo-Anpha1
```

### 2. Cài Đặt Thư Viện

```
npm install
```

### 3. Cấu Hình Cơ Bản

Xem phần [Cấu Hình](#-cấu-hình) dưới đây.

### 4. Chạy Bot

```
# Windows
node index.js admin

# hoặc sử dụng run.bat
run.bat

# hoặc với PM2 (nếu cài đặt)
npm install -g pm2
node index.js admin pm2
```

---

## Cấu Hình

### Tệp Cấu Hình: `assets/config.json`

```
{
  "cookies": "YOUR_COOKIES_HERE",
  "imei": "YOUR_IMEI_HERE",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "prefix": "+",
  "adminIds": []
}
```

### Cách Lấy Thông Tin Cấu Hình

#### 1. **Cookies**

- Cài đặt tiện ích **J2TEAM Cookies** cho Chrome
- [Tải tiện ích tại đây](https://chrome.google.com/webstore/detail/j2team-cookies/okpidcojinmlaakglciglbpcpa...)
- Đăng nhập Zalo Web
- Nhấn icon tiện ích → Export cookies
- Copy toàn bộ cookies vào `config.json`

#### 2. **IMEI**

- Đăng nhập **Zalo Web**: [https://web.zalo.me/](https://web.zalo.me/)
- Mở **Developer Tools** (F12 hoặc Ctrl+Shift+I)
- Chuyển sang tab **Console**
- Chạy lệnh:
  ```
  localStorage.getItem('z_uuid');
  ```
- Copy kết quả vào trường `imei`

#### 3. **User Agent**

- Mặc định đã cấu hình sẵn
- Hoặc kiểm tra tại: [whatmyuseragent.com](https://whatmyuseragent.com/)
- Copy và thay thế giá trị `userAgent`

### Cấp Quyền Admin

1. Chạy bot lần đầu tiên
2. Xem UID của tài khoản trong console output
3. Mở file `assets/data/list_admin.json`
4. Thêm UID vào danh sách
5. Khởi động lại bot

**Ví dụ** **`list_admin.json`****:**

```
{
  "admins": [
    "1234567890",
    "0987654321"
  ]
}
```

---

## Hướng Dẫn Sử Dụng

### Bước Khởi Động Cơ Bản

1. **Cấu hình** file `assets/config.json`
2. **Khởi động** bot: `node index.js admin`
3. **Quan sát** console để xác nhận kết nối
4. **Gửi lệnh** vào nhóm hoặc tin nhắn riêng

### Sử Dụng Lệnh

**Cú Pháp Cơ Bản:**

```
<prefix><lệnh> <tham số>
```

**Ví Dụ:**

```
+help              → Hiển thị trợ giúp
+antilink on       → Bật chặn link
+mute @tên_user    → Mute người dùng
+all Xin chào!     → Tag tất cả + gửi tin
+gpt Hôm nay bạn thế nào?  → Hỏi AI
```

### Thay Đổi Prefix

Để thay đổi prefix từ `+` sang ký tự khác:

```
+setprefix !     → Thay prefix thành !
```

### Xem Danh Sách Lệnh

```
+help          → Xem tất cả lệnh
+admin         → Xem lệnh admin
+listcommands  → Danh sách chi tiết
```

---

## Danh Sách Lệnh Đầy Đủ

### Lệnh Quản Lý Nhóm

| LệnhChức Năng        |                            |
| -------------------- | -------------------------- |
| `+bot on/off`        | Bật/tắt bot trong nhóm     |
| `+welcome on/off`    | Bật/tắt thông báo chào     |
| `+bye on/off`        | Bật/tắt thông báo tạm biệt |
| `+approve on/off`    | Bật/tắt duyệt thành viên   |
| `+mute @user`        | Mute thành viên            |
| `+unmute @user`      | Bỏ mute                    |
| `+kick @user`        | Kick thành viên            |
| `+block @user`       | Chặn thành viên            |
| `+listmute`          | Xem danh sách mute         |
| `+add / +remove`     | Thêm/xóa admin             |
| `+listadmin`         | Xem danh sách admin        |
| `+setcmd on/off`     | Bật/tắt lệnh               |
| `+setprefix <ký_tự>` | Đổi prefix                 |

### Lệnh Chống Spam

| Lệnh                  | Chức Năng          |
| --------------------- | ------------------ |
| `+antilink on/off`    | Chặn link          |
| `+scanlink on/off`    | Quét link          |
| `+antispam on/off`    | Chống spam         |
| `+antitag on/off`     | Chặn tag lạm dụng  |
| `+antibadword on/off` | Lọc từ cấm         |
| `+antisticker on/off` | Chặn sticker       |
| `+antifile on/off`    | Chặn file          |
| `+antiphoto on/off`   | Chặn ảnh/video     |
| `+antivoice on/off`   | Chặn voice         |
| `+antinude on/off`    | Chặn ảnh nhạy cảm  |
| `+antibot on/off`     | Chặn bot giả       |
| `+antiundo on/off`    | Chống thu hồi      |
| `+antiforward on/off` | Chặn chuyển tiếp   |
| `+antisdt on/off`     | Chặn số điện thoại |

### Lệnh Media & Giải Trí

| Lệnh                   | Chức Năng         |
| ---------------------- | ----------------- |
| `+sendimage`           | Gửi ảnh           |
| `+sendvideo`           | Gửi video         |
| `+sendsticker`         | Gửi sticker       |
| `+sendaudio`           | Gửi audio         |
| `+giftext`             | Tạo GIF text      |
| `+voice`               | Tạo voice từ text |
| `+music <tên_nhạc>`    | Tìm nhạc          |
| `+youtube <tên_video>` | Tìm YouTube       |
| `+tiktok <từ_khóa>`    | Tìm TikTok        |
| `+google <từ_khóa>`    | Tìm Google        |
| `+translate <text>`    | Dịch văn bản      |

### Lệnh AI

| Lệnh                  | Chức Năng   |
| --------------------- | ----------- |
| `+gpt <câu_hỏi>`      | Hỏi ChatGPT |
| `+gemini <câu_hỏi>`   | Hỏi Gemini  |
| `+weather <địa_điểm>` | Thời tiết   |
| `+download <link>`    | Tải xuống   |

### Lệnh Tra Cứu

| Lệnh                       | Chức Năng            |
| -------------------------- | -------------------- |
| `+groupinfo`               | Thông tin nhóm       |
| `+userinfo @user`          | Thông tin thành viên |
| `+rank`                    | Xếp hạng             |
| `+bankinfo <số_tài_khoản>` | Tra cứu ngân hàng    |
| `+checkip <ip>`            | Kiểm tra IP          |
| `+checkdomain <domain>`    | Kiểm tra domain      |
| `+quocgia <đất_nước>`      | Kiểm tra quốc gia    |
| `+speedtest`               | Đo tốc độ mạng       |
| `+qr <text>`               | Tạo QR code          |
| `+scanqr`                  | Quét QR code         |

### Lệnh Game

| Lệnh                   | Chức Năng                  |
| ---------------------- | -------------------------- |
| `+register`            | Đăng ký game               |
| `+login`               | Đăng nhập                  |
| `+logout`              | Đăng xuất                  |
| `+taixiu <số_tiền>`    | Chơi tài xỉu               |
| `+baucua <số_tiền>`    | Chơi bầu cua               |
| `+keobuabao`           | Kéo búa bao                |
| `+chanle <số_tiền>`    | Chơi chẵn lẻ               |
| `+vietlott`            | Chơi Vietlott              |
| `+nongtrai`            | Game nông trại             |
| `+topplayers`          | Bảng xếp hạng              |
| `+nap / +rut / +topup` | Quản lý tài khoản          |
| `+claimdaily`          | Lãnh phần thưởng hàng ngày |

### Lệnh AI Học Tập

| Lệnh                         | Chức Năng               |
| ---------------------------- | ----------------------- |
| `+learn on/off`              | Bật/tắt chế độ học      |
| `+reply on/off`              | Bật/tắt trả lời tự động |
| `+autoreply`                 | Trả lời theo mô-tả      |
| `+scold @user`               | Nhắc nhở thành viên     |
| `+chui @user <số_lần>`       | Gửi lời chào vui        |
| `+chui <link_nhóm> <số_lần>` | Join và gửi lời chào    |

### Lệnh Cảnh Báo

| Lệnh                  | Chức Năng              |
| --------------------- | ---------------------- |
| `+warn @user`         | Cảnh cáo thành viên    |
| `+warnlist`           | Xem danh sách cảnh cáo |
| `+filter add <từ>`    | Thêm từ lọc            |
| `+filter remove <từ>` | Xóa từ lọc             |
| `+filter list`        | Xem danh sách lọc      |
| `+spamlimit <số>`     | Giới hạn spam          |
| `+taglimit <số>`      | Giới hạn tag           |

### Lệnh Phụ Trợ

| Lệnh                | Chức Năng             |
| ------------------- | --------------------- |
| `+help`             | Hiển thị trợ giúp     |
| `+admin`            | Xem lệnh admin        |
| `+listcommands`     | Danh sách tất cả lệnh |
| `+status`           | Xem trạng thái bot    |
| `+all <text>`       | Tag tất cả + text     |
| `+share <nội_dung>` | Chia sẻ               |

---

## Tính Năng Chi Tiết

### Hệ Thống Bảo Vệ Toàn Diện

Bot cung cấp một hệ thống bảo vệ nhóm hoàn chỉnh:

- **Chống Spam**: Phát hiện và xóa tin nhắn lặp lại
- **Quét Link**: Scan link độc hại, tích hợp whitelist
- **Lọc Từ**: Tự động xóa tin nhắn chứa từ cấm
- **Phát Hiện Ảnh Nhạy Cảm**: Chặn nội dung NSFW
- **Kiểm Soát Bot**: Chặn bot và tài khoản giả mạo
- **Giới Hạn Hành Động**: Chống kick/block hàng loạt

### Hệ Thống Game Tích Hợp

Bot hỗ trợ nhiều trò chơi may rủi:

```
Các Trò Chơi Có Sẵn:
├─ Tài Xỉu: Đoán Tài/Xỉu
├─ Bầu Cua: Trò chơi truyền thống
├─ Kéo Búa Bao: Game cơ bản
├─ Chẵn Lẻ: Đoán số chẵn/lẻ
├─ Vietlott: Giả lập xổ số
└─ Nông Trại: Game chuyên đề
```

**Quản Lý Game:**

- Đăng ký tài khoản trong game
- Nạp/rút tiền ảo
- Xem bảng xếp hạng
- Lãnh phần thưởng hàng ngày

### AI & Machine Learning

Bot tích hợp:

- **ChatGPT & Gemini** - Xử lý ngôn ngữ tự nhiên
- **Dịch Thuật** - Support đa ngôn ngữ
- **Auto-Reply** - Học từ các tin nhắn
- **Phân Tích Sentiment** - Hiểu cảm xúc

### Thống Kê & Xếp Hạng

- **Xếp Hạng Chat** - Top người chat nhiều nhất
- **Xếp Hạng Game** - Top người chơi game
- **Thống Kê Nhóm** - Phân tích hoạt động
- **Lịch Sử Cảnh Cáo** - Theo dõi vi phạm

---

## Bảo Mật & Chính Sách

### Điều Khoản Sử Dụng

- Bot được thiết kế để **quản lý và bảo vệ** nhóm, không phải để **phá hoại**
- Các tính năng bảo mật có **ngưỡng an toàn rõ ràng**
- Tính năng gửi lời chào có **giới hạn**: 1-10 tin/lần, delay tối thiểu 5 giây
- **Cấm** sử dụng bot để quấy rối, spam hoặc lạm dụng
- Admin phải **bật các chức năng phù hợp** theo nhu cầu nhóm
- Bot sẽ **tự động** report/block người dùng vi phạm nếu được cấu hình

### Bảo Mật Dữ Liệu

-  Cookies được lưu **cục bộ** trong `assets/config.json`
-  **Không** gửi thông tin sang server bên ngoài
-  Mỗi nhóm có **cấu hình riêng biệt**
-  Dữ liệu admin được **mã hóa** trong `list_admin.json`
-  Khuyến cáo: **Cập nhật cookies định kỳ** để bảo mật

### Quyền Hạn

| Cấp Độ                | Lệnh Có Thể Sử Dụng                            |
| --------------------- | ---------------------------------------------- |
| **Người dùng thường** | `+help`, `+gpt`, `+weather`, `+music`, `+game` |
| **Thành viên VIP**    | Tất cả lệnh người dùng + `+rank`, `+groupinfo` |
| **Admin Bot**         | Tất cả lệnh không giới hạn                     |
| **Chủ Nhóm**          | Quản lý toàn bộ cấu hình + cài đặt admin       |

---

## Hỗ Trợ & Đóng Góp

### Báo Cáo Lỗi

Nếu bạn gặp lỗi:

1. Kiểm tra **console output** để tìm chi tiết lỗi
2. Xem file log trong thư mục `logs/`
3. Tạo **Issue** trên GitHub với:
   - Mô tả lỗi chi tiết
   - Lệnh gây ra lỗi
   - Error message đầy đủ

### Đề Xuất Tính Năng

- Tạo **Issue** với nhãn `feature-request`
- Mô tả chi tiết tính năng muốn thêm
- Giải thích tại sao tính năng này cần thiết

### Đóng Góp Mã Nguồn

```
# Fork repository
# Clone fork của bạn
git clone https://github.com/your-username/Bot-Zalo-Anpha1.git
cd Bot-Zalo-Anpha1

# Tạo branch feature
git checkout -b feature/your-feature-name

# Commit changes
git commit -m "Add your feature"

# Push
git push origin feature/your-feature-name

# Tạo Pull Request
```

### Tài Liệu Bổ Sung

-  Chi tiết các tính năng: `CHUI_FEATURE.txt`
-  Schema Database: `bot-zalo-hahuyhoang.sql`
-  Cấu hình nhóm: `groupSettings.json`

---

## Cấu Trúc Thư Mục

```
Bot-Zalo/
├── assets/                    # Tài sản & cấu hình
│   ├── config.json           # Cấu hình bot
│   ├── data/
│   │   └── list_admin.json   # Danh sách admin
│   └── resources/            # Tài nguyên bot
├── src/                       # Mã nguồn chính
│   ├── index.js              # Entry point
│   ├── commands/             # Các lệnh
│   ├── modules/              # Các module
│   └── utils/                # Tiện ích
├── logs/                      # File log
├── public/                    # File công khai
├── chuatxt/                   # Danh sách tính năng
├── mybot/                     # Bot configs
├── package.json              # Dependencies
├── run.bat                    # Script chạy (Windows)
├── index.js                   # Launcher
└── README.md                  # Tài liệu này
```

---

## Xử Sự Cố Thường Gặp

### Lỗi: Config not found

```
→ Giải pháp: Tạo file assets/config.json với thông tin đúng
```

### Lỗi: Bot không trả lời

```
→ Giải pháp: Kiểm tra cookies có hợp lệ, đăng nhập lại Zalo Web
```

### Lỗi: PM2 not available

```
→ Giải pháp: Cài PM2 (npm install -g pm2) hoặc chạy trực tiếp Node
```

### Bot bị lag/chậm

```
→ Giải pháp: Giảm số lệnh chạy cùng lúc, tăng bộ nhớ RAM
```

---

## Liên Hệ

-  **Tác Giả**: Changg Nek (@zephyr1-dev)
-  **GitHub**: [github.com/zephyr1-dev](https://github.com/zephyr1-dev)
-  **Email**: [hoasivangogh@gmail.com]
-  **Support**: Tạo Issue trên repository

---

## Giấy Phép

Dự án này được cấp phép theo **MIT License**

```
Copyright (c) 2024-2026 Changg Nek (zephyr1-dev)
All rights reserved.
```

---

## Cảm Ơn

-  Cảm ơn tất cả users đã sử dụng và hỗ trợ bot
-  Cảm ơn contributors đã giúp cải thiện bot
-  Cảm ơn zlbotdqt library team

---

## Ghi Chú

>  **QUAN TRỌNG**: Bot được phát triển cho mục đích **quản lý và bảo vệ nhóm Zalo**. Vui lòng sử dụng **có trách nhiệm** và tuân thủ các quy tắc của Zalo.

>  **Bảo Mật**: Luôn giữ **cookies riêng tư** và cập nhật thường xuyên. Không chia sẻ `config.json` cho bất kỳ ai.

>  **Tương Thích**: Bot hoạt động với **Zalo Web**. Có thể không hỗ trợ Zalo Mobile trực tiếp.

---

**Phiên Bản**: 1.5.0
**Cập Nhật Lần Cuối**: 2026-08-22
**Trạng Thái**:  Đang Hoạt Động & Hỗ Trợ

---

**⭐ Nếu bạn thích bot này, hãy cho một ngôi sao! ⭐**
**Made with  by Changg Nek (zephyr1-dev)**
