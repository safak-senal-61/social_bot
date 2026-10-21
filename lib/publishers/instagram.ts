// lib/publishers/instagram.ts
// Instagram Graph API yayıncısı (2 adımlı: container → yayınla)

import axios, { AxiosError } from "axios";
import { config } from "@/lib/config";
import type { PublishResult } from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class InstagramPublisher {
  private get base()  { return config.facebook.baseUrl; } // IG, FB endpoint'leri kullanır
  private get igId()  { return config.instagram.userId; }
  private get token() { return config.facebook.pageAccessToken; }

  private readonly POLL_INTERVAL_MS = 5_000;
  private readonly POLL_MAX = 20;

  // ── Public metodlar ─────────────────────────────────────────────────────────

  async postPhoto(imageUrl: string, caption: string): Promise<PublishResult> {
    try {
      console.log("[Instagram] Fotoğraf paylaşımı başlatılıyor...");
      const containerId = await this.createImageContainer(imageUrl, caption);
      await sleep(3_000);
      const result = await this.publish(containerId);
      return { platform: "instagram", success: true, data: result };
    } catch (err) {
      return this.handleError(err);
    }
  }

  async postVideo(videoUrl: string, caption: string): Promise<PublishResult> {
    try {
      console.log("[Instagram] Video (Reels) paylaşımı başlatılıyor...");
      const containerId = await this.createVideoContainer(videoUrl, caption);
      await this.pollContainer(containerId);
      const result = await this.publish(containerId);
      return { platform: "instagram", success: true, data: result };
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * Instagram Story (Hikaye) paylaşımı yapar.
   * 9:16 dikey formatındaki görselleri veya videoları 24 saatlik hikaye olarak yayınlar.
   */
  async postStory(mediaUrl: string, isVideo = false): Promise<PublishResult> {
    try {
      console.log(`[Instagram] Story (${isVideo ? "Video" : "Görsel"}) paylaşılıyor...`);
      const payload: Record<string, any> = {
        media_type: "STORIES",
        access_token: this.token,
      };

      if (isVideo) {
        payload.video_url = mediaUrl;
      } else {
        payload.image_url = mediaUrl;
      }

      const { data } = await axios.post(`${this.base}/${this.igId}/media`, payload, { timeout: 30_000 });
      const containerId = data.id as string;
      console.log(`[Instagram] Story container oluşturuldu: ${containerId}`);

      if (isVideo) {
        await this.pollContainer(containerId);
      } else {
        await sleep(3_000);
      }

      const result = await this.publish(containerId);
      console.log(`[Instagram] ✅ Story başarıyla yayınlandı!`);
      return { platform: "instagram", success: true, data: result };
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * Çoklu fotoğraf (Carousel / Kaydırmalı Galeri) paylaşımı yapar.
   * 2 ila 10 adet fotoğrafı tek bir gönderide birleştirir.
   */
  async postCarousel(imageUrls: string[], caption: string): Promise<PublishResult> {
    try {
      console.log(`[Instagram] Karusel (${imageUrls.length} görsel) hazırlanıyor...`);

      // 1. Her bir görsel için is_carousel_item container'ı oluştur
      const itemIds: string[] = [];
      for (let i = 0; i < imageUrls.length; i++) {
        const url = imageUrls[i];
        console.log(`[Instagram] Karusel öğesi ${i + 1}/${imageUrls.length} yükleniyor...`);
        const { data } = await axios.post(
          `${this.base}/${this.igId}/media`,
          {
            image_url: url,
            is_carousel_item: true,
            access_token: this.token,
          },
          { timeout: 30_000 }
        );
        itemIds.push(data.id);
        await sleep(1_000);
      }

      // 2. Ana Karusel Container'ını oluştur
      console.log(`[Instagram] Ana Karusel container'ı bağlanıyor: ${itemIds.join(",")}`);
      const { data: parentData } = await axios.post(
        `${this.base}/${this.igId}/media`,
        {
          media_type: "CAROUSEL",
          caption,
          children: itemIds.join(","),
          access_token: this.token,
        },
        { timeout: 30_000 }
      );

      const parentContainerId = parentData.id;
      await sleep(4_000);

      // 3. Karuseli yayınla
      const result = await this.publish(parentContainerId);
      console.log(`[Instagram] ✅ Karusel başarıyla yayınlandı!`);
      return { platform: "instagram", success: true, data: result };
    } catch (err) {
      return this.handleError(err);
    }
  }

  /**
   * Son paylaşılan medyaları getirir (Auto-Reply için).
   */
  async getRecentMedia(limit = 10): Promise<any[]> {
    try {
      const { data } = await axios.get(`${this.base}/${this.igId}/media`, {
        params: { fields: "id,caption,media_type,timestamp,permalink", limit, access_token: this.token },
        timeout: 15_000,
      });
      return data.data || [];
    } catch (err) {
      console.warn("[Instagram] getRecentMedia hatası:", err);
      return [];
    }
  }

  /**
   * Bir medyanın altındaki yorumları listeler.
   */
  async getComments(mediaId: string): Promise<any[]> {
    try {
      const { data } = await axios.get(`${this.base}/${mediaId}/comments`, {
        params: { fields: "id,text,from,timestamp", access_token: this.token },
        timeout: 15_000,
      });
      return data.data || [];
    } catch (err) {
      return [];
    }
  }

  /**
   * Bir Instagram yorumuna doğrudan yanıt yazar (Auto-reply).
   */
  async replyComment(commentId: string, message: string): Promise<PublishResult> {
    try {
      const { data } = await axios.post(
        `${this.base}/${commentId}/replies`,
        { message, access_token: this.token },
        { timeout: 15_000 }
      );
      console.log(`[Instagram] ✅ Yoruma yanıt verildi: comment_id=${commentId}`);
      return { platform: "instagram", success: true, data };
    } catch (err) {
      return this.handleError(err);
    }
  }

  // ── Container oluşturma ──────────────────────────────────────────────────────

  private async createImageContainer(imageUrl: string, caption: string): Promise<string> {
    const { data } = await axios.post(
      `${this.base}/${this.igId}/media`,
      { image_url: imageUrl, caption, access_token: this.token },
      { timeout: 30_000 }
    );
    console.log(`[Instagram] Container oluşturuldu: ${data.id}`);
    return data.id as string;
  }

  private async createVideoContainer(videoUrl: string, caption: string): Promise<string> {
    const { data } = await axios.post(
      `${this.base}/${this.igId}/media`,
      {
        video_url: videoUrl,
        caption,
        media_type: "REELS",
        share_to_feed: "true",
        access_token: this.token,
      },
      { timeout: 30_000 }
    );
    console.log(`[Instagram] Video container oluşturuldu: ${data.id}`);
    return data.id as string;
  }

  // ── Durum bekleme (polling) ─────────────────────────────────────────────────

  private async pollContainer(containerId: string): Promise<void> {
    for (let i = 1; i <= this.POLL_MAX; i++) {
      await sleep(this.POLL_INTERVAL_MS);
      const { data } = await axios.get(`${this.base}/${containerId}`, {
        params: { fields: "status_code,status", access_token: this.token },
        timeout: 15_000,
      });

      const status: string = data.status_code ?? "UNKNOWN";
      console.log(`[Instagram] Container durumu (${i}/${this.POLL_MAX}): ${status}`);

      if (status === "FINISHED") return;
      if (status === "ERROR") {
        throw new Error(`Instagram container işleme hatası: ${JSON.stringify(data)}`);
      }
    }
    throw new Error(
      `Instagram container ${(this.POLL_MAX * this.POLL_INTERVAL_MS) / 1000} saniyede hazır olmadı`
    );
  }

  // ── Yayınlama ────────────────────────────────────────────────────────────────

  private async publish(containerId: string): Promise<Record<string, unknown>> {
    const { data } = await axios.post(
      `${this.base}/${this.igId}/media_publish`,
      { creation_id: containerId, access_token: this.token },
      { timeout: 30_000 }
    );
    console.log(`[Instagram] ✅ Yayınlandı — media_id: ${data.id}`);
    return data as Record<string, unknown>;
  }

  // ── Hata yönetimi ────────────────────────────────────────────────────────────

  private handleError(err: unknown): PublishResult {
    const message =
      err instanceof AxiosError
        ? `HTTP ${err.response?.status}: ${JSON.stringify(err.response?.data)}`
        : String(err);
    console.error(`[Instagram] ❌ Hata: ${message}`);
    return { platform: "instagram", success: false, error: message };
  }
}

export const instagramPublisher = new InstagramPublisher();
