// lib/scheduler/worker.ts
import { getScheduledQueue, removeScheduledItem, addHistory, type PostRecord } from "@/lib/storage/db";
import { config } from "@/lib/config";
import { facebookPublisher } from "@/lib/publishers/facebook";
import { instagramPublisher } from "@/lib/publishers/instagram";
import { linkedInPublisher } from "@/lib/publishers/linkedin";
import { cloudinaryUploader } from "@/lib/uploader/cloudinary";
import { mediaProcessor } from "@/lib/media/processor";
import { getBot } from "@/lib/telegram/bot";
import type { PublishResult } from "@/lib/types";

import { autoReplyEngine } from "@/lib/autoreply/engine";

let isWorkerRunning = false;
let workerTimer: NodeJS.Timeout | null = null;
let tickCount = 0;

export function startSchedulerWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  console.log("⏰ [Scheduler] Zamanlayıcı servisi başlatıldı (30 saniyede bir kuyruk taranıyor)...");

  // İlk tarama ve periyodik kontrol
  checkQueue();
  workerTimer = setInterval(checkQueue, 30_000);
}

export function stopSchedulerWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
  isWorkerRunning = false;
  console.log("⏰ [Scheduler] Zamanlayıcı servisi durduruldu.");
}

async function checkQueue() {
  const queue = getScheduledQueue();
  const now = Date.now();

  for (const item of queue) {
    if (item.scheduledAt <= now) {
      console.log(`⏰ [Scheduler] Zamanı geldi! İşleniyor: ${item.id} (Kullanıcı: ${item.userId})`);
      removeScheduledItem(item.id);
      await executeScheduledPost(item);
    }
  }

  // Her 4 döngüde bir (~2 dakikada bir) yorumları tara ve otomatik yanıt ver
  tickCount++;
  if (tickCount % 4 === 0) {
    try {
      await autoReplyEngine.checkAndReplyRecentComments();
    } catch (e) {
      console.warn("[AutoReply] Periyodik kontrol hatası:", e);
    }
  }
}

async function executeScheduledPost(item: {
  id: string;
  userId: number;
  localPath: string;
  albumPaths?: string[];
  caption: string;
  applyWatermark: boolean;
  targetType?: "feed" | "story";
  scheduledAt: number;
  createdAt: string;
}) {
  const bot = getBot();
  let publicUrl = "";
  const publicUrls: string[] = [];

  try {
    // 1. Çoklu fotoğraf (Carousel) durumu
    if (item.albumPaths && item.albumPaths.length > 0) {
      for (const p of item.albumPaths) {
        if (config.cloudinary.isConfigured) {
          const u = await cloudinaryUploader.uploadImage(p);
          publicUrls.push(u);
        }
      }
      publicUrl = publicUrls[0] || "";
    } else if (config.cloudinary.isConfigured) {
      publicUrl = await cloudinaryUploader.uploadImage(item.localPath);
    }

    const publishTasks: Promise<PublishResult>[] = [];

    // Facebook
    if (config.facebook.isConfigured) {
      if (publicUrls.length > 1) {
        publishTasks.push(facebookPublisher.postCarousel(publicUrls, item.caption));
      } else {
        const source = publicUrl || item.localPath;
        publishTasks.push(facebookPublisher.postPhoto(source, item.caption));
      }
    }

    // Instagram
    if (config.instagram.isConfigured) {
      if (item.targetType === "story") {
        if (publicUrl) {
          publishTasks.push(instagramPublisher.postStory(publicUrl, false));
        } else {
          publishTasks.push(Promise.resolve({ platform: "instagram", success: false, error: "Cloudinary URL gerekli" }));
        }
      } else if (publicUrls.length > 1) {
        publishTasks.push(instagramPublisher.postCarousel(publicUrls, item.caption));
      } else if (publicUrl) {
        publishTasks.push(instagramPublisher.postPhoto(publicUrl, item.caption));
      } else {
        publishTasks.push(Promise.resolve({ platform: "instagram", success: false, error: "Cloudinary CDN gereklidir." }));
      }
    }

    // LinkedIn
    if (config.linkedin.isConfigured && item.targetType !== "story") {
      publishTasks.push(linkedInPublisher.postPhoto(item.localPath, item.caption));
    }

    const results = await Promise.all(publishTasks);

    const historyRecord: PostRecord = {
      id: item.id,
      createdAt: new Date().toISOString(),
      caption: item.caption,
      mediaType: publicUrls.length > 1 ? "carousel" : "photo",
      targetType: item.targetType || "feed",
      mediaUrl: publicUrl,
      albumUrls: publicUrls.length > 1 ? publicUrls : undefined,
      status: results.some((r) => r.success) ? "published" : "failed",
      platforms: {},
    };

    let summaryText = item.targetType === "story"
      ? "📱 *[Zamanlanmış Instagram Story Paylaşıldı]*\n\n"
      : publicUrls.length > 1
      ? "🖼️ *[Zamanlanmış Karusel Galeri Paylaşıldı]*\n\n"
      : "⏰ *[Zamanlanmış Gönderi Paylaşıldı]*\n\n";

    for (const r of results) {
      const icon = r.success ? "✅" : "❌";
      summaryText += `${icon} *${r.platform.toUpperCase()}:* ${r.success ? "Başarılı" : r.error || "Hata"}\n`;

      if (r.platform === "facebook") historyRecord.platforms.facebook = { success: r.success, error: r.error };
      if (r.platform === "instagram") historyRecord.platforms.instagram = { success: r.success, error: r.error };
      if (r.platform === "linkedin") historyRecord.platforms.linkedin = { success: r.success, error: r.error };
    }

    addHistory(historyRecord);

    // Kullanıcıya bildirim gönder
    try {
      await bot.telegram.sendMessage(item.userId, summaryText, { parse_mode: "Markdown" });
    } catch (e) {
      console.warn("[Scheduler] Telegram bildirimi gönderilemedi:", e);
    }
  } catch (err) {
    console.error("[Scheduler] Paylaşım hatası:", err);
  } finally {
    mediaProcessor.cleanup(item.localPath);
  }
}
