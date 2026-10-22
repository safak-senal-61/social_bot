import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HELPER = path.join(__dirname, "helpers", "spam-logger.ts");

function runProcess(cwd: string, tag: string, count: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tsxCli = require.resolve("tsx/cli");
    const child = spawn(process.execPath, [tsxCli, HELPER, tag, String(count)], {
      cwd,
      stdio: "inherit",
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${tag} çıkış kodu ${code}`))));
    child.on("error", reject);
  });
}

test("bot ve web süreçleri aynı anda yazınca hiçbir log kaybolmaz", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "socialbot-logs-"));
  const PROCESSES = 6;
  const PER_PROCESS = 25;

  await Promise.all(
    Array.from({ length: PROCESSES }, (_, i) => runProcess(dir, `p${i}`, PER_PROCESS))
  );

  // Logger'ı bu cwd ile yükle (modül sabitleri cwd'ye bağlı olabilir)
  const prev = process.cwd();
  process.chdir(dir);
  try {
    delete require.cache[require.resolve("../lib/storage/logger")];
    const { getSystemLogs } = await import("../lib/storage/logger");
    const logs = getSystemLogs();
    assert.equal(logs.length, PROCESSES * PER_PROCESS, "yazılan her olay okunabilmeli");
    const unique = new Set(logs.map((l) => l.message));
    assert.equal(unique.size, PROCESSES * PER_PROCESS, "yinelenen/eksik kayıt olmamalı");
  } finally {
    process.chdir(prev);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
