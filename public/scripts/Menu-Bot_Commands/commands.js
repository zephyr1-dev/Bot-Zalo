async function loadCommands() {
  try {
    const socket = io();

    // Gửi yêu cầu lấy danh sách lệnh
    socket.emit("getCommands");

    // Lắng nghe phản hồi từ server
    socket.on("commandList", (data) => {
      const commands = data.commands;

      // Phân loại commands theo type và permission
      const commandCategories = {
        "Lệnh Quản trị": {
          "Quản lý Bot": commands.filter(
            (cmd) =>
              cmd.type === 3 &&
              ["bot", "prefix", "gameactive", "learn", "learnnow", "unlearn", "reply", "undo"].includes(cmd.name) &&
              cmd.active
          ),
          "Quản lý Nhóm": commands.filter(
            (cmd) =>
              cmd.type === 3 &&
              ["settinggroup", "changelink", "welcome", "bye", "approve", "all", "kick", "block"].includes(cmd.name) &&
              cmd.active
          ),
          "Quản lý Thành viên": commands.filter(
            (cmd) =>
              cmd.type === 3 && ["mute", "unmute", "listmute", "ban", "unban", "scold"].includes(cmd.name) && cmd.active
          ),
          "Quản lý Admin": commands.filter(
            (cmd) =>
              cmd.type === 3 &&
              ["add", "remove", "listadmin", "keygold", "keysilver", "unkey"].includes(cmd.name) &&
              cmd.active
          ),
          "Bảo vệ & Chống Spam": commands.filter(
            (cmd) =>
              cmd.type === 3 &&
              [
                "antibadword",
                "antilink",
                "antispam",
                "antinude",
                "antiundo",
                "onlytext",
                "blockbot",
                "unblockbot",
                "listblockbot",
              ].includes(cmd.name) &&
              cmd.active
          ),
        },
        "Lệnh Thành viên": {
          "Thông tin & Tiện ích": commands.filter(
            (cmd) =>
              cmd.type === 1 &&
              ["help", "command", "info", "card", "group", "detail", "topchat"].includes(cmd.name) &&
              cmd.active
          ),
          "Chat & Tương tác": commands.filter(
            (cmd) =>
              cmd.type === 1 &&
              ["chat", "gpt", "voice", "dich", "thoitiet", "truyencuoi", "tarrot"].includes(cmd.name) &&
              cmd.active
          ),
          "Giải trí Hình ảnh": commands.filter(
            (cmd) =>
              cmd.type === 1 &&
              ["image", "girl", "boy", "cosplay", "anime", "sticker", "gif"].includes(cmd.name) &&
              cmd.active
          ),
          "Giải trí Video": commands.filter(
            (cmd) =>
              cmd.type === 1 && ["vdgirl", "vdsexy", "vdcos", "vdanime", "tiktok"].includes(cmd.name) && cmd.active
          ),
          "Âm nhạc": commands.filter(
            (cmd) => cmd.type === 1 && ["zingmp3", "nhaccuatui", "soundcloud"].includes(cmd.name) && cmd.active
          ),
        },
        "Lệnh Game": {
          "Trò chơi Mini": commands.filter(
            (cmd) => cmd.type === 5 && ["doanso", "noitu", "doantu"].includes(cmd.name) && cmd.active
          ),
          "Trò chơi May rủi": commands.filter(
            (cmd) =>
              cmd.type === 5 &&
              ["baucua", "taixiu", "chanle", "keobuabao", "vietlott655"].includes(cmd.name) &&
              cmd.active
          ),
          "Nông trại": commands.filter(
            (cmd) => cmd.type === 5 && ["nongtrai", "mybag"].includes(cmd.name) && cmd.active
          ),
          "Tài khoản Game": commands.filter(
            (cmd) =>
              cmd.type === 5 &&
              ["login", "dangky", "logout", "mycard", "daily", "rank"].includes(cmd.name) &&
              cmd.active
          ),
          "Giao dịch": commands.filter(
            (cmd) => cmd.type === 5 && ["nap", "rut", "bank"].includes(cmd.name) && cmd.active
          ),
        },
      };

      renderCommands("", commandCategories);
      setupSearchHandler(commandCategories);
    });

    socket.on("error", (error) => {
      console.error("Lỗi Socket:", error);
      const commandList = document.getElementById("adminCommandList");
      commandList.innerHTML = '<div class="error">Đã xảy ra lỗi khi tải danh sách lệnh. Vui lòng thử lại sau.</div>';
    });
  } catch (error) {
    console.error("Lỗi khi tải danh sách lệnh:", error);
    const commandList = document.getElementById("adminCommandList");
    commandList.innerHTML = '<div class="error">Đã xảy ra lỗi khi tải danh sách lệnh. Vui lòng thử lại sau.</div>';
  }
}

function setupSearchHandler(commandCategories) {
  const searchInput = document.getElementById("adminCommandSearch");
  searchInput.addEventListener("input", (e) => {
    renderCommands(e.target.value, commandCategories);
  });
}

function normalizeVietnamese(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function renderCommands(filter = "", commandCategories) {
  const commandList = document.getElementById("adminCommandList");
  commandList.innerHTML = "";
  const normalizedFilter = normalizeVietnamese(filter);
  let hasResults = false;

  for (const [category, subCategories] of Object.entries(commandCategories)) {
    const categoryElement = document.createElement("div");
    categoryElement.classList.add("command-category");

    const categoryTitle = document.createElement("h3");
    categoryTitle.textContent = category;
    categoryElement.appendChild(categoryTitle);

    const subCategoriesContainer = document.createElement("div");
    subCategoriesContainer.classList.add("sub-categories-container");

    for (const [subCategory, commands] of Object.entries(subCategories)) {
      const filteredCommands = commands.filter(
        (command) =>
          normalizeVietnamese(`!${command.name}`).includes(normalizedFilter) ||
          normalizeVietnamese(command.description).includes(normalizedFilter)
      );

      if (filteredCommands.length === 0) continue;

      hasResults = true;
      const subCategoryElement = document.createElement("div");
      subCategoryElement.classList.add("sub-category");
      subCategoryElement.innerHTML = `<h4>${subCategory}</h4>`;

      const commandsContainer = document.createElement("div");
      commandsContainer.classList.add("commands-container");

      filteredCommands.forEach((command) => {
        const commandElement = document.createElement("div");
        commandElement.classList.add("command-item");
        const usage = `!${command.name}${command.usage ? ` ${command.usage}` : ""}`;
        commandElement.innerHTML = `
                    <h5>${command.icon} !${command.name}</h5>
                    <p>${command.description}</p>
                    <p class="usage"><strong>Cách sử dụng:</strong> ${usage}</p>
                    ${
                      command.alias
                        ? `<p class="alias"><strong>Tên gọi khác:</strong> !${command.alias.join(", !")}</p>`
                        : ""
                    }
                    <p class="countdown"><strong>Thời gian chờ:</strong> ${command.countdown}s</p>
                `;
        commandsContainer.appendChild(commandElement);
      });

      subCategoryElement.appendChild(commandsContainer);
      subCategoriesContainer.appendChild(subCategoryElement);
    }

    if (subCategoriesContainer.children.length > 0) {
      categoryElement.appendChild(subCategoriesContainer);
      commandList.appendChild(categoryElement);
    }
  }

  if (!hasResults) {
    const noResults = document.createElement("div");
    noResults.classList.add("no-results");
    noResults.textContent = "Không tìm thấy lệnh nào phù hợp.";
    commandList.appendChild(noResults);
  }
}

document.addEventListener("DOMContentLoaded", loadCommands);
