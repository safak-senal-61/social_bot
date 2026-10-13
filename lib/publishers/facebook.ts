// lib/publishers/facebook.ts
// Facebook Graph API yayıncısı

import axios, { AxiosError } from "axios";
import FormData from "form-data";
import fs from "fs";
import { config } from "@/lib/config";
import type { PublishResult } from "@/lib/types";

export class FacebookPublisher {
  private get base()   { return config.facebook.baseUrl; }
  private get pageId() { return config.facebook.pageId; }
  private get token()  { return config.facebook.pageAccessToken; }

  /**
   * Facebook Sayfasına fotoğraf paylaşır.
   * @param imageSource - Cloudinary URL veya doğrudan yerel dosya yolu
   * @param caption     - Gönderi metni
   */
  async postPhoto(imageSource: string, caption: string): Promise<PublishResult> {
    try {
      console.log("[Facebook] Fotoğraf paylaşılıyor...");
      
      // Eğer yerel bir dosya yolu ise doğrudan multipart/form-data ile yükle
      if (fs.existsSync(imageSource)) {
        const form = new FormData();
        form.append("source", fs.createReadStream(imageSource));
        form.append("message", caption);
        form.append("access_token", this.token);

        const { data } = await axios.post(
          `${this.base}/${this.pageId}/photos`,
          form,
          {
            headers: form.getHeaders(),
            timeout: 60_000,
          }
        );
        console.log(`[Facebook] ✅ Fotoğraf yüklendi (dosyadan) — post_id: ${data.post_id || data.id}`);
        return { platform: "facebook", success: true, data };
      }

      // Değilse URL ile yükle
      const { data } = await axios.post(
        `${this.base}/${this.pageId}/photos`,
        {
          url: imageSource,
          message: caption,
          access_token: this.token,
        },
        { timeout: 30_000 }
      );
      console.log(`[Facebook] ✅ Fotoğraf paylaşıldı (URL) — post_id: ${data.post_id || data.id}`);
      return { platform: "facebook", success: true, data };
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * Facebook Sayfasına video yükler.
   * @param videoPath - Yerel video dosyası yolu
   * @param caption   - Video açıklaması
   */
  async postVideo(videoPath: string, caption: string): Promise<PublishResult> {
    try {
      console.log(`[Facebook] Video yükleniyor: ${videoPath}`);
      const form = new FormData();
      form.append("source", fs.createReadStream(videoPath));
      form.append("description", caption);
      form.append("access_token", this.token);

      const { data } = await axios.post(
        `${this.base}/${this.pageId}/videos`,
        form,
        {
          headers: form.getHeaders(),
          timeout: 180_000,
        }
      );
      console.log(`[Facebook] ✅ Video yüklendi — id: ${data.id}`);
      return { platform: "facebook", success: true, data };
    } catch (err) {
      return this.handleError(err);
    }
  }

  private handleError(err: unknown): PublishResult {
    const message =
      err instanceof AxiosError
        ? `HTTP ${err.response?.status}: ${JSON.stringify(err.response?.data)}`
        : String(err);
    console.error(`[Facebook] ❌ Hata: ${message}`);
    return { platform: "facebook", success: false, error: message };
  }
}

export const facebookPublisher = new FacebookPublisher();
