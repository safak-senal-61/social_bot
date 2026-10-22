// lib/storage/heartbeat.ts
// Telegram botu ayrı bir süreç olduğu için web paneli çalışıp çalışmadığını doğrudan bilemez.
// Bot belirli aralıklarla bu dosyayı günceller; panel dosyanın tazeliğine bakarak durumu gösterir.
import fs from "fs";
import path from "path";
import { getLogDir } from "./logger";

export const HEARTBEAT_FILE_NAME = "bot_heartbeat.json";
export const HEARTBEAT_INTERVAL_MS = 15_000;
/** Bu süreden eski nabız "bot kapalı" demektir (iki kaçırılmış atım toleransı) */
export const HEARTBEAT_STALE_MS = HEARTBEAT_INTERVAL_MS * 2 + 5_000;

export interface BotHeartbeat {
  alive: boolean;
  lastBeat: string | null;
  pid: number | null;
}

function heartbeatPath() {
  return path.join(getLogDir(), HEARTBEAT_FILE_NAME);
}

export function writeHeartbeat(info: { pid: number }): void {
  fs.mkdirSync(getLogDir(), { recursive: true });
  fs.writeFileSync(
    heartbeatPath(),
    JSON.stringify({ lastBeat: new Date().toISOString(), pid: info.pid }),
    "utf-8"
  );
}

export function readHeartbeat(now: number = Date.now()): BotHeartbeat {
  try {
    const raw = JSON.parse(fs.readFileSync(heartbeatPath(), "utf-8")) as { lastBeat: string; pid: number };
    const age = now - Date.parse(raw.lastBeat);
    return { alive: age <= HEARTBEAT_STALE_MS, lastBeat: raw.lastBeat, pid: raw.pid ?? null };
  } catch {
    return { alive: false, lastBeat: null, pid: null };
  }
}
