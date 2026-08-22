const socket = io();

let groupSettings = {};

document.addEventListener("DOMContentLoaded", () => {
  const tickerContent = document.querySelector(".ticker-content");
  const groupList = document.querySelector(".group-list");
  const friendList = document.querySelector(".friend-list");
  const listTitle = document.querySelector(".list-title");
  const groupsBtn = document.getElementById("groupsBtn");
  const friendsBtn = document.getElementById("friendsBtn");
  const selectAllBtn = document.getElementById("selectAllBtn");
  const unselectAllBtn = document.getElementById("unselectAllBtn");
  const selectedCountSpan = document.querySelector(".selected-count");
  const refreshBtn = document.getElementById("refreshBtn");
  const messageContent = document.getElementById("messageContent");
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  const sendToFriends = document.getElementById("sendToFriends");
  const sendToGroups = document.getElementById("sendToGroups");
  const timeValue = document.getElementById("timeValue");
  const timeUnit = document.getElementById("timeUnit");
  const sendForSelected = document.getElementById("sendForSelected");
  const sendBulkMessage = document.getElementById("sendBulkMessage");
  let isBulkMessageActive = false;

  let selectedGroups = {};
  let selectedFriends = {};
  let currentListType = "group";

  // Lấy danh sách nhóm và bạn bè
  socket.emit("getAllGroups");
  socket.emit("getAllFriends");

  socket.on("friendsList", (friends) => {
    displayList("friend", friends);
    updateSelectedCount();
  });

  socket.on("groupsList", (groups) => {
    displayList("group", groups);
    updateSelectedCount();
  });

  // Xử lý tin nhắn mới
  socket.on("newMessage", (messageData) => {
    updateTicker(messageData);
    updateLogs(messageData);
  });

  // Chức năng chuyển đổi giữa danh sách nhóm và bạn bè
  groupsBtn.addEventListener("click", () => {
    groupList.style.display = "block";
    friendList.style.display = "none";
    listTitle.textContent = "Danh sách nhóm";
    groupsBtn.classList.add("active");
    friendsBtn.classList.remove("active");
    currentListType = "group";
    updateSelectedCount();
  });

  friendsBtn.addEventListener("click", () => {
    groupList.style.display = "none";
    friendList.style.display = "block";
    listTitle.textContent = "Danh sách bạn bè";
    friendsBtn.classList.add("active");
    groupsBtn.classList.remove("active");
    currentListType = "friend";
    updateSelectedCount();
  });

  refreshBtn.addEventListener("click", () => {
    if (currentListType === "group") {
      socket.emit("getAllGroups");
    } else {
      socket.emit("getAllFriends");
    }
  });

  function updateSelectedCount() {
    const groupCount = Object.keys(selectedGroups).length;
    const friendCount = Object.keys(selectedFriends).length;
    selectedCountSpan.textContent = `Đã Chọn: ${groupCount} Nhóm - ${friendCount} Bạn bè`;
  }

  function displayList(type, items) {
    const container = type === "group" ? groupList : friendList;
    container.innerHTML = "";
    items.forEach((item) => {
      const div = document.createElement("div");
      div.className = `${type}-item`;
      const id = item.groupId || item.userId;
      const isChecked =
        type === "group" ? selectedGroups[id] : selectedFriends[id];
      div.innerHTML = `
        <div class="item-info">
          ${
            type === "group"
              ? `<i class="fas fa-cog settings-icon" data-id="${id}" data-name="${
                  item.name || item.zaloName
                }"></i>`
              : ""
          }
          <img src="${item.avatar || item.avt}" class="avatar" alt="Avatar">
          <div class="item-details">
            <div class="item-name">${item.name || item.zaloName}</div>
            <div class="item-number-member">${
              type === "group" ? `${item.memberCount} thành viên` : ""
            }</div>
          </div>
          
        </div>
        <div class="item-actions">
          <button class="send-btn" data-id="${id}" data-type="${type}">
            <i class="fas fa-paper-plane"></i>
          </button>
          <input type="checkbox" class="item-checkbox" data-id="${id}" data-type="${type}" 
                 data-name="${item.name || item.zaloName}" ${
        isChecked ? "checked" : ""
      }>
        </div>
      `;

      // Thêm event listeners
      if (type === "group") {
        const settingsIcon = div.querySelector(".settings-icon");
        settingsIcon.addEventListener("click", (e) => {
          e.stopPropagation(); // Ngăn chặn sự kiện click lan ra ngoài
          const groupId = e.target.dataset.id;
          const groupName = e.target.dataset.name;
          showSettingsModal(groupId, groupName);
        });
      }

      container.appendChild(div);

      const checkbox = div.querySelector(".item-checkbox");
      checkbox.addEventListener("change", (e) => {
        const id = e.target.dataset.id;
        const itemType = e.target.dataset.type;
        const name = e.target.dataset.name;
        if (e.target.checked) {
          if (itemType === "group") {
            selectedGroups[id] = { name: name };
          } else {
            selectedFriends[id] = { name: name };
          }
        } else {
          if (itemType === "group") {
            delete selectedGroups[id];
          } else {
            delete selectedFriends[id];
          }
        }
        updateSelectedCount();
        updateSelected();
      });

      // Thay thế sự kiện active-bot-toggle bằng sự kiện cho settings icon
      if (type === "group") {
        const settingsIcon = div.querySelector(".settings-icon");
        settingsIcon.addEventListener("click", () =>
          showSettingsModal(id, item.name || item.zaloName)
        );
      }

      // Thêm sự kiện cho nút gửi
      const sendBtn = div.querySelector(".send-btn");
      sendBtn.addEventListener("click", async () => {
        const message = messageContent.value;
        const files = fileInput.files;
        const filePaths = await uploadFiles(files);
        const delay = calculateDelay();

        socket.emit("sendMessageToSingle", {
          id,
          type,
          message,
          filePaths,
          delay,
        });
      });
    });
    updateSelectedCount();
  }

  selectAllBtn.addEventListener("click", () => {
    const selector =
      currentListType === "group"
        ? ".group-list .item-checkbox"
        : ".friend-list .item-checkbox";
    document.querySelectorAll(selector).forEach((checkbox) => {
      checkbox.checked = true;
      const id = checkbox.dataset.id;
      if (currentListType === "group") {
        selectedGroups[id] = true;
      } else {
        selectedFriends[id] = true;
      }
    });
    updateSelectedCount();
    updateSelected();
  });

  unselectAllBtn.addEventListener("click", () => {
    const selector =
      currentListType === "group"
        ? ".group-list .item-checkbox"
        : ".friend-list .item-checkbox";
    document.querySelectorAll(selector).forEach((checkbox) => {
      checkbox.checked = false;
    });
    if (currentListType === "group") {
      selectedGroups = {};
    } else {
      selectedFriends = {};
    }
    updateSelectedCount();
    updateSelected();
  });

  function updateSelected() {
    socket.emit("updateSelected", {
      groups: selectedGroups,
      friends: selectedFriends,
    });
  }

  socket.on("configUpdated", (response) => {
    if (response.success) {
      console.log("Cập nhật cấu hình thành công");
      // Hiển thị thông báo thành công cho người dùng
    } else {
      console.error("Lỗi khi cập nhật cấu hình:", response.message);
      // Hiển thị thông báo lỗi cho người dùng
    }
  });

  // Thêm đoạn code này để lấy dữ liệu đã chọn khi trang web được tải
  socket.emit("getSelectedData");
  socket.on("selectedData", (data) => {
    selectedGroups = data.selectedGroups || {};
    selectedFriends = data.selectedFriends || {};
    updateSelectedCount();
  });

  // Thêm listener cho cập nhật trạng thái Active Bot
  socket.on("activeBotStatusUpdated", (response) => {
    if (response.success) {
      console.log("Cập nhật trạng thái Active Bot thành công");
      // Cập nhật groupSettings local
      if (groupSettings[response.groupId]) {
        groupSettings[response.groupId].activeBot = response.isActive;
      }
      // Cập nhật giao diện nếu cần
    } else {
      console.error(
        "Lỗi khi cập nhật trạng thái Active Bot:",
        response.message
      );
    }
  });

  // Cập nhật hàm để lấy dữ liệu khi trang web được tải
  socket.emit("getInitialData");
  socket.on("initialData", (data) => {
    selectedGroups = data.selectedGroups || {};
    selectedFriends = data.selectedFriends || {};
    groupSettings = data.groupSettings || {};
    updateSelectedCount();
    // Gọi lại displayList nếu cần để cập nhật giao diện
  });

  fileInput.addEventListener("change", updateFileList);

  function updateFileList() {
    fileList.innerHTML = "";
    Array.from(fileInput.files).forEach((file, index) => {
      const fileItem = document.createElement("div");
      fileItem.className = "file-item";
      fileItem.innerHTML = `
                <span>${file.name}</span>
                <button onclick="removeFile(${index})">Xóa</button>
            `;
      fileList.appendChild(fileItem);
    });
  }

  window.removeFile = function (index) {
    const dt = new DataTransfer();
    const { files } = fileInput;
    for (let i = 0; i < files.length; i++) {
      if (i !== index) {
        dt.items.add(files[i]);
      }
    }
    fileInput.files = dt.files;
    updateFileList();
  };

  sendToFriends.addEventListener("click", () => {
    if (checkContentAndAttachments()) {
      showConfirmDialog(
        "Xác nhận",
        "Bạn có chắc chắn muốn gửi tin nhắn đến tất cả bạn bè?",
        () => sendMessage("DirectMessage")
      );
    }
  });

  sendToGroups.addEventListener("click", () => {
    if (checkContentAndAttachments()) {
      showConfirmDialog(
        "Xác nhận",
        "Bạn có chắc chắn muốn gửi tin nhắn đến tất cả nhóm?",
        () => sendMessage("GroupMessage")
      );
    }
  });

  sendForSelected.addEventListener("click", () => {
    if (checkContentAndAttachments()) {
      showConfirmDialog(
        "Xác nhận",
        "Bạn có chắc chắn muốn gửi tin nhắn đến các mục đã chọn?",
        () => sendMessageForSelected()
      );
    }
  });

  sendBulkMessage.addEventListener("click", () => {
    if (checkContentAndAttachments()) {
      if (!isBulkMessageActive) {
        showConfirmDialog(
          "Xác nhận",
          "Bạn có chắc chắn muốn bắt đầu gửi tin nhắn liên tục?",
          () => sendBulkMessageForSelected()
        );
      } else {
        showConfirmDialog(
          "Xác nhận",
          "Bạn có chắc chắn muốn dừng gửi tin nhắn liên tục?",
          () => sendBulkMessageForSelected()
        );
      }
    }
  });

  socket.on("bulkMessageStatus", (status) => {
    if (status === "stopped") {
      sendBulkMessage.textContent = "Gửi liên tục cho các đối tượng đã chọn";
      sendBulkMessage.style.backgroundColor = "";
      sendBulkMessage.style.color = "";
      isBulkMessageActive = false;
    }
  });

  async function uploadFiles(files) {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i], files[i].name);
    }

    try {
      const response = await fetch("/upload", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      return result.filePaths;
    } catch (error) {
      console.error("Lỗi khi tải file:", error);
      return [];
    }
  }

  async function sendMessage(messageType) {
    const message = messageContent.value;
    const files = fileInput.files;
    const delay = calculateDelay();
    const filePaths = await uploadFiles(files);

    socket.emit("sendMessageAll", {
      message,
      messageType,
      delay,
    });
  }

  async function sendMessageForSelected() {
    const message = messageContent.value;
    const files = fileInput.files;
    const filePaths = await uploadFiles(files);
    const delay = calculateDelay();

    socket.emit("sendMessageForSelected", {
      message,
      delay,
    });
  }

  async function sendBulkMessageForSelected() {
    if (!isBulkMessageActive) {
      const delay = calculateDelay();

      if (isNaN(delay) || delay <= 0) {
        showPopupNotification(
          "Yêu Cầu Bổ Sung",
          "Bạn phải nhập số giây delay hợp lệ"
        );
        return;
      }

      const message = messageContent.value;
      const filePaths = await uploadFiles(fileInput.files);

      socket.emit("startBulkMessage", {
        content: message,
        interval: delay,
        filePaths: filePaths,
      });

      sendBulkMessage.textContent = "Dừng gửi liên tục";
      sendBulkMessage.style.backgroundColor = "red";
      sendBulkMessage.style.color = "white";
      isBulkMessageActive = true;
    } else {
      socket.emit("stopBulkMessage");
      sendBulkMessage.textContent = "Gửi liên tục cho các đối tượng đã chọn";
      sendBulkMessage.style.backgroundColor = "";
      sendBulkMessage.style.color = "";
      isBulkMessageActive = false;
    }
  }

  function calculateDelay() {
    const value = parseInt(timeValue.value);
    const unit = timeUnit.value;
    let delay = value;

    switch (unit) {
      case "minutes":
        delay *= 60;
        break;
      case "hours":
        delay *= 3600;
        break;
      case "days":
        delay *= 86400;
        break;
    }

    return delay * 1000; // Chuyển đổi thành mili giây
  }

  socket.on("messageSent", (response) => {
    console.log(response);
    // Hiển thị thông báo cho người dùng
  });

  socket.on("messageScheduled", (response) => {
    console.log(response);
    // Hiển thị thông báo cho người dùng
  });

  // Thêm hàm mới để xử lý gửi tin nhắn đến một nhóm hoặc bạn bè cụ thể
  socket.on("messageSentToSingle", (response) => {
    if (response.success) {
      console.log(
        `Đã gửi tin nhắn thành công đến ${
          response.type === "group" ? "nhóm" : "bạn bè"
        } ${response.id}`
      );
      // Hiển thị thông báo thành công cho người dùng
    } else {
      console.error(
        `Lỗi khi gửi tin nhắn đến ${
          response.type === "group" ? "nhóm" : "bạn bè"
        } ${response.id}:`,
        response.message
      );
      // Hiển thị thông báo lỗi cho người dùng
    }
  });

  const popupNotification = document.getElementById("popupNotification");
  const popupTitle = document.getElementById("popupTitle");
  const popupMessage = document.getElementById("popupMessage");
  const closePopupNotification = document.getElementById(
    "closePopupNotification"
  );

  // Thêm event listener cho nút đóng popup
  closePopupNotification.addEventListener("click", () => {
    popupNotification.style.display = "none";
  });

  // Hàm hiển thị popup
  function showPopupNotification(title, message) {
    popupTitle.textContent = title;
    popupMessage.textContent = message;
    popupNotification.style.display = "block";
  }

  function showConfirmDialog(title, message, onConfirm) {
    const confirmDialog = document.getElementById("confirmDialog");
    const confirmTitle = document.getElementById("confirmTitle");
    const confirmMessage = document.getElementById("confirmMessage");
    const confirmYes = document.getElementById("confirmYes");
    const confirmNo = document.getElementById("confirmNo");

    confirmTitle.textContent = title;
    confirmMessage.textContent = message;

    confirmDialog.style.display = "block";

    confirmYes.onclick = () => {
      confirmDialog.style.display = "none";
      onConfirm();
    };

    confirmNo.onclick = () => {
      confirmDialog.style.display = "none";
    };
  }

  function checkContentAndAttachments() {
    const content = messageContent.value.trim();
    const hasAttachments = fileInput.files.length > 0;

    if (!content && !hasAttachments) {
      showPopupNotification(
        "Thông báo",
        "Vui lòng nhập nội dung hoặc chọn file đính kèm."
      );
      return false;
    }
    return true;
  }

  // Thêm HTML cho modal vào body (thêm vào đầu file hoặc trong DOMContentLoaded)
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div class="settings-modal" id="settingsModal">
          <div class="modal-content">
              <span class="close-modal">&times;</span>
              <h3 class="modal-title">Cài đặt nhóm</h3>
              <div class="settings-grid" id="settingsGrid"></div>
          </div>
      </div>
    `
  );

  // Thêm hàm showSettingsModal
  function showSettingsModal(groupId, groupName) {
    const modal = document.getElementById("settingsModal");
    const settingsGrid = document.getElementById("settingsGrid");
    const settings = groupSettings[groupId];

    if (!settings) {
      console.error("Không tìm thấy cài đặt cho nhóm:", groupId);
      return;
    }

    const settingsList = {
      activeBot: "Tương tác với thành viên",
      activeGame: "bật xử lý tương tác trò chơi",
      antiSpam: "Chống spam",
      removeLinks: "Chặn liên kết",
      filterBadWords: "Xoá tin nhắn thô tục",
      welcomeGroup: "Chào thành viên mới",
      byeGroup: "Báo thành viên rời nhóm",
      learnEnabled: "Học máy",
      replyEnabled: "Trả lời tin nhắn nhóm",
      onlyText: "Chỉ được nhắn tin văn bản",
      memberApprove: "Phê duyệt thành viên mới",
      antiNude: "Chống gửi ảnh nhạy cảm",
      antiUndo: "Chống thu hồi tin nhắn",
      sendTask: "Gửi nội dung tự động",
      sendstk: "Gửi sticker tự động",
      sendtext: "Gửi text theo yêu cầu",
      autodownload: "Tự động dowload video",
    };

    settingsGrid.innerHTML = Object.entries(settingsList)
      .map(
        ([key, label]) => `
          <div class="setting-item">
            <span>${label}</span>
            <label class="switch">
              <input type="checkbox" class="setting-toggle" 
                     data-setting="${key}" 
                     data-group-id="${groupId}" 
                     ${settings[key] ? "checked" : ""}>
              <span class="slider round"></span>
            </label>
          </div>
        `
      )
      .join("");

    // Thêm event listeners cho các toggles
    settingsGrid.querySelectorAll(".setting-toggle").forEach((toggle) => {
      toggle.addEventListener("change", (e) => {
        const command = e.target.dataset.setting;
        const groupId = e.target.dataset.groupId;
        const isEnabled = e.target.checked;

        socket.emit("updateFutureStatus", {
          groupId,
          groupName,
          command,
          isActive: isEnabled,
        });
      });
    });

    modal.style.display = "block";

    // Đóng modal
    const closeBtn = modal.querySelector(".close-modal");
    closeBtn.onclick = () => {
      modal.style.display = "none";
    };

    // Đóng modal khi click bên ngoài
    window.onclick = (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    };
  }
});

