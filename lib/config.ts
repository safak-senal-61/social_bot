// lib/config.ts
// Esnek konfigürasyon — eksik platformlar botu çökertmez, sadece devre dışı kalır.

import fs from "fs";
import path from "path";

function readEnv(key: string, defaultValue = ""): string {
  const value = process.env[key] ?? defaultValue;
  if (!value || value.includes("xxxxx") || value.includes("your_cloud_name") || value.includes("...")) {
    return "";
  }
  return value.trim();
}

export function loadEnvFromFile(): Record<string, string> {
  const envPath = path.join(process.cwd(), ".env.local");
  const result: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return result;

  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const k = trimmed.substring(0, eqIdx).trim();
      const v = trimmed.substring(eqIdx + 1).trim();
      result[k] = v;
      process.env[k] = v; // sync to process.env
    }
  }
  return result;
}

export function saveEnvToFile(values: Record<string, string>) {
  const envPath = path.join(process.cwd(), ".env.local");
  let existingContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  const lines = existingContent ? existingContent.split("\n") : [];
  const updatedKeys = new Set<string>();

  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const k = trimmed.substring(0, eqIdx).trim();
      if (k in values) {
        updatedKeys.add(k);
        process.env[k] = values[k];
        return `${k}=${values[k]}`;
      }
    }
    return line;
  });

  // Kalan yeni anahtarları ekle
  for (const [k, v] of Object.entries(values)) {
    if (!updatedKeys.has(k)) {
      newLines.push(`${k}=${v}`);
      process.env[k] = v;
    }
  }

  fs.writeFileSync(envPath, newLines.join("\n"), "utf-8");
}

function makeConfig() {
  return {
    get telegram() {
      const botToken = readEnv("TELEGRAM_BOT_TOKEN");
      const allowed = readEnv("ALLOWED_USER_IDS");
      return {
        botToken,
        isConfigured: !!botToken,
        secretToken: readEnv("TELEGRAM_SECRET_TOKEN", "social_poster_secret"),
        allowedUserIds: allowed
          ? allowed.split(",").map((id) => parseInt(id.trim(), 10)).filter(Boolean)
          : [],
      };
    },
    get facebook() {
      const pageId = readEnv("FB_PAGE_ID");
      const pageAccessToken = readEnv("FB_PAGE_ACCESS_TOKEN");
      const appId = readEnv("FB_APP_ID");
      const appSecret = readEnv("FB_APP_SECRET");
      return {
        appId,
        appSecret,
        pageId,
        pageAccessToken,
        isConfigured: !!(pageId && pageAccessToken),
        apiVersion: "v21.0" as const,
        baseUrl: "https://graph.facebook.com/v21.0",
      };
    },
    get instagram() {
      const userId = readEnv("IG_USER_ID");
      const pageAccessToken = readEnv("FB_PAGE_ACCESS_TOKEN");
      return {
        userId,
        isConfigured: !!(userId && pageAccessToken),
      };
    },
    get linkedin() {
      const accessToken = readEnv("LINKEDIN_ACCESS_TOKEN");
      const organizationId = readEnv("LINKEDIN_ORGANIZATION_ID");
      return {
        accessToken,
        organizationId,
        isConfigured: !!accessToken,
        baseUrl: "https://api.linkedin.com/v2",
      };
    },
    get cloudinary() {
      const cloudName = readEnv("CLOUDINARY_CLOUD_NAME");
      const apiKey = readEnv("CLOUDINARY_API_KEY");
      const apiSecret = readEnv("CLOUDINARY_API_SECRET");
      return {
        cloudName,
        apiKey,
        apiSecret,
        isConfigured: !!(cloudName && apiKey && apiSecret),
      };
    },
    get appUrl() {
      return readEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    },
    get ai() {
      const geminiApiKey = readEnv("GEMINI_API_KEY");
      return {
        geminiApiKey,
        isConfigured: !!geminiApiKey,
      };
    },
    get watermark() {
      const enabled = readEnv("WATERMARK_ENABLED", "true");
      const text = readEnv("WATERMARK_TEXT", "Günübirlik");
      return {
        enabled: enabled !== "false",
        text,
      };
    },
    media: {
      maxImageMb: 8,
      maxVideoMb: 100,
      imageMaxDimension: 1080,
      imageQuality: 85,
      supportedImageFormats: [".jpg", ".jpeg", ".png", ".webp"] as const,
      supportedVideoFormats: [".mp4", ".mov"] as const,
    },
  };
}

export const config = makeConfig();
export type Config = ReturnType<typeof makeConfig>;

