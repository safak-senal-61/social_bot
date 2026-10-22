// lib/storage/logger.ts
// Telegram botu, web paneli ve API işlemlerinin ortak log kaydı.
//
// Bot ve Next.js ayrı süreçler olarak aynı dosyaya yazar. Bu yüzden dosya "oku-değiştir-yaz"
// yerine yalnızca sonuna satır eklenen (JSON Lines) biçimde tutulur; böylece eşzamanlı yazımlar
// birbirinin kaydını ezmez.
import fs from "fs";
import path from "path";
import type { LogLevel, LogSource, SystemLogEntry } from "./log_analysis";

export type { LogLevel, LogSource, SystemLogEntry } from "./log_analysis";

export const LOG_FILE_NAME = "system_logs.jsonl";
/** Budama sonrası korunacak en yeni kayıt sayısı */
export const MAX_RETAINED = 2000;
/** Dosya bu kadar satırı aşınca budanır (her yazımda değil, aralıklı) */
const TRIM_SLACK = 100;
const MAX_DETAILS_CHARS = 4000;
let appendCount = 0;

export function getLogDir(): string {
  return process.env.SOCIAL_BOT_LOG_DIR || path.join(process.cwd(), "data");
}

function logDir(): string {
  return getLogDir();
}

function logPath(): string {
  return path.join(logDir(), LOG_FILE_NAME);
}

function ensureDir() {
  fs.mkdirSync(logDir(), { recursive: true });
}

function stringifyDetails(details: unknown): string | undefined {
  if (details === undefined || details === null || details === "") return undefined;
  let text: string;
  if (typeof details === "string") {
    text = details;
  } else {
    try {
      const seen = new WeakSet<object>();
      text = JSON.stringify(details, (_key, value) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) return "[döngüsel]";
          seen.add(value);
        }
        return value;
      });
    } catch {
      text = String(details);
    }
  }
  return text.length > MAX_DETAILS_CHARS ? `${text.slice(0, MAX_DETAILS_CHARS)}…` : text;
}

function readLines(): string[] {
  try {
    return fs.readFileSync(logPath(), "utf-8").split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/** Tüm kayıtları en yeniden en eskiye doğru döndürür. Bozuk satırlar atlanır. */
export function getSystemLogs(): SystemLogEntry[] {
  const entries: SystemLogEntry[] = [];
  for (const line of readLines()) {
    try {
      entries.push(JSON.parse(line) as SystemLogEntry);
    } catch {
      // yarım kalmış / bozuk satır: diğer kayıtları etkilemesin
    }
  }
  return entries.reverse();
}

function trimIfNeeded() {
  const lines = readLines();
  if (lines.length <= MAX_RETAINED + TRIM_SLACK) return;
  const tmp = `${logPath()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, lines.slice(-MAX_RETAINED).join("\n") + "\n", "utf-8");
  fs.renameSync(tmp, logPath());
}

interface LogOptions {
  stack?: string;
  durationMs?: number;
}

export function logEvent(
  level: LogLevel,
  source: LogSource,
  message: string,
  details?: unknown,
  options: LogOptions = {}
): SystemLogEntry {
  ensureDir();
  const entry: SystemLogEntry = {
    id: `log_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`,
    timestamp: new Date().toISOString(),
    level,
    source,
    origin: process.env.LOG_ORIGIN || "web",
    message,
    details: stringifyDetails(details),
    ...options,
  };
  fs.appendFileSync(logPath(), JSON.stringify(entry) + "\n", "utf-8");
  // Her yazımda dosyayı baştan okumamak için budama yalnızca her 50 yazımda bir denenir
  appendCount += 1;
  if (appendCount % 50 === 0) {
    try {
      trimIfNeeded();
    } catch {
      // budama başarısızsa log yazımı yine de başarılı sayılır
    }
  }
  return entry;
}

/** Hatayı mesajı ve stack bilgisiyle "error" seviyesinde kaydeder. */
export function captureError(
  source: LogSource,
  message: string,
  error: unknown,
  extra?: unknown
): SystemLogEntry {
  const err = error instanceof Error ? error : undefined;
  const reason = err ? err.message : stringifyDetails(error) ?? "bilinmeyen hata";
  const details = extra === undefined ? reason : `${reason} | ${stringifyDetails(extra)}`;
  return logEvent("error", source, message, details, { stack: err?.stack });
}

export function clearSystemLogs() {
  ensureDir();
  fs.writeFileSync(logPath(), "", "utf-8");
}
