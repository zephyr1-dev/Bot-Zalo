export * from "./help.js";
export * from "./info.js";
export * from "./color.js";
export * from "./shape.js";
export * from "./event-image.js";
export * from "./game.js";

import fs from "fs";
import { deleteFile } from "../util.js";

export function formatNumber(number) {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function isValidUrl(urlString) {
  try {
    new URL(urlString);
    return true;
  } catch (error) {
    return false;
  }
}

export async function clearImagePath(pathFile) {
  await deleteFile(pathFile);
}
