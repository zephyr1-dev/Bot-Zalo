import { parentPort, workerData } from "worker_threads";
import { performance } from "perf_hooks";
import crypto from "crypto";

const durationMs = workerData?.durationMs ?? 3000;

const start = performance.now();
let ops = 0;
while (performance.now() - start < durationMs) {
  const h = crypto.createHash("sha256");
  h.update(String(ops) + Math.random());
  h.digest("hex");
  ops++;
}

if (parentPort) parentPort.postMessage({ ops });


