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

  /**
   * Facebook Sayfasına sadece metin gönderisi paylaşır.
   * @param message - Gönderi metni
   */
  async postText(message: string): Promise<PublishResult> {
    try {
      console.log("[Facebook] Metin gönderisi paylaşılıyor...");
      const { data } = await axios.post(
        `${this.base}/${this.pageId}/feed`,
        {
          message,
          access_token: this.token,
        },
        { timeout: 30_000 }
      );
      console.log(`[Facebook] ✅ Metin paylaşıldı — id: ${data.id}`);
      return { platform: "facebook", success: true, data };
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * Facebook Sayfasına çoklu görsel (Karusel / Fotoğraf Albümü Gönderisi) paylaşır.
   */
  async postCarousel(imageUrls: string[], caption: string): Promise<PublishResult> {
    try {
      console.log(`[Facebook] Çoklu fotoğraf gönderisi (${imageUrls.length} görsel) hazırlanıyor...`);
      const mediaFbIds: Array<{ media_fbid: string }> = [];

      for (let i = 0; i < imageUrls.length; i++) {
        const url = imageUrls[i];
        console.log(`[Facebook] Fotoğraf ${i + 1}/${imageUrls.length} yükleniyor (unpublished)...`);
        const { data } = await axios.post(
          `${this.base}/${this.pageId}/photos`,
          {
            url,
            published: false,
            access_token: this.token,
          },
          { timeout: 30_000 }
        );
        mediaFbIds.push({ media_fbid: data.id });
      }

      // Şimdi feed'e attached_media olarak hepsini tek seferde bağla
      console.log(`[Facebook] Tüm fotoğraflar tek gönderide yayınlanıyor...`);
      const { data } = await axios.post(
        `${this.base}/${this.pageId}/feed`,
        {
          message: caption,
          attached_media: mediaFbIds,
          access_token: this.token,
        },
        { timeout: 30_000 }
      );

      console.log(`[Facebook] ✅ Çoklu gönderi paylaşıldı — id: ${data.id}`);
      return { platform: "facebook", success: true, data };
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * Sayfanın son gönderilerini getirir (Auto-Reply için).
   */
  async getRecentPosts(limit = 10): Promise<any[]> {
    try {
      const { data } = await axios.get(`${this.base}/${this.pageId}/feed`, {
        params: { fields: "id,message,created_time", limit, access_token: this.token },
        timeout: 15_000,
      });
      return data.data || [];
    } catch (err) {
      console.warn("[Facebook] getRecentPosts hatası:", err);
      return [];
    }
  }

  /**
   * Bir gönderinin altındaki yorumları listeler.
   */
  async getComments(postId: string): Promise<any[]> {
    try {
      const { data } = await axios.get(`${this.base}/${postId}/comments`, {
        params: { fields: "id,message,from,created_time", access_token: this.token },
        timeout: 15_000,
      });
      return data.data || [];
    } catch (err) {
      return [];
    }
  }

  /**
   * Bir Facebook yorumuna doğrudan yanıt yazar (Auto-reply).
   */
  async replyComment(commentId: string, message: string): Promise<PublishResult> {
    try {
      const { data } = await axios.post(
        `${this.base}/${commentId}/comments`,
        { message, access_token: this.token },
        { timeout: 15_000 }
      );
      console.log(`[Facebook] ✅ Yoruma yanıt verildi: comment_id=${commentId}`);
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
