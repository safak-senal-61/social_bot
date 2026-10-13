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

    for (let attempt = 0; attempt < 5; attempt++) {
      await sharp(inputPath)
        .rotate() // EXIF orientation otomatik düzeltme
        .resize(maxDim, maxDim, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .flatten({ background: { r: 255, g: 255, b: 255 } }) // RGBA → RGB
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
