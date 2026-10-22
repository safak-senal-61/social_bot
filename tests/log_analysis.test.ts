import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterLogs,
  groupErrors,
  summarizeLogs,
  type SystemLogEntry,
} from "../lib/storage/log_analysis";

const NOW = Date.parse("2026-10-22T12:00:00.000Z");

function entry(p: Partial<SystemLogEntry> & { message: string }): SystemLogEntry {
  return {
    id: Math.random().toString(36).slice(2),
    timestamp: new Date(NOW).toISOString(),
    level: "info",
    source: "api",
    origin: "web",
    ...p,
  };
}

const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

test("filterLogs: seviye ve kaynağa göre süzer", () => {
  const logs = [
    entry({ message: "a", level: "error", source: "telegram" }),
    entry({ message: "b", level: "info", source: "telegram" }),
    entry({ message: "c", level: "error", source: "instagram" }),
  ];
  const out = filterLogs(logs, { levels: ["error"], sources: ["telegram"] });
  assert.deepEqual(out.map((l) => l.message), ["a"]);
});

test("filterLogs: arama metni mesaj ve detayda büyük/küçük harf duyarsız çalışır", () => {
  const logs = [
    entry({ message: "Yayın başarısız", details: "HTTP 400 Missing Permission" }),
    entry({ message: "Başarılı" }),
  ];
  assert.equal(filterLogs(logs, { query: "missing permission" }).length, 1);
  assert.equal(filterLogs(logs, { query: "YAYIN" }).length, 1);
  assert.equal(filterLogs(logs, { query: "yok böyle bir şey" }).length, 0);
});

test("filterLogs: sinceMs yalnızca son N dakikadaki kayıtları bırakır", () => {
  const logs = [
    entry({ message: "yeni", timestamp: minutesAgo(5) }),
    entry({ message: "eski", timestamp: minutesAgo(90) }),
  ];
  const out = filterLogs(logs, { sinceMs: 60 * 60_000 }, NOW);
  assert.deepEqual(out.map((l) => l.message), ["yeni"]);
});

test("filterLogs: boş filtre hepsini döndürür", () => {
  const logs = [entry({ message: "a" }), entry({ message: "b" })];
  assert.equal(filterLogs(logs, {}).length, 2);
});

test("groupErrors: sayı ve kimlik içeren aynı hata tek grupta toplanır", () => {
  const logs = [
    entry({ message: "Instagram yorum yanıtı hatası: id 17841", level: "error", timestamp: minutesAgo(3) }),
    entry({ message: "Instagram yorum yanıtı hatası: id 99231", level: "error", timestamp: minutesAgo(1) }),
    entry({ message: "Cloudinary yüklenemedi", level: "error", timestamp: minutesAgo(10) }),
    entry({ message: "Her şey yolunda", level: "success" }),
  ];
  const groups = groupErrors(logs);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].count, 2, "en son görülen grup başta olmalı");
  assert.equal(groups[0].firstSeen, minutesAgo(3));
  assert.equal(groups[0].lastSeen, minutesAgo(1));
  assert.equal(groups[1].count, 1);
});

test("groupErrors: örnek olarak en yeni kaydı saklar", () => {
  const logs = [
    entry({ message: "Hata 1", level: "error", timestamp: minutesAgo(5), details: "eski" }),
    entry({ message: "Hata 2", level: "error", timestamp: minutesAgo(1), details: "yeni" }),
  ];
  assert.equal(groupErrors(logs)[0].sample.details, "yeni");
});

test("summarizeLogs: seviye, kaynak sayıları ve son saatteki hata sayısı", () => {
  const logs = [
    entry({ message: "a", level: "error", source: "telegram", timestamp: minutesAgo(5) }),
    entry({ message: "b", level: "error", source: "telegram", timestamp: minutesAgo(120) }),
    entry({ message: "c", level: "success", source: "instagram", timestamp: minutesAgo(2) }),
    entry({ message: "d", level: "warn", source: "ai", timestamp: minutesAgo(30) }),
  ];
  const s = summarizeLogs(logs, NOW);
  assert.equal(s.total, 4);
  assert.equal(s.byLevel.error, 2);
  assert.equal(s.byLevel.success, 1);
  assert.equal(s.bySource.telegram, 2);
  assert.equal(s.errorsLastHour, 1);
  assert.equal(s.lastErrorAt, minutesAgo(5));
  assert.equal(s.lastSeenBySource.instagram, minutesAgo(2));
});

test("summarizeLogs: kayıt yoksa sıfır değerler döner", () => {
  const s = summarizeLogs([], NOW);
  assert.equal(s.total, 0);
  assert.equal(s.errorsLastHour, 0);
  assert.equal(s.lastErrorAt, null);
});