function updateTicker(messageData) {
  const tickerContent = document.querySelector(".ticker-content");
  const { nameType, senderName, content } = messageData;

  const isPlainText = typeof content === "string";
  const contentText = isPlainText
    ? content
    : content.title
    ? content.title
    : content.catId
    ? "Sticker"
    : JSON.stringify(content);

  tickerContent.textContent = `< ${nameType} > ${senderName}: ${contentText}`;

  // Reset animation
  tickerContent.style.animation = "none";
  tickerContent.offsetHeight; // Trigger reflow
  tickerContent.style.animation = null;
}

function updateLogs(messageData) {
  const logContent = document.querySelector(".log-content");
  const logEntry = document.createElement("div");
  logEntry.className = "log-entry";

  // Kiểm tra xem người dùng có đang ở gần cuối trang Không (điều chỉnh ngưỡng)
  const isScrolledToBottom =
    logContent.scrollHeight - logContent.clientHeight - logContent.scrollTop <= 100;

  const timestamp = new Date().toLocaleTimeString();
  const { nameType, senderName, content, avtGroup } = messageData;

  const isPlainText = typeof content === "string";
  const contentText = isPlainText
    ? content
    : content.href
    ? "Caption: " + content.title + "</br>Link: " + content.href
    : content.catId
    ? "Sticker ID: " + content.catId
    : JSON.stringify(content);

  logEntry.innerHTML = `
    <div class="log-icon-container">
      <img src="${avtGroup}" alt="Group Avatar" class="log-icon">
    </div>
    <div class="log-content-container">
      <div class="log-header">
        <span class="log-type">${nameType}</span>
        <span class="log-time">[${timestamp}]</span>
      </div>
      <span class="log-message">${senderName}: ${contentText}</span>
      </div>
    `;

  logContent.appendChild(logEntry);

  // Chỉ tự động cuộn xuống nếu người dùng đang ở gần cuối trang
  if (isScrolledToBottom) {
    requestAnimationFrame(() => {
      logContent.scrollTop = logContent.scrollHeight;
    });
  }

  // Giới hạn số lượng tin nhắn hiển thị
  const maxLogEntries = 1000;
  while (logContent.children.length > maxLogEntries) {
    logContent.removeChild(logContent.firstChild);
  }
}

