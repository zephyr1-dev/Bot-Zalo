import { compare } from "semver";
import { logger } from "./utils.js";
import { appContext } from "./context.js";
const VERSION = "1.0.7";
const NPM_REGISTRY = "https://registry.npmjs.org/zlbotdqt";
export async function checkUpdate() {
    if (!appContext.options.checkUpdate)
        return;
    const response = await fetch(NPM_REGISTRY).catch(() => null);
    if (!response || !response.ok)
        return;
    const data = await response.json().catch(() => null);
    if (!data)
        return;
    const latestVersion = data["dist-tags"].latest;
    if (compare(VERSION, latestVersion) === -1) {
        logger.info(`A new version of zlbotdqt is available: ${latestVersion}`);
    }
    else {
        logger.info("zlbotdqt is up to date");
    }
}
