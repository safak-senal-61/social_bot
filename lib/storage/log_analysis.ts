// lib/storage/log_analysis.ts
// Log kayıtlarını süzen, gruplayan ve özetleyen saf fonksiyonlar.
// Dosya sistemine dokunmaz; hem sunucuda hem tarayıcıda (debug sayfası) güvenle kullanılabilir.

export type LogLevel = "info" | "success" | "warn" | "error";

export type LogSource =
  | "telegram"
  | "web"
  | "client"
  | "api"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "ai"
  | "scheduler"
  | "autoreply"
  | "system";

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  /** Kaydı yazan süreç: "bot" (Telegram süreci) veya "web" (Next.js sunucusu) */
  origin: string;
  message: string;
  details?: string;
  stack?: string;
  durationMs?: number;
}

export interface LogFilter {
  levels?: LogLevel[];
  sources?: LogSource[];
  query?: string;
  /** Yalnızca son N milisaniye içindeki kayıtlar */
  sinceMs?: number;
}

export function filterLogs(
  logs: SystemLogEntry[],
  filter: LogFilter,
  now: number = Date.now()
): SystemLogEntry[] {
  const query = filter.query?.trim().toLocaleLowerCase("tr");
  return logs.filter((log) => {
    if (filter.levels?.length && !filter.levels.includes(log.level)) return false;
    if (filter.sources?.length && !filter.sources.includes(log.source)) return false;
    if (filter.sinceMs !== undefined && now - Date.parse(log.timestamp) > filter.sinceMs) return false;
    if (query) {
      const haystack = `${log.message} ${log.details ?? ""}`.toLocaleLowerCase("tr");
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export interface ErrorGroup {
  signature: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  sources: LogSource[];
  /** Grubun en yeni kaydı */
  sample: SystemLogEntry;
}

/** Değişken parçaları (sayılar, uzun kimlikler) çıkarıp aynı hataları aynı imzada toplar. */
function signatureOf(message: string): string {
  return message
    .replace(/\b[0-9a-f]{8,}\b/gi, "#")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("tr");
}

export function groupErrors(logs: SystemLogEntry[]): ErrorGroup[] {
  const groups = new Map<string, ErrorGroup>();
  for (const log of logs) {
    if (log.level !== "error") continue;
    const signature = signatureOf(log.message);
    const existing = groups.get(signature);
    if (!existing) {
      groups.set(signature, {
        signature,
        count: 1,
        firstSeen: log.timestamp,
        lastSeen: log.timestamp,
        sources: [log.source],
        sample: log,
      });
      continue;
    }
    existing.count += 1;
    if (!existing.sources.includes(log.source)) existing.sources.push(log.source);
    if (log.timestamp < existing.firstSeen) existing.firstSeen = log.timestamp;
    if (log.timestamp > existing.lastSeen) {
      existing.lastSeen = log.timestamp;
      existing.sample = log;
    }
  }
  return [...groups.values()].sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
}

export interface LogSummary {
  total: number;
  byLevel: Record<LogLevel, number>;
  bySource: Partial<Record<LogSource, number>>;
  lastSeenBySource: Partial<Record<LogSource, string>>;
  errorsLastHour: number;
  lastErrorAt: string | null;
}

export function summarizeLogs(logs: SystemLogEntry[], now: number = Date.now()): LogSummary {
  const summary: LogSummary = {
    total: logs.length,
    byLevel: { info: 0, success: 0, warn: 0, error: 0 },
    bySource: {},
    lastSeenBySource: {},
    errorsLastHour: 0,
    lastErrorAt: null,
  };
  for (const log of logs) {
    summary.byLevel[log.level] += 1;
    summary.bySource[log.source] = (summary.bySource[log.source] ?? 0) + 1;
    const seen = summary.lastSeenBySource[log.source];
    if (!seen || log.timestamp > seen) summary.lastSeenBySource[log.source] = log.timestamp;
    if (log.level === "error") {
      if (now - Date.parse(log.timestamp) <= 60 * 60_000) summary.errorsLastHour += 1;
      if (!summary.lastErrorAt || log.timestamp > summary.lastErrorAt) summary.lastErrorAt = log.timestamp;
    }
  }
  return summary;
}