function updateActiveBotStatus({ groupId, groupName, isActive }) {
  socket.emit("updateActiveBotStatus", { groupId, groupName, isActive });
}

// Thay thế đoạn code hiện tại về menu bằng đoạn code sau
document.addEventListener("DOMContentLoaded", function () {
  const menuToggle = document.getElementById("menuToggle");
  const sideMenu = document.getElementById("sideMenu");
  const body = document.body;
  const colorChange = document.getElementById("colorChange");
  const root = document.documentElement;
  const totalGradients = 25; // Tổng số gradient có sẵn

  menuToggle.addEventListener("click", function (event) {
    event.stopPropagation();
    body.classList.toggle("menu-open");
    sideMenu.classList.toggle("active");

    // Thêm hiệu ứng mượt hơn cho nút đổi màu
    if (body.classList.contains("menu-open")) {
      colorChange.style.opacity = "0";
      colorChange.style.visibility = "hidden";
      colorChange.style.transform = "translateX(-20px)";
    } else {
      setTimeout(() => {
        colorChange.style.opacity = "1";
        colorChange.style.visibility = "visible";
        colorChange.style.transform = "translateX(0)";
      }, 150); // Giảm thời gian chờ để hiệu ứng mượt hơn
    }
  });

  // Đóng menu khi click bên ngoài
  document.addEventListener("click", function (event) {
    const isClickInsideMenu = sideMenu.contains(event.target);
    const isClickOnToggle = menuToggle.contains(event.target);

    if (
      !isClickInsideMenu &&
      !isClickOnToggle &&
      body.classList.contains("menu-open")
    ) {
      body.classList.remove("menu-open");
      sideMenu.classList.remove("active");

      // Hiện nút đổi màu khi đóng menu với hiệu ứng mượt hơn
      setTimeout(() => {
        colorChange.style.opacity = "1";
        colorChange.style.visibility = "visible";
        colorChange.style.transform = "translateX(0)";
      }, 150);
    }
  });

  // Chức năng đổi màu
  colorChange.addEventListener("click", function () {
    let currentIndex = parseInt(
      getComputedStyle(root).getPropertyValue("--gradient-index")
    );
    currentIndex = (currentIndex % totalGradients) + 1;

    root.style.setProperty("--gradient-index", currentIndex);
    root.style.setProperty(
      "--gradient-current",
      `var(--gradient-${currentIndex})`
    );
    root.style.setProperty(
      "--text-gradient-current",
      `var(--text-gradient-${currentIndex})`
    );

    // Cập nhật màu nền của body
    document.body.style.background = `var(--gradient-${currentIndex})`;

    // Cập nhật màu cho các phần tử văn bản
    updateTextColors();
  });

  function updateTextColors() {
    const elements = document.querySelectorAll("h1, h2, .list-title, .title");
    elements.forEach((element) => {
      element.style.backgroundImage = "var(--text-gradient-current)";
    });
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const popup = document.getElementById("botIntroPopup");
  const closeButton = document.getElementById("closePopup");

  closeButton.addEventListener("click", function () {
    popup.style.display = "none";
  });

  popup.addEventListener("click", function (e) {
    if (e.target === popup) {
      popup.style.display = "none";
    }
  });
});

// Thêm đoạn code sau vào đầu file main.js
document.addEventListener("DOMContentLoaded", function () {
  const popup = document.getElementById("botIntroPopup");
  const closeButton = document.getElementById("closePopup");

  // Hiển thị popup khi trang web được tải
  setTimeout(() => {
    popup.style.display = "block";
    popup.classList.add("fade-in");
  }, 500);

  function closePopup() {
    popup.classList.remove("fade-in");
    popup.classList.add("fade-out");
    setTimeout(() => {
      popup.style.display = "none";
      popup.classList.remove("fade-out");
    }, 500);
  }

  closeButton.addEventListener("click", closePopup);

  popup.addEventListener("click", function (e) {
    if (e.target === popup) {
      closePopup();
    }
  });
});

// Thêm đoạn code sau vào cuối file main.js
document.addEventListener("DOMContentLoaded", function () {
  const colorChange = document.getElementById("colorChange");
  const root = document.documentElement;
  const totalGradients = 25; // Tổng số gradient có sẵn

  colorChange.addEventListener("click", function () {
    const randomIndex = Math.floor(Math.random() * totalGradients) + 1;

    root.style.setProperty("--gradient-index", randomIndex);
    root.style.setProperty(
      "--gradient-current",
      `var(--gradient-${randomIndex})`
    );
    root.style.setProperty(
      "--text-gradient-current",
      `var(--text-gradient-${randomIndex})`
    );

    // Cập nhật màu nền của body
    document.body.style.background = `var(--gradient-${randomIndex})`;

    // Cập nhật màu cho các phần tử văn bản
    updateTextColors();
  });

  function updateTextColors() {
    const elements = document.querySelectorAll("h1, h2, .list-title, .title");
    elements.forEach((element) => {
      element.style.backgroundImage = "var(--text-gradient-current)";
    });
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const menuItems = document.querySelectorAll(".side-menu a");
  const gridItems = document.querySelectorAll(".grid-item");

  menuItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      const href = this.getAttribute("href");

      if (href && href !== "#") {
        return; // Cho phép chuyển hướng mặc định
      }

      e.preventDefault(); // Ngăn chặn hành vi mặc định cho các liên kết khác

      const page = this.getAttribute("data-page");
      if (page === "dashboard") {
        window.location.reload();
      } else {
        // Xử lý các trang khác nếu cần
      }
    });
  });
});
