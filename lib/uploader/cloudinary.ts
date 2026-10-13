// lib/uploader/cloudinary.ts
// Cloudinary ile medya barındırma ve public URL üretme

import { v2 as cloudinary } from "cloudinary";
import { config } from "@/lib/config";

// SDK yapılandırması
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

export class CloudinaryUploader {
  private readonly folder = "telegram_posts";

  /**
   * Görüntüyü Cloudinary'e yükler.
   * @returns Public HTTPS URL
   */
  async uploadImage(filePath: string): Promise<string> {
    console.log(`[Cloudinary] Resim yükleniyor: ${filePath}`);
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: "image",
      folder: this.folder,
      overwrite: true,
      invalidate: true,
    });
    console.log(`[Cloudinary] ✅ Resim yüklendi: ${result.secure_url}`);
    return result.secure_url;
  }

  /**
   * Videoyu Cloudinary'e chunk'lar halinde yükler.
   * @returns Public HTTPS URL
   */
  async uploadVideo(filePath: string): Promise<string> {
    console.log(`[Cloudinary] Video yükleniyor: ${filePath}`);
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: "video",
      folder: this.folder,
      overwrite: true,
      invalidate: true,
      chunk_size: 6_000_000, // 6 MB chunk — büyük videolar için
    });
    console.log(`[Cloudinary] ✅ Video yüklendi: ${result.secure_url}`);
    return result.secure_url;
  }
}

export const cloudinaryUploader = new CloudinaryUploader();
