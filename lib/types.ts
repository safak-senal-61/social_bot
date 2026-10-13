// lib/types.ts
// Proje genelinde kullanılan TypeScript tipleri

export interface PublishResult {
  platform: "instagram" | "facebook" | "linkedin";
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface MediaInfo {
  type: "photo" | "video";
  localPath: string;
  publicUrl?: string;
  mimeType?: string;
  fileId: string;
}

export interface PostPayload {
  media: MediaInfo;
  caption: string;
  userId: number;
}

export interface TelegramFileResponse {
  ok: boolean;
  result: {
    file_id: string;
    file_path: string;
  };
}
