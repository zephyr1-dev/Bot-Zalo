import os from "os";
import crypto from "crypto";
import { Worker } from "worker_threads";
import { performance } from "perf_hooks";
import { sendMessageCompleteRequest, sendMessageFromSQL } from "../../../service-debug/chat-zalo/chat-style/chat-style.js";

const TIME_TO_LIVE_MESSAGE = 600000;
const TEST_DURATION = 10000;

let isTestingBenchmark = false;
let currentTester = {
  id: null,
  threadId: null,
  name: null,
};
const benchmarkPromise = new Map();
let idRq = "BENCHMARK";

export class CpuBenchmark {
  constructor(options = {}) {
    this.durationMs = options.durationMs ?? 3000;
    this.workers = options.workers ?? os.cpus().length;
  }

  async runSingleThreadBenchmark(durationMs = this.durationMs) {
    const start = performance.now();
    let ops = 0;
    while (performance.now() - start < durationMs) {
      const h = crypto.createHash("sha256");
      h.update(String(ops) + Math.random());
      h.digest("hex");
      ops++;
    }
    return ops;
  }

  createWorker(durationMs) {
    return new Promise((resolve, reject) => {
      const workerFile = new URL("./bench-worker.js", import.meta.url);
      const w = new Worker(workerFile, { workerData: { durationMs } });
      w.once("message", (msg) => resolve(msg.ops));
      w.once("error", reject);
      w.once("exit", (code) => {
        if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
      });
    });
  }

  async runMultiThreadBenchmark(durationMs = this.durationMs, numWorkers = this.workers) {
    const workerPromises = [];
    for (let i = 0; i < numWorkers; i++) {
      workerPromises.push(this.createWorker(durationMs));
    }
    const results = await Promise.all(workerPromises);
    const totalOps = results.reduce((s, v) => s + v, 0);
    return { totalOps, perWorker: results };
  }

  async run() {
    await this.runSingleThreadBenchmark(500);
    const singleOps = await this.runSingleThreadBenchmark(this.durationMs);
    const multi = await this.runMultiThreadBenchmark(this.durationMs, this.workers);

    const multiOps = multi.totalOps;
    const effectiveCores = Math.max(1, multiOps / Math.max(1, singleOps));

    return {
      single: { ops: singleOps, durationMs: this.durationMs },
      multi: { ops: multiOps, durationMs: this.durationMs, workers: this.workers },
      effectiveCores,
    };
  }
}

export async function runBench(options = {}) {
  const bench = new CpuBenchmark(options);
  return bench.run();
}

export async function handleBenchmarkCommand(api, message) {
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const threadId = message.threadId;
  let tempObj = {};

  if (isTestingBenchmark) {
    tempObj = {
      caption: `Hiện tại bot đang thực hiện đánh giá hiệu năng CPU theo yêu cầu của ${currentTester.name}. Vui lòng đợi kết quả.`,
    };
    await sendMessageCompleteRequest(api, message, tempObj, 30000);
  }

  if (benchmarkPromise.has(idRq)) {
    let result = await benchmarkPromise.get(idRq);
    tempObj = { message: `Đây là kết quả đánh giá hiệu năng CPU của bot!\n\n${result}` };
    await sendMessageFromSQL(api, message, tempObj, false, TIME_TO_LIVE_MESSAGE);
    return;
  }

  try {
    isTestingBenchmark = true;
    currentTester = {
      id: senderId,
      name: senderName,
      threadId: threadId,
    };

    tempObj = { caption: `Vui lòng đợi bot đánh giá hiệu năng CPU...` };
    await sendMessageCompleteRequest(api, message, tempObj, TEST_DURATION);

    const result = createBenchmarkResult();
    benchmarkPromise.set(idRq, result);
    const output = await result;

    tempObj = { message: `Đây là kết quả đánh giá hiệu năng CPU của bot!\n\n${output}` };
    await sendMessageFromSQL(api, message, tempObj, false, TIME_TO_LIVE_MESSAGE);
  } catch (error) {
    console.error("Lỗi khi đánh giá hiệu năng CPU:", error);
    const objectTemp = { message: `Đã xảy ra lỗi khi đánh giá hiệu năng CPU. Vui lòng thử lại sau.`, success: false };
    await sendMessageFromSQL(api, message, objectTemp, true, 30000);
  } finally {
    isTestingBenchmark = false;
    currentTester = { id: null, name: null, threadId: null };
    await new Promise((resolve) => setTimeout(resolve, 5000));
    benchmarkPromise.delete(idRq);
  }
}

async function createBenchmarkResult() {
  const result = await runBench();
  const caption = "== ĐÁNH GIÁ HIỆU NĂNG CPU ==";
  const output = `
${caption}
🧑‍💻  Đơn luồng:
   - Số phép toán: ${result.single.ops.toLocaleString("vi-VN")}
   - Thời gian chạy: ${result.single.durationMs} ms

🧑‍💻  Đa luồng:
   - Số phép toán: ${result.multi.ops.toLocaleString("vi-VN")}
   - Thời gian chạy: ${result.multi.durationMs} ms
   - Số luồng (workers): ${result.multi.workers}

💡  Số lõi CPU hiệu quả ước tính: ${result.effectiveCores.toFixed(2)}
`;
  return output;
}
