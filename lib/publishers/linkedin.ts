// lib/publishers/linkedin.ts
// LinkedIn REST API yayıncısı (UGC Posts)

import axios, { AxiosError } from "axios";
import fs from "fs";
import { config } from "@/lib/config";
import type { PublishResult } from "@/lib/types";

export class LinkedInPublisher {
  private get base()  { return config.linkedin.baseUrl; }
  private get token() { return config.linkedin.accessToken; }

  private get headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    };
  }

  // ── Public metodlar ─────────────────────────────────────────────────────────

  async postPhoto(imagePath: string, caption: string): Promise<PublishResult> {
    try {
      console.log("[LinkedIn] Fotoğraf paylaşımı başlatılıyor...");
      const personUrn = await this.getPersonUrn();
      const { uploadUrl, assetUrn } = await this.registerImageUpload(personUrn);
      await this.uploadBinary(uploadUrl, imagePath);
      const result = await this.createPost(personUrn, caption, assetUrn);
      return { platform: "linkedin", success: true, data: result };
    } catch (err) {
      return this.handleError(err);
    }
  }

  async postText(caption: string): Promise<PublishResult> {
    try {
      console.log("[LinkedIn] Metin paylaşımı başlatılıyor...");
      const personUrn = await this.getPersonUrn();
      const result = await this.createPost(personUrn, caption);
      return { platform: "linkedin", success: true, data: result };
    } catch (err) {
      return this.handleError(err);
    }
  }

  // ── İç metodlar ─────────────────────────────────────────────────────────────

  /**
   * OpenID Connect userinfo endpoint'inden kullanıcı URN'ini alır.
   * Örnek: urn:li:person:AbCdEfGhIj
   */
  private async getPersonUrn(): Promise<string> {
    const { data } = await axios.get(`${this.base}/userinfo`, {
      headers: { Authorization: `Bearer ${this.token}` },
      timeout: 15_000,
    });
    if (!data.sub) throw new Error("LinkedIn userinfo'dan 'sub' alınamadı");
    const urn = `urn:li:person:${data.sub}`;
    console.log(`[LinkedIn] Kişi URN: ${urn}`);
    return urn;
  }

  /**
   * LinkedIn'e resim yükleme oturumu başlatır.
   * @returns upload URL ve asset URN ikilisi
   */
  private async registerImageUpload(
    personUrn: string
  ): Promise<{ uploadUrl: string; assetUrn: string }> {
    const { data } = await axios.post(
      `${this.base}/assets?action=registerUpload`,
      {
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: personUrn,
          serviceRelationships: [
            {
              relationshipType: "OWNER",
              identifier: "urn:li:userGeneratedContent",
            },
          ],
        },
      },
      { headers: this.headers, timeout: 15_000 }
    );

    const uploadUrl: string =
      data.value.uploadMechanism[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ].uploadUrl;
    const assetUrn: string = data.value.asset;
    console.log(`[LinkedIn] Asset URN: ${assetUrn}`);
    return { uploadUrl, assetUrn };
  }

  /**
   * Medya dosyasını binary olarak yükler.
   */
  private async uploadBinary(uploadUrl: string, filePath: string): Promise<void> {
    const fileBuffer = fs.readFileSync(filePath);
    await axios.put(uploadUrl, fileBuffer, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/octet-stream",
      },
      timeout: 90_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    console.log(`[LinkedIn] Dosya yüklendi: ${filePath}`);
  }

  /**
   * UGC gönderi oluşturur.
   */
  private async createPost(
    personUrn: string,
    text: string,
    assetUrn?: string
  ): Promise<Record<string, unknown>> {
    const media = assetUrn
      ? [
          {
            status: "READY",
            description: { text: text.slice(0, 200) },
            media: assetUrn,
            title: { text: "Paylaşım" },
          },
        ]
      : [];

    const { data } = await axios.post(
      `${this.base}/ugcPosts`,
      {
        author: personUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text },
            shareMediaCategory: assetUrn ? "IMAGE" : "NONE",
            media,
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      },
      { headers: this.headers, timeout: 30_000 }
    );

    console.log(`[LinkedIn] ✅ Yayınlandı — id: ${data.id}`);
    return data as Record<string, unknown>;
  }

  // ── Hata yönetimi ────────────────────────────────────────────────────────────

  private handleError(err: unknown): PublishResult {
    const message =
      err instanceof AxiosError
        ? `HTTP ${err.response?.status}: ${JSON.stringify(err.response?.data)}`
        : String(err);
    console.error(`[LinkedIn] ❌ Hata: ${message}`);
    return { platform: "linkedin", success: false, error: message };
  }
}

export const linkedInPublisher = new LinkedInPublisher();
