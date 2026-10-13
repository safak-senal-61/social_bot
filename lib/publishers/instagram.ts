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
