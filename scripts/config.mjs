import { readFile, stat } from "node:fs/promises";
import { validateConfig } from "../src/config.js";

export async function loadConfig(path) {
  if (!path) return validateConfig();
  if ((await stat(path)).size > 256_000) throw new Error("Configuration exceeds 256 KB.");
  return validateConfig(JSON.parse(await readFile(path, "utf8")));
}
