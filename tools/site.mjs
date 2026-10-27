import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
// One allowlist shared by preview, validation and Pages packaging.
export const pages = ['Arena game.html', 'index.html', 'game.html', 'studio.html', 'Downbeat_ID_Card_Studio.html'];
export const folders = ['campaigns', 'Pic', '角色卡'];
export function sitePath(value) {
  if (typeof value !== 'string' || !value || /[\\?#\0]/.test(value) || /^[a-z]+:/i.test(value)) throw Error(`Invalid site path: ${value}`);
  const resolved = path.resolve(root, value);
  if (!resolved.startsWith(root)) throw Error(`Path leaves site: ${value}`);
  return resolved;
}
