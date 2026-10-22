import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "socialbot-hb-"));
  process.env.SOCIAL_BOT_LOG_DIR = dir;
});

afterEach(() => {
  delete process.env.SOCIAL_BOT_LOG_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

test("yeni yazılmış nabız 'canlı' sayılır", async () => {
  const { writeHeartbeat, readHeartbeat } = await import("../lib/storage/heartbeat");
  writeHeartbeat({ pid: 1 });
  const hb = readHeartbeat();
  assert.equal(hb.alive, true);
  assert.equal(hb.pid, 1);
});

test("eşikten eski nabız 'canlı değil' sayılır", async () => {
  const { writeHeartbeat, readHeartbeat } = await import("../lib/storage/heartbeat");
  writeHeartbeat({ pid: 1 });
  const later = Date.now() + 60_000;
  assert.equal(readHeartbeat(later).alive, false);
});

test("nabız dosyası yoksa lastBeat null döner", async () => {
  const { readHeartbeat } = await import("../lib/storage/heartbeat");
  const hb = readHeartbeat();
  assert.equal(hb.alive, false);
  assert.equal(hb.lastBeat, null);
});

test("bozuk nabız dosyası çökertmez", async () => {
  const { readHeartbeat } = await import("../lib/storage/heartbeat");
  fs.writeFileSync(path.join(dir, "bot_heartbeat.json"), "{bozuk");
  assert.equal(readHeartbeat().alive, false);
});
