// lib/media/processor.ts
// Sharp ile görüntü optimizasyonu ve video doğrulama

import sharp from "sharp";
import fs from "fs";
import path from "path";
import { config } from "@/lib/config";

export class MediaProcessor {
  /**
   * Görüntüyü optimize eder:
   * - Max 1080px (Instagram uyumlu)
   * - JPEG'e dönüştürür
   * - Hedef boyuta ulaşana kadar kaliteyi düşürür
   * - EXIF orientation'ı düzeltir (telefon fotoğrafları için)
   */
  async optimizeImage(inputPath: string): Promise<string> {
    const ext = path.extname(inputPath).toLowerCase();
    if (!config.media.supportedImageFormats.includes(ext as ".jpg")) {
      throw new Error(
        `Desteklenmeyen format: ${ext}. İzin verilenler: ${config.media.supportedImageFormats.join(", ")}`
      );
    }

    const outputPath = inputPath.replace(/\.[^.]+$/, "_opt.jpg");
    const maxDim = config.media.imageMaxDimension;
    let quality = config.media.imageQuality;

    // Instagram en-boy oranı kuralı: 4:5 (0.80) ile 1.91:1 (1.91) arasında olmalıdır
    const imageMeta = await sharp(inputPath).rotate().metadata();
    const rawW = imageMeta.width || 1080;
    const rawH = imageMeta.height || 1080;
    const ratio = rawW / rawH;

    const MIN_RATIO = 0.8;  // 4:5 (Instagram en dikey sınır)
    const MAX_RATIO = 1.91; // 1.91:1 (Instagram en yatay sınır)

    let baseImageBuffer: Buffer;

    if (ratio < MIN_RATIO) {
      // Çok dikey (Örn: 9:16 telefon ekranı) -> Yanlara görselin kendi renk tonunda estetik bulanık dolgu ekle
      const targetW = Math.round(rawH * MIN_RATIO);
      const targetH = rawH;

      const blurredBg = await sharp(inputPath)
        .rotate()
        .resize(targetW, targetH, { fit: "cover" })
        .blur(35)
        .modulate({ brightness: 0.65 })
        .toBuffer();

      const originalBuffer = await sharp(inputPath)
        .rotate()
        .toBuffer();

      baseImageBuffer = await sharp(blurredBg)
        .composite([{ input: originalBuffer, gravity: "center" }])
        .toBuffer();

      console.log(`[MediaProcessor] ✨ Instagram estetik bulanık dolgu uygulandı (${rawW}x${rawH} -> ${targetW}x${targetH})`);
    } else if (ratio > MAX_RATIO) {
      // Çok yatay (Örn: panorama) -> Alt ve üste estetik bulanık dolgu ekle
      const targetW = rawW;
      const targetH = Math.round(rawW / MAX_RATIO);

      const blurredBg = await sharp(inputPath)
        .rotate()
        .resize(targetW, targetH, { fit: "cover" })
        .blur(35)
        .modulate({ brightness: 0.65 })
        .toBuffer();

      const originalBuffer = await sharp(inputPath)
        .rotate()
        .toBuffer();

      baseImageBuffer = await sharp(blurredBg)
        .composite([{ input: originalBuffer, gravity: "center" }])
        .toBuffer();

      console.log(`[MediaProcessor] ✨ Instagram estetik bulanık dolgu uygulandı (${rawW}x${rawH} -> ${targetW}x${targetH})`);
    } else {
      baseImageBuffer = await sharp(inputPath).rotate().toBuffer();
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      await sharp(baseImageBuffer)
        .resize(maxDim, maxDim, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .flatten({ background: { r: 15, g: 23, b: 42 } }) // RGBA → RGB
        .jpeg({ quality, mozjpeg: true })
        .toFile(outputPath);

      const sizeMb = this.getFileSizeMb(outputPath);
      console.log(`[MediaProcessor] Deneme ${attempt + 1}: ${sizeMb.toFixed(2)} MB, kalite: ${quality}`);

      if (sizeMb <= config.media.maxImageMb) break;
      quality -= 10;
    }

    console.log(`[MediaProcessor] ✅ Optimize edildi: ${outputPath}`);
    return outputPath;
  }

  /**
   * Görseli Instagram Story / Reels formatına (9:16 dikey - 1080x1920) dönüştürür.
   * Orijinal görseli merkeze alıp arkasına estetik bulanık arka plan ekler.
   */
  async optimizeForStory(inputPath: string): Promise<string> {
    const outputPath = inputPath.replace(/\.[^.]+$/, "_story.jpg");
    const STORY_W = 1080;
    const STORY_H = 1920;

    const blurredBg = await sharp(inputPath)
      .rotate()
      .resize(STORY_W, STORY_H, { fit: "cover" })
      .blur(45)
      .modulate({ brightness: 0.6 })
      .toBuffer();

    const originalFit = await sharp(inputPath)
      .rotate()
      .resize(STORY_W, STORY_H, { fit: "inside", withoutEnlargement: true })
      .toBuffer();

    await sharp(blurredBg)
      .composite([{ input: originalFit, gravity: "center" }])
      .flatten({ background: { r: 15, g: 23, b: 42 } })
      .jpeg({ quality: 90, mozjpeg: true })
      .toFile(outputPath);

    console.log(`[MediaProcessor] 📱 Story/Reels (9:16) formatı oluşturuldu: ${outputPath}`);
    return outputPath;
  }

  /**
   * Video dosyasının boyut ve format gereksinimlerini kontrol eder.
   */
  validateVideo(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    if (!config.media.supportedVideoFormats.includes(ext as ".mp4")) {
      throw new Error(
        `Desteklenmeyen video formatı: ${ext}. İzin verilenler: ${config.media.supportedVideoFormats.join(", ")}`
      );
    }

    const sizeMb = this.getFileSizeMb(filePath);
    if (sizeMb > config.media.maxVideoMb) {
      throw new Error(
        `Video çok büyük: ${sizeMb.toFixed(1)} MB (maks: ${config.media.maxVideoMb} MB)`
      );
    }

    console.log(`[MediaProcessor] ✅ Video geçerli: ${sizeMb.toFixed(1)} MB`);
    return filePath;
  }

  getFileSizeMb(filePath: string): number {
    const stats = fs.statSync(filePath);
    return stats.size / (1024 * 1024);
  }

  /**
   * Geçici dosyaları temizler.
   */
  cleanup(...paths: (string | undefined)[]): void {
    for (const p of paths) {
      if (p && fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
          console.log(`[MediaProcessor] Silindi: ${p}`);
        } catch (e) {
          console.warn(`[MediaProcessor] Silinemedi: ${p}`, e);
        }
      }
    }
  }
}

export const mediaProcessor = new MediaProcessor();
