import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "socialbot-logger-"));
  process.env.SOCIAL_BOT_LOG_DIR = dir;
});

afterEach(() => {
  delete process.env.SOCIAL_BOT_LOG_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

async function load() {
  return await import("../lib/storage/logger");
}

test("logEvent: nesne detayını okunur JSON metnine çevirir", async () => {
  const { logEvent, getSystemLogs } = await load();
  logEvent("info", "api", "istek", { status: 200, path: "/api/x" });
  const [e] = getSystemLogs();
  assert.equal(e.message, "istek");
  assert.match(e.details ?? "", /"status":200/);
});

test("logEvent: döngüsel (circular) detay logger'ı çökertmez", async () => {
  const { logEvent, getSystemLogs } = await load();
  const a: any = { name: "a" };
  a.self = a;
  assert.doesNotThrow(() => logEvent("warn", "api", "döngüsel", a));
  assert.equal(getSystemLogs().length, 1);
});

test("captureError: hata mesajını ve stack bilgisini kaydeder", async () => {
  const { captureError, getSystemLogs } = await load();
  captureError("instagram", "Yayın başarısız", new Error("Missing Permission"));
  const [e] = getSystemLogs();
  assert.equal(e.level, "error");
  assert.equal(e.source, "instagram");
  assert.match(e.details ?? "", /Missing Permission/);
  assert.match(e.stack ?? "", /Error: Missing Permission/);
});

test("captureError: Error olmayan değerleri de kaydeder", async () => {
  const { captureError, getSystemLogs } = await load();
  captureError("api", "garip hata", "düz metin hata");
  assert.match(getSystemLogs()[0].details ?? "", /düz metin hata/);
});

test("getSystemLogs: en yeni kayıt başta gelir", async () => {
  const { logEvent, getSystemLogs } = await load();
  logEvent("info", "api", "birinci");
  logEvent("info", "api", "ikinci");
  assert.deepEqual(getSystemLogs().map((l) => l.message), ["ikinci", "birinci"]);
});

test("getSystemLogs: bozuk satırı atlar, diğer kayıtları kaybetmez", async () => {
  const { logEvent, getSystemLogs, LOG_FILE_NAME } = await load();
  logEvent("info", "api", "iyi-1");
  fs.appendFileSync(path.join(dir, LOG_FILE_NAME), "{bozuk json\n");
  logEvent("info", "api", "iyi-2");
  assert.deepEqual(getSystemLogs().map((l) => l.message), ["iyi-2", "iyi-1"]);
});

test("origin: LOG_ORIGIN ortam değişkeni süreci etiketler", async () => {
  process.env.LOG_ORIGIN = "bot";
  try {
    const { logEvent, getSystemLogs } = await load();
    logEvent("info", "telegram", "bot mesajı");
    assert.equal(getSystemLogs()[0].origin, "bot");
  } finally {
    delete process.env.LOG_ORIGIN;
  }
});

test("saklama sınırı: eski kayıtlar budanır, en yeniler korunur", async () => {
  const { logEvent, getSystemLogs, MAX_RETAINED } = await load();
  const total = MAX_RETAINED + 150;
  for (let i = 0; i < total; i++) logEvent("info", "api", `n-${i}`);
  const logs = getSystemLogs();
  assert.ok(logs.length <= MAX_RETAINED + 100, `fazla kayıt tutuluyor: ${logs.length}`);
  assert.equal(logs[0].message, `n-${total - 1}`, "en yeni kayıt korunmalı");
});

test("clearSystemLogs: tüm kayıtları siler", async () => {
  const { logEvent, clearSystemLogs, getSystemLogs } = await load();
  logEvent("info", "api", "x");
  clearSystemLogs();
  assert.equal(getSystemLogs().length, 0);
});
