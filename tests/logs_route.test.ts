import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "socialbot-route-"));
  process.env.SOCIAL_BOT_LOG_DIR = dir;
});

afterEach(() => {
  delete process.env.SOCIAL_BOT_LOG_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

const postJson = (body: unknown) =>
  new Request("http://localhost/api/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

async function load() {
  const route = await import("../app/api/logs/route");
  const { getSystemLogs } = await import("../lib/storage/logger");
  return { ...route, getSystemLogs };
}

test("action=client: tarayıcı hatası 'client' kaynağıyla kaydedilir", async () => {
  const { POST, getSystemLogs } = await load();
  const res = await POST(
    postJson({ action: "client", level: "error", message: "TypeError: x is undefined", details: "page.tsx:10", stack: "at foo" })
  );
  assert.equal(res.status, 200);
  const [log] = getSystemLogs();
  assert.equal(log.source, "client");
  assert.equal(log.level, "error");
  assert.equal(log.message, "TypeError: x is undefined");
  assert.equal(log.stack, "at foo");
});

test("action=client: geçersiz seviye 'error'a düşer, aşırı uzun mesaj kısaltılır", async () => {
  const { POST, getSystemLogs } = await load();
  await POST(postJson({ action: "client", level: "kaos", message: "m".repeat(5000) }));
  const [log] = getSystemLogs();
  assert.equal(log.level, "error");
  assert.ok(log.message.length <= 600);
});

test("action=client: mesajsız istek reddedilir", async () => {
  const { POST, getSystemLogs } = await load();
  const res = await POST(postJson({ action: "client" }));
  assert.equal(res.status, 400);
  assert.equal(getSystemLogs().length, 0);
});

test("action=clear: kayıtları siler", async () => {
  const { POST, getSystemLogs } = await load();
  await POST(postJson({ action: "client", message: "x" }));
  await POST(postJson({ action: "clear" }));
  assert.equal(getSystemLogs().length, 0);
});

test("GET: kayıtları ve bot nabız durumunu döndürür", async () => {
  const { POST, GET } = await load();
  const { writeHeartbeat } = await import("../lib/storage/heartbeat");
  await POST(postJson({ action: "client", message: "x" }));
  writeHeartbeat({ pid: 4242 });
  const res = await GET(new Request("http://localhost/api/logs"));
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.logs.length, 1);
  assert.equal(body.bot.alive, true);
  assert.equal(body.bot.pid, 4242);
});

test("GET ?summary=1: kayıt listesi olmadan yalnızca özet ve bot durumu döner", async () => {
  const { POST, GET } = await load();
  await POST(postJson({ action: "client", level: "error", message: "hata" }));
  await POST(postJson({ action: "client", level: "info", message: "bilgi" }));
  const body = await (await GET(new Request("http://localhost/api/logs?summary=1"))).json();
  assert.equal(body.logs, undefined);
  assert.equal(body.summary.total, 2);
  assert.equal(body.summary.errorsLastHour, 1);
  assert.equal(typeof body.bot.alive, "boolean");
});

test("GET: bot hiç nabız yazmadıysa alive=false döner", async () => {
  const { GET } = await load();
  const body = await (await GET(new Request("http://localhost/api/logs"))).json();
  assert.equal(body.bot.alive, false);
  assert.equal(body.bot.lastBeat, null);
});
