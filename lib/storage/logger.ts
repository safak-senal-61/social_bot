// lib/storage/logger.ts
// Telegram botu, web paneli ve API işlemlerinin canlı sistem loglarını tutan merkezi logger
import fs from "fs";
import path from "path";

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warn" | "error";
  source: "telegram" | "web" | "api" | "facebook" | "instagram" | "ai" | "scheduler" | "autoreply";
  message: string;
  details?: any;
}

const DATA_DIR = path.join(process.cwd(), "data");
const LOG_FILE = path.join(DATA_DIR, "system_logs.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getSystemLogs(): SystemLogEntry[] {
  ensureDir();
  if (!fs.existsSync(LOG_FILE)) return [];
  try {
    const raw = fs.readFileSync(LOG_FILE, "utf-8");
    return JSON.parse(raw) as SystemLogEntry[];
  } catch {
    return [];
  }
}

export function logEvent(
  level: "info" | "success" | "warn" | "error",
  source: SystemLogEntry["source"],
  message: string,
  details?: any
) {
  ensureDir();
  const logs = getSystemLogs();
  const entry: SystemLogEntry = {
    id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
    details: details ? (typeof details === "string" ? details : JSON.stringify(details).slice(0, 500)) : undefined,
  };

  logs.unshift(entry);
  const trimmed = logs.slice(0, 300); // Son 300 logu tut
  fs.writeFileSync(LOG_FILE, JSON.stringify(trimmed, null, 2), "utf-8");
  return entry;
}

export function clearSystemLogs() {
  ensureDir();
  fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2), "utf-8");
}
