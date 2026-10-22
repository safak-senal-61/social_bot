import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "socialbot-api-"));
  process.env.SOCIAL_BOT_LOG_DIR = dir;
});

afterEach(() => {
  delete process.env.SOCIAL_BOT_LOG_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

const post = (url = "http://localhost/api/demo") => new Request(url, { method: "POST" });
const get = (url = "http://localhost/api/demo") => new Request(url, { method: "GET" });

async function load() {
  const { withApiLog } = await import("../lib/api/with_log");
  const { getSystemLogs } = await import("../lib/storage/logger");
  return { withApiLog, getSystemLogs };
}

test("başarılı POST isteği süreyle birlikte info olarak kaydedilir", async () => {
  const { withApiLog, getSystemLogs } = await load();
  const handler = withApiLog("demo", async () => Response.json({ ok: true }));
  const res = await handler(post());
  assert.equal(res.status, 200);
  const [log] = getSystemLogs();
  assert.equal(log.level, "info");
  assert.equal(log.source, "api");
  assert.match(log.message, /POST \/api\/demo.*200/);
  assert.equal(typeof log.durationMs, "number");
});

test("başarılı GET isteği log akışını doldurmaz", async () => {
  const { withApiLog, getSystemLogs } = await load();
  const handler = withApiLog("demo", async () => Response.json({ ok: true }));
  await handler(get());
  assert.equal(getSystemLogs().length, 0);
});

test("4xx yanıt uyarı (warn) olarak kaydedilir", async () => {
  const { withApiLog, getSystemLogs } = await load();
  const handler = withApiLog("demo", async () => Response.json({ error: "eksik" }, { status: 400 }));
  await handler(get());
  assert.equal(getSystemLogs()[0].level, "warn");
});

test("5xx yanıt hata (error) olarak kaydedilir", async () => {
  const { withApiLog, getSystemLogs } = await load();
  const handler = withApiLog("demo", async () => Response.json({ error: "patladı" }, { status: 502 }));
  await handler(post());
  assert.equal(getSystemLogs()[0].level, "error");
});

test("fırlatılan hata yakalanır, stack ile loglanır ve 500 JSON döner", async () => {
  const { withApiLog, getSystemLogs } = await load();
  const handler = withApiLog("demo", async () => {
    throw new Error("veritabanı yok");
  });
  const res = await handler(post());
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.error, /veritabanı yok/);
  const [log] = getSystemLogs();
  assert.equal(log.level, "error");
  assert.match(log.stack ?? "", /veritabanı yok/);
});

test("istek gövdesi (token/parola içerebilir) loga yazılmaz", async () => {
  const { withApiLog, getSystemLogs } = await load();
  const handler = withApiLog("demo", async () => Response.json({ ok: true }));
  const req = new Request("http://localhost/api/demo?token=SIR", {
    method: "POST",
    body: JSON.stringify({ fbPageAccessToken: "GIZLI-TOKEN" }),
  });
  await handler(req);
  const [log] = getSystemLogs();
  assert.ok(!JSON.stringify(log).includes("GIZLI-TOKEN"));
  assert.ok(!JSON.stringify(log).includes("SIR"), "sorgu parametreleri de loglanmamalı");
});
