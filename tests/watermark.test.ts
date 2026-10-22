import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { applyWatermark, getWatermarkBadgeSvg } from "../lib/media/watermark";

let tempDir: string;
let sampleImagePath: string;

beforeEach(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wm-test-"));
  sampleImagePath = path.join(tempDir, "sample.jpg");
  // 800x800 test görseli oluştur
  await sharp({
    create: {
      width: 800,
      height: 800,
      channels: 3,
      background: { r: 50, g: 100, b: 150 },
    },
  })
    .jpeg()
    .toFile(sampleImagePath);
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("getWatermarkBadgeSvg: şık font ve iş platformu tipografisi içerir", () => {
  const svg = getWatermarkBadgeSvg(260, 56, "Günübirlik");
  assert.ok(svg.includes("Günübirlik") || svg.includes("GÜNÜBİRLİK"));
  assert.ok(svg.includes("font-family"), "tipografi tanımı içermeli");
  assert.ok(svg.includes("letter-spacing"), "şık harf aralığı içermeli");
});

test("applyWatermark: görselin üzerine filigran basar ve çıktı dosyasını üretir", async () => {
  const outputPath = await applyWatermark(sampleImagePath, "Günübirlik");
  assert.ok(fs.existsSync(outputPath), "Çıktı görseli oluşmalı");
  const meta = await sharp(outputPath).metadata();
  assert.equal(meta.width, 800);
  assert.equal(meta.height, 800);
});

test("applyWatermark: özel logo varsa özel logoyu rozet ile composite eder", async () => {
  // Geçici logo dosyası oluştur
  const tempLogoPath = path.join(tempDir, "test_logo.png");
  await sharp({
    create: {
      width: 200,
      height: 100,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toFile(tempLogoPath);

  // CUSTOM_LOGO_PATH varlığını taklit edelim
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  const actualCustomLogo = path.join(uploadsDir, "custom_logo.png");
  const hadOldLogo = fs.existsSync(actualCustomLogo);
  const backupPath = path.join(uploadsDir, "custom_logo.png.bak");

  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (hadOldLogo) fs.renameSync(actualCustomLogo, backupPath);

  try {
    fs.copyFileSync(tempLogoPath, actualCustomLogo);
    const outputPath = await applyWatermark(sampleImagePath, "Günübirlik");
    assert.ok(fs.existsSync(outputPath));
    const meta = await sharp(outputPath).metadata();
    assert.equal(meta.width, 800);
  } finally {
    if (fs.existsSync(actualCustomLogo)) fs.unlinkSync(actualCustomLogo);
    if (hadOldLogo && fs.existsSync(backupPath)) fs.renameSync(backupPath, actualCustomLogo);
  }
});
