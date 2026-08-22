import fs from "fs/promises";
import path from "path";
import schedule from "node-schedule";
import chalk from "chalk";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "config-anti.json");

// Khởi tạo state để lưu data và theo dõi thay đổi
const antiState = {
  data: {
    badWords: [],
    linkRegex: "",
    violations: {},
    violationsNude: {}
  },
  hasChanges: false
};

// Hàm đọc config từ file
export async function loadAntiConfig() {
  try {
    const data = await fs.readFile(configPath, "utf8");
    antiState.data = JSON.parse(data);
    console.log(chalk.green("Đã tải xong config anti service"));
  } catch (error) {
    console.error("Lỗi khi đọc file config anti:", error);
  }
}

// Hàm lưu config vào file
export async function saveAntiConfig() {
  try {
    await fs.writeFile(configPath, JSON.stringify(antiState.data, null, 2));
    antiState.hasChanges = false;
  } catch (error) {
    console.error("Lỗi khi ghi file config anti:", error);
  }
}

// Hàm cập nhật data và đánh dấu có thay đổi
export function updateAntiConfig(newData) {
  antiState.data = { ...antiState.data, ...newData };
  antiState.hasChanges = true;
}

// Khởi động schedule kiểm tra và lưu thay đổi
export async function startAntiConfigCheck() {
  await loadAntiConfig();
  const jobName = "antiConfigCheck";
  const existingJob = schedule.scheduledJobs[jobName];
  if (existingJob) {
    existingJob.cancel();
  }

  schedule.scheduleJob(jobName, "*/5 * * * * *", async () => {
    if (antiState.hasChanges) {
      await saveAntiConfig();
    }
  });

  console.log(chalk.yellow("Đã khởi động schedule kiểm tra thay đổi config anti"));
}

// Export state để các module khác có thể truy cập
export const getAntiState = () => antiState;
