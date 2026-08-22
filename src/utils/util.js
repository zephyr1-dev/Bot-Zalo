import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec } from "child_process";
import { tempDir } from "./io-json.js";

const execPromise = promisify(exec);

export async function downloadFile(url, outputPath) {
  const { default: fetch } = await import("node-fetch");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, buffer);
  return outputPath;
}

export async function uploadTempFile(filePath) { return filePath; }
export async function loadImageBuffer(filePath) { return fs.promises.readFile(filePath); }
export async function getImageInfo(filePath) {
  const stat = await fs.promises.stat(filePath);
  return { path: filePath, size: stat.size, ext: path.extname(filePath).toLowerCase() };
}
export function checkExstentionFileRemote(url, allowed = []) {
  const ext = path.extname(new URL(url).pathname).toLowerCase().replace(".", "");
  return !allowed.length || allowed.includes(ext);
}
export async function deleteFile(filePath) {
  try { await fs.promises.rm(filePath, { force: true, recursive: false }); } catch {}
}
export async function execAsync(command, options = {}) { return execPromise(command, options); }
export async function restartSelf() {
  // Deliberately non-destructive: let the process manager handle restarts.
  return true;
}
