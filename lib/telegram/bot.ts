// lib/telegram/bot.ts
// Telegraf bot — Gelişmiş Sosyal Medya Asistanı
// Özellikler: Ücretsiz AI Görsel & Metin Üretici, Instagram Story/Reel, Carousel (Albüm),
// Akıllı Paylaşım Saati (Smart Time), Çok Dilli (Multi-Language) ve Otomatik Yorum Yanıtlama.

import { Telegraf, Context } from "telegraf";
import { Message } from "telegraf/types";
import fs from "fs";
import path from "path";
import os from "os";
import axios from "axios";
import { config } from "@/lib/config";
import { mediaProcessor } from "@/lib/media/processor";
import { cloudinaryUploader } from "@/lib/uploader/cloudinary";
import { facebookPublisher } from "@/lib/publishers/facebook";
import { instagramPublisher } from "@/lib/publishers/instagram";
import { linkedInPublisher } from "@/lib/publishers/linkedin";
import { generateCaptionFromImage } from "@/lib/ai/caption";
import { freeAiGenerator } from "@/lib/ai/image_generator";
import { getNextSmartTime } from "@/lib/smart_time/scheduler";
import { applyWatermark } from "@/lib/media/watermark";
import { addHistory, addScheduledItem, type PostRecord } from "@/lib/storage/db";
import { logEvent } from "@/lib/storage/logger";
import type { PublishResult } from "@/lib/types";

let _bot: Telegraf | null = null;

export function resetBot(): void {
  _bot = null;
}

export interface PendingDraft {
  id: string;
  userId: number;
  localPath: string;
  albumPaths?: string[]; // Çoklu fotoğraf (Carousel) için
  caption: string;
  originalCaption?: string;
  hasTranslation?: boolean;
  applyWatermark: boolean;
  targetType?: "feed" | "story";
  isAiGenerated?: boolean;
  prompt?: string;
  createdAt: number;
}

const pendingDrafts = new Map<string, PendingDraft>();

// Kullanıcı /ai deyip prompt beklediğimiz durumlar
const userAiWaitState = new Map<number, { format: "feed" | "story" }>();

// Çoklu fotoğraf (Album/Carousel) tamponu
interface AlbumBuffer {
  userId: number;
  items: Array<{ fileId: string; caption?: string }>;
  timer: NodeJS.Timeout;
}
const albumBuffers = new Map<string, AlbumBuffer>();

// 1 saatten eski draftları temizle
setInterval(() => {
  const now = Date.now();
  for (const [id, draft] of pendingDrafts.entries()) {
    if (now - draft.createdAt > 3600_000) {
      mediaProcessor.cleanup(draft.localPath, ...(draft.albumPaths || []));
      pendingDrafts.delete(id);
    }
  }
}, 300_000);

export function getBot(): Telegraf {
  if (_bot) return _bot;

  if (!config.telegram.botToken) {
    throw new Error("Telegram Bot Token girilmemiş. Lütfen ayarlardan token'ı kaydedin.");
  }

  _bot = new Telegraf(config.telegram.botToken);

  // ── Yetki kontrolü middleware ───────────────────────────────────────────────
  _bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    const allowed = config.telegram.allowedUserIds;
    if (allowed.length > 0 && userId && !allowed.includes(userId)) {
      await ctx.reply("⛔ Bu botu kullanma yetkiniz yok.");
      return;
    }
    return next();
  });

  // ── /start ──────────────────────────────────────────────────────────────────
  _bot.start(async (ctx) => {
    userAiWaitState.delete(ctx.from.id);

    const activePlatforms = [];
    if (config.facebook.isConfigured) activePlatforms.push("👍 Facebook (Günübirlik)");
    if (config.instagram.isConfigured) activePlatforms.push(`📷 Instagram (@${config.instagram.userId ? "websachat" : "Bağlı"})`);
    if (config.linkedin.isConfigured) activePlatforms.push("💼 LinkedIn");

    const statusText = activePlatforms.length > 0
      ? `*Aktif Platformlar:*\n${activePlatforms.join("\n")}`
      : "⚠️ Henüz hiçbir sosyal medya hesabı bağlanmamış.";

    const inlineKeyboard: any[][] = [
      [
        { text: "🎨 Ücretsiz AI Görsel & Post Üret", callback_data: "cmd_ai_prompt" },
        { text: "📱 AI ile Instagram Hikayesi Üret", callback_data: "cmd_ai_story" },
      ],
      [
        { text: "🔍 Durumu Kontrol Et", callback_data: "check_status" },
        { text: "📖 Özellikler Rehberi", callback_data: "show_help" },
      ],
    ];

    if (config.facebook.pageId) {
      inlineKeyboard.unshift([
        { text: "👍 Facebook Sayfama Git", url: `https://facebook.com/${config.facebook.pageId}` },
      ]);
    }

    await ctx.reply(
      "👋 *Günübirlik Akıllı Sosyal Medya Asistanına Hoş Geldiniz!*\n\n" +
        "🚀 *Neler Yapabilirsiniz?*\n" +
        "1️⃣ *Fotoğraf / Video Gönderin:* AI otomatik başlık yazar, Akıllı Saate zamanlayabilir veya hemen paylaşabilirsiniz.\n" +
        "2️⃣ *Çoklu Fotoğraf (Albüm):* 2-10 fotoğraf attığınızda Instagram ve Facebook'ta kaydırmalı karusel galeri paylaşır.\n" +
        "3️⃣ *Instagram Story:* Fotoğrafı tek tıkla 9:16 dikey hikaye olarak yayınlar.\n" +
        "4️⃣ *🎨 Tamamen Ücretsiz AI Üretici:* İstediğiniz konuda fotogerçekçi görsel, başlık ve popüler etiketler çizer (`/ai <konu>`).\n" +
        "5️⃣ *🌐 Çeviri Desteği:* Gönderilere tek tıkla İngilizce çeviri ekler.\n" +
        "6️⃣ *💬 Otomatik Yanıt:* Gönderilerinizin altındaki 'fiyat', 'neresi' yorumlarına anında cevap verir.\n\n" +
        `${statusText}\n\n` +
        "📸 *Hemen Başlayın:* Bir fotoğraf gönderin veya `/ai Kapadokya balonlar` yazın!",
      {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: inlineKeyboard },
      }
    );
  });

  // ── /help ───────────────────────────────────────────────────────────────────
  _bot.help(async (ctx) => {
    await ctx.reply(
      "📖 *Komutlar & Kullanım Kılavuzu:*\n\n" +
        "• `/ai <konu>` - İstediğiniz konuda tamamen ücretsiz AI görseli ve başlığı üretir.\n" +
        "• `/hikaye <konu>` - 9:16 dikey Instagram Hikayesi (Story) için AI görseli çizer.\n" +
        "• `/status` - Platform bağlantılarını kontrol eder.\n" +
        "• `/start` - Ana menüyü açar.\n\n" +
        "📸 *İpuçları:*\n" +
        "- Fotoğraf atarken açıklama yazarsanız sizin cümleniz kullanılır, boş bırakırsanız görsel taranıp AI başlık üretilir.\n" +
        "- 2 veya daha fazla fotoğrafı albüm olarak seçip gönderirseniz otomatik Karusel gönderi oluşur.\n" +
        "- '⭐ Akıllı Saat' butonu kitlenizin en aktif olduğu saate gönderinizi otomatik randevular.",
      { parse_mode: "Markdown" }
    );
  });

  // ── /ai ve /olustur Komutları (Ücretsiz AI Görsel & Post) ───────────────────
  _bot.command(["ai", "olustur"], async (ctx) => {
    const rawText = (ctx.message as Message.TextMessage).text;
    const prompt = rawText.replace(/^\/(ai|olustur)\s*/i, "").trim();

    if (!prompt) {
      userAiWaitState.set(ctx.from.id, { format: "feed" });
      await ctx.reply(
        "🎨 *Yapay Zeka Görsel & Post Üretici*\n\n" +
          "Hangi konuda bir paylaşım hazırlamak istersiniz?\n" +
          "Lütfen konuyu yazın (Örn: *Kapadokya gün doğumu sıcak hava balonları vadide* veya *Karadeniz Ayder yaylası sisli sabah ahşap evler*):",
        { parse_mode: "Markdown" }
      );
      return;
    }

    await handleGenerateAiPost(ctx, prompt, "feed");
  });

  // ── /hikaye veya /story Komutları (9:16 Dikey Story Üretici) ─────────────────
  _bot.command(["hikaye", "story"], async (ctx) => {
    const rawText = (ctx.message as Message.TextMessage).text;
    const prompt = rawText.replace(/^\/(hikaye|story)\s*/i, "").trim();

    if (!prompt) {
      userAiWaitState.set(ctx.from.id, { format: "story" });
      await ctx.reply(
        "📱 *Instagram Hikayesi (Story) Üretici (9:16)*\n\n" +
          "Hikayenizde ne görmek istersiniz? Lütfen konuyu yazın:\n" +
          "(Örn: *Ege sahilinde gün batımı kahve keyfi ve palmiyeler*)",
        { parse_mode: "Markdown" }
      );
      return;
    }

    await handleGenerateAiPost(ctx, prompt, "story");
  });

  // ── Callback Query ─────────────────────────────────────────────────────────
  _bot.action("check_status", async (ctx) => {
    await ctx.answerCbQuery("Durum kontrol ediliyor...");
    await reportStatus(ctx, true);
  });

  _bot.action("show_help", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      "💡 *İpucu:* `/ai Bolu Yedigöller sonbahar renkleri` yazarak 10 saniyede hazır sosyal medya gönderisi üretebilirsiniz!",
      { parse_mode: "Markdown" }
    );
  });

  _bot.action("cmd_ai_prompt", async (ctx) => {
    await ctx.answerCbQuery();
    userAiWaitState.set(ctx.from!.id, { format: "feed" });
    await ctx.reply(
      "🎨 Lütfen oluşturmak istediğiniz görsel ve paylaşım konusunu yazın:\n(Örn: *Kaş Kaputaş plajı turkuaz deniz ve kayalıklar*)",
      { parse_mode: "Markdown" }
    );
  });

  _bot.action("cmd_ai_story", async (ctx) => {
    await ctx.answerCbQuery();
    userAiWaitState.set(ctx.from!.id, { format: "story" });
    await ctx.reply(
      "📱 Lütfen oluşturmak istediğiniz Instagram Hikayesi konusunu yazın:\n(Örn: *Fethiye Ölüdeniz yamaç paraşütü gökyüzü manzarası*)",
      { parse_mode: "Markdown" }
    );
  });

  // ── Draft Buton Handler'ları ────────────────────────────────────────────────

  // 1. Akışta Paylaş (Feed)
  _bot.action(/^publish_(.+)$/, async (ctx) => {
    const draftId = ctx.match[1];
    const draft = pendingDrafts.get(draftId);
    if (!draft) {
      await ctx.answerCbQuery("Bu gönderi süresi dolmuş veya iptal edilmiş.");
      return;
    }
    await ctx.answerCbQuery("🚀 Paylaşım başlatılıyor...");
    pendingDrafts.delete(draftId);
    await executePublishFlow(ctx, draft, "feed");
  });

  // 2. Story (Hikaye) Olarak Paylaş
  _bot.action(/^publish_story_(.+)$/, async (ctx) => {
    const draftId = ctx.match[1];
    const draft = pendingDrafts.get(draftId);
    if (!draft) {
      await ctx.answerCbQuery("Bu gönderi süresi dolmuş veya iptal edilmiş.");
      return;
    }
    await ctx.answerCbQuery("📱 Instagram Story yayınlanıyor...");
    pendingDrafts.delete(draftId);
    await executePublishFlow(ctx, draft, "story");
  });

  // 3. Akıllı Saate Zamanla (Smart Time)
  _bot.action(/^sched_smart_(.+)$/, async (ctx) => {
    const draftId = ctx.match[1];
    const draft = pendingDrafts.get(draftId);
    if (!draft) {
      await ctx.answerCbQuery("Gönderi bulunamadı.");
      return;
    }

    const smart = getNextSmartTime();
    await ctx.answerCbQuery("⭐ Akıllı saate zamanlandı!");
    await scheduleDraft(ctx, draft, smart.timestampMs, smart.buttonLabel, smart.reason);
    pendingDrafts.delete(draftId);
  });

  // 4. Sabit Saatler
  _bot.action(/^sched_2000_(.+)$/, async (ctx) => {
    const draftId = ctx.match[1];
    const draft = pendingDrafts.get(draftId);
    if (!draft) {
      await ctx.answerCbQuery("Gönderi bulunamadı.");
      return;
    }

    const target = new Date();
    target.setHours(20, 0, 0, 0);
    if (target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + 1);
    }

    await scheduleDraft(ctx, draft, target.getTime(), "bu akşam 20:00'de", "Akşam prime time");
    pendingDrafts.delete(draftId);
  });

  _bot.action(/^sched_1h_(.+)$/, async (ctx) => {
    const draftId = ctx.match[1];
    const draft = pendingDrafts.get(draftId);
    if (!draft) {
      await ctx.answerCbQuery("Gönderi bulunamadı.");
      return;
    }

    const targetTime = Date.now() + 60 * 60 * 1000;
    await scheduleDraft(ctx, draft, targetTime, "1 saat sonra", "Hızlı zamanlama");
    pendingDrafts.delete(draftId);
  });

  // 5. Filigran Aç / Kapat
  _bot.action(/^toggle_wm_(.+)$/, async (ctx) => {
    const draftId = ctx.match[1];
    const draft = pendingDrafts.get(draftId);
    if (!draft) {
      await ctx.answerCbQuery("Gönderi bulunamadı.");
      return;
    }
    draft.applyWatermark = !draft.applyWatermark;
    await ctx.answerCbQuery(`Filigran: ${draft.applyWatermark ? "Açık" : "Kapalı"}`);
    await renderDraftCard(ctx, draft, true);
  });

  // 6. Çok Dilli (Multi-Language) Çeviri Ekle / Kaldır
  _bot.action(/^toggle_lang_(.+)$/, async (ctx) => {
    const draftId = ctx.match[1];
    const draft = pendingDrafts.get(draftId);
    if (!draft) {
      await ctx.answerCbQuery("Gönderi bulunamadı.");
      return;
    }

    if (!draft.originalCaption) {
      draft.originalCaption = draft.caption;
    }

    if (!draft.hasTranslation) {
      await ctx.answerCbQuery("🌐 İngilizce çeviri ekleniyor...");
      draft.caption = await freeAiGenerator.translateToEnglish(draft.originalCaption);
      draft.hasTranslation = true;
    } else {
      await ctx.answerCbQuery("🌐 Orijinal Türkçe metne dönüldü.");
      draft.caption = draft.originalCaption;
      draft.hasTranslation = false;
    }

    await renderDraftCard(ctx, draft, true);
  });

  // 7. AI Başlığı Yenile
  _bot.action(/^regen_ai_(.+)$/, async (ctx) => {
    const draftId = ctx.match[1];
    const draft = pendingDrafts.get(draftId);
    if (!draft) {
      await ctx.answerCbQuery("Gönderi bulunamadı.");
      return;
    }
    await ctx.answerCbQuery("🤖 Yeni AI başlığı üretiliyor...");
    if (draft.prompt) {
      draft.caption = await freeAiGenerator.generateCaption(draft.prompt);
    } else {
      draft.caption = await generateCaptionFromImage(draft.localPath);
    }
    draft.originalCaption = draft.caption;
    draft.hasTranslation = false;
    await renderDraftCard(ctx, draft, true);
  });

  // 8. İptal Et
  _bot.action(/^cancel_(.+)$/, async (ctx) => {
    const draftId = ctx.match[1];
    const draft = pendingDrafts.get(draftId);
    if (draft) {
      mediaProcessor.cleanup(draft.localPath, ...(draft.albumPaths || []));
      pendingDrafts.delete(draftId);
    }
    await ctx.answerCbQuery("İptal edildi.");
    if (ctx.callbackQuery.message) {
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        ctx.callbackQuery.message.message_id,
        undefined,
        "❌ *Gönderi iptal edildi.*",
        { parse_mode: "Markdown" }
      );
    }
  });

  // ── /status ─────────────────────────────────────────────────────────────────
  _bot.command("status", async (ctx) => {
    await reportStatus(ctx, false);
  });

  // ── Fotoğraf handler (Tekli ve Albüm/Carousel Desteği) ───────────────────────
  _bot.on("photo", async (ctx) => {
    const msg = ctx.message as Message.PhotoMessage;
    const incomingCaption = msg.caption ?? "";
    const photo = msg.photo.at(-1)!;
    const mediaGroupId = msg.media_group_id;

    // Eğer çoklu fotoğraf albümü (Media Group) ise tampona ekle
    if (mediaGroupId) {
      handleAlbumIncomingPhoto(ctx, mediaGroupId, photo.file_id, incomingCaption);
      return;
    }

    // Tekli fotoğraf akışı
    const statusMsg = await ctx.reply("⏳ Görsel analiz ediliyor ve optimize ediliyor...");
    let localPath: string | undefined;

    try {
      localPath = await downloadFile(ctx, photo.file_id, ".jpg");
      const optimizedPath = await mediaProcessor.optimizeImage(localPath);
      mediaProcessor.cleanup(localPath);

      let finalCaption = incomingCaption;
      if (!finalCaption) {
        await editMsg(ctx, statusMsg.message_id, "🤖 Yapay Zeka başlık ve hashtag üretiyor...");
        finalCaption = await generateCaptionFromImage(optimizedPath);
      }

      const draftId = `d_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const draft: PendingDraft = {
        id: draftId,
        userId: ctx.from.id,
        localPath: optimizedPath,
        caption: finalCaption,
        originalCaption: finalCaption,
        applyWatermark: config.watermark.enabled,
        createdAt: Date.now(),
      };

      pendingDrafts.set(draftId, draft);

      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
      } catch {}

      await renderDraftCard(ctx, draft, false);
    } catch (err) {
      await editMsg(ctx, statusMsg.message_id, `🚨 *Hata:*\n\`${String(err).slice(0, 300)}\``);
      if (localPath) mediaProcessor.cleanup(localPath);
    }
  });

  // ── Video handler ────────────────────────────────────────────────────────────
  _bot.on("video", async (ctx) => {
    const caption = (ctx.message as Message.VideoMessage).caption ?? "";
    const video = (ctx.message as Message.VideoMessage).video;
    const statusMsg = await ctx.reply("⏳ Video alındı, işleniyor...");
    let localPath: string | undefined;

    try {
      localPath = await downloadFile(ctx, video.file_id, ".mp4");
      mediaProcessor.validateVideo(localPath);

      let publicUrl = "";
      if (config.cloudinary.isConfigured) {
        await editMsg(ctx, statusMsg.message_id, "⏳ CDN'e yükleniyor...");
        publicUrl = await cloudinaryUploader.uploadVideo(localPath);
      }

      await editMsg(ctx, statusMsg.message_id, "⏳ Platformlara yayınlanıyor...");
      const publishTasks: Promise<PublishResult>[] = [];

      if (config.facebook.isConfigured) {
        publishTasks.push(facebookPublisher.postVideo(localPath, caption));
      }
      if (config.instagram.isConfigured && publicUrl) {
        publishTasks.push(instagramPublisher.postVideo(publicUrl, caption));
      }

      const results = await Promise.all(publishTasks);
      await editMsg(ctx, statusMsg.message_id, buildReport(results));

      addHistory({
        id: `v_${Date.now()}`,
        createdAt: new Date().toISOString(),
        caption,
        mediaType: "video",
        mediaUrl: publicUrl,
        status: results.some((r) => r.success) ? "published" : "failed",
        platforms: {
          facebook: { success: results.find((r) => r.platform === "facebook")?.success ?? false },
          instagram: { success: results.find((r) => r.platform === "instagram")?.success ?? false },
        },
      });
    } catch (err) {
      await editMsg(ctx, statusMsg.message_id, `🚨 *Hata:*\n\`${String(err).slice(0, 300)}\``);
    } finally {
      if (localPath) mediaProcessor.cleanup(localPath);
    }
  });

  // ── Metin handler ────────────────────────────────────────────────────────────
  _bot.on("text", async (ctx) => {
    const text = (ctx.message as Message.TextMessage).text;
    if (text.startsWith("/")) return;

    // Eğer kullanıcı AI prompt girmesi bekleniyorsa:
    const waitState = userAiWaitState.get(ctx.from.id);
    if (waitState) {
      userAiWaitState.delete(ctx.from.id);
      await handleGenerateAiPost(ctx, text, waitState.format);
      return;
    }

    // Normal metin paylaşımı
    const statusMsg = await ctx.reply("⏳ Metin gönderisi yayınlanıyor...");
    const publishTasks: Promise<PublishResult>[] = [];

    if (config.facebook.isConfigured) publishTasks.push(facebookPublisher.postText(text));
    if (config.linkedin.isConfigured) publishTasks.push(linkedInPublisher.postText(text));

    const results = await Promise.all(publishTasks);
    await editMsg(ctx, statusMsg.message_id, buildReport(results));

    addHistory({
      id: `t_${Date.now()}`,
      createdAt: new Date().toISOString(),
      caption: text,
      mediaType: "photo",
      status: results.some((r) => r.success) ? "published" : "failed",
      platforms: {
        facebook: { success: results.find((r) => r.platform === "facebook")?.success ?? false },
        linkedin: { success: results.find((r) => r.platform === "linkedin")?.success ?? false },
      },
    });
  });

  return _bot;
}

// ── Çoklu Fotoğraf (Album / Carousel) Tampon Yöneticisi ───────────────────────
function handleAlbumIncomingPhoto(ctx: Context, groupId: string, fileId: string, caption = "") {
  let buffer = albumBuffers.get(groupId);

  if (!buffer) {
    buffer = {
      userId: ctx.from!.id,
      items: [],
      timer: setTimeout(() => processAlbum(ctx, groupId), 1300),
    };
    albumBuffers.set(groupId, buffer);
  } else {
    clearTimeout(buffer.timer);
    buffer.timer = setTimeout(() => processAlbum(ctx, groupId), 1300);
  }

  buffer.items.push({ fileId, caption });
}

async function processAlbum(ctx: Context, groupId: string) {
  const buffer = albumBuffers.get(groupId);
  if (!buffer) return;
  albumBuffers.delete(groupId);

  const statusMsg = await ctx.reply(`📸 ${buffer.items.length} adet fotoğraf albümü işleniyor ve karusel hazırlanıyor...`);
  const downloadedPaths: string[] = [];
  const optimizedPaths: string[] = [];

  try {
    let combinedCaption = buffer.items.find((i) => i.caption)?.caption || "";

    for (const item of buffer.items) {
      const p = await downloadFile(ctx, item.fileId, ".jpg");
      downloadedPaths.push(p);
      const opt = await mediaProcessor.optimizeImage(p);
      optimizedPaths.push(opt);
    }

    if (!combinedCaption) {
      combinedCaption = await freeAiGenerator.generateCaption("Günübirlik seyahat fotoğraf albümü ve rota anıları");
    }

    const draftId = `c_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const draft: PendingDraft = {
      id: draftId,
      userId: buffer.userId,
      localPath: optimizedPaths[0],
      albumPaths: optimizedPaths,
      caption: combinedCaption,
      originalCaption: combinedCaption,
      applyWatermark: config.watermark.enabled,
      createdAt: Date.now(),
    };

    pendingDrafts.set(draftId, draft);

    try {
      await ctx.telegram.deleteMessage(ctx.chat!.id, statusMsg.message_id);
    } catch {}

    await renderDraftCard(ctx, draft, false);
  } catch (err) {
    await editMsg(ctx, statusMsg.message_id, `🚨 *Karusel Hatası:*\n\`${String(err).slice(0, 300)}\``);
  } finally {
    mediaProcessor.cleanup(...downloadedPaths);
  }
}

// ── AI Görsel & Post Üretim Yöneticisi ─────────────────────────────────────────
async function handleGenerateAiPost(ctx: Context, prompt: string, format: "feed" | "story") {
  const statusMsg = await ctx.reply(
    `🎨 *Yapay Zeka Çalışıyor...*\n\n` +
      `Konu: _"${prompt}"_\n` +
      `Format: *${format === "story" ? "📱 Instagram Story (9:16)" : "📌 Akış Gönderisi (1:1)"}*\n\n` +
      `⚡ Fotogerçekçi görsel çiziliyor ve Türkçe başlık üretiliyor (10-15 sn), lütfen bekleyin... ⏳`,
    { parse_mode: "Markdown" }
  );

  try {
    logEvent("info", "telegram", `Telegram kullanıcısı AI görsel üretimi başlattı: "${prompt.slice(0, 80)}"`, { format });
    const aiResult = await freeAiGenerator.generatePost(prompt, format, config.watermark.enabled);
    logEvent("success", "ai", `AI görseli ve başlık üretildi: ${path.basename(aiResult.imagePath)}`, { format, prompt: prompt.slice(0, 100) });

    const draftId = `ai_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const draft: PendingDraft = {
      id: draftId,
      userId: ctx.from!.id,
      localPath: aiResult.imagePath,
      caption: aiResult.caption,
      originalCaption: aiResult.caption,
      applyWatermark: config.watermark.enabled,
      targetType: format,
      isAiGenerated: true,
      prompt,
      createdAt: Date.now(),
    };

    pendingDrafts.set(draftId, draft);

    // Durum mesajını sil
    try {
      await ctx.telegram.deleteMessage(ctx.chat!.id, statusMsg.message_id);
    } catch {}

    // Üretilen görseli Telegram'a fotoğraf olarak gönder
    await ctx.replyWithPhoto(
      { source: aiResult.imagePath },
      {
        caption: `🎨 *AI Tarafından Üretildi!*\n\nPrompt: _${prompt}_\nFormat: *${format === "story" ? "Instagram Story (9:16)" : "Feed Post (1:1)"}*`,
        parse_mode: "Markdown",
      }
    );

    // Ardından onay ve paylaşım kartını göster
    await renderDraftCard(ctx, draft, false);
  } catch (err: any) {
    logEvent("error", "ai", `AI üretim hatası: ${err.message}`, { prompt: prompt.slice(0, 100) });
    await editMsg(ctx, statusMsg.message_id, `🚨 *AI Üretim Hatası:*\n\`${String(err).slice(0, 300)}\``);
  }
}

// ── Onay ve Eylem Kartı (Draft Card) ───────────────────────────────────────────
async function renderDraftCard(ctx: Context, draft: PendingDraft, isEdit = false): Promise<void> {
  const wmIcon = draft.applyWatermark ? "✅ Açık" : "❌ Kapalı";
  const smartTime = getNextSmartTime();
  const isCarousel = (draft.albumPaths && draft.albumPaths.length > 1) ?? false;

  let headerTitle = "📸 *Gönderiniz Hazırlandı!*";
  if (draft.isAiGenerated) headerTitle = "✨ *Yapay Zeka Gönderiniz Hazır!*";
  if (isCarousel) headerTitle = `🖼️ *${draft.albumPaths!.length} Fotoğraflı Karusel Gönderi Hazır!*`;

  const messageText =
    `${headerTitle}\n\n` +
    `✍️ *Paylaşım Metni:*\n${draft.caption}\n\n` +
    `🎨 *Günübirlik Filigranı:* ${wmIcon}\n\n` +
    `⭐ *Önerilen En İyi Etkileşim Saati:*\n_${smartTime.buttonLabel}_ (${smartTime.reason})\n\n` +
    "👇 *Nasıl paylaşmak istersiniz?*";

  const buttons: any[][] = [];

  // Paylaşım seçenekleri
  if (isCarousel) {
    buttons.push([{ text: "🚀 Karusel Olarak Paylaş (IG + FB)", callback_data: `publish_${draft.id}` }]);
  } else if (draft.targetType === "story") {
    buttons.push([{ text: "📱 Instagram Story Olarak Paylaş", callback_data: `publish_story_${draft.id}` }]);
    buttons.push([{ text: "📌 Akışta (Feed) Paylaş", callback_data: `publish_${draft.id}` }]);
  } else {
    buttons.push([
      { text: "🚀 Hemen Paylaş (Feed)", callback_data: `publish_${draft.id}` },
      { text: "📱 Story Olarak Paylaş", callback_data: `publish_story_${draft.id}` },
    ]);
  }

  // Zamanlama butonları
  buttons.push([
    { text: smartTime.buttonLabel, callback_data: `sched_smart_${draft.id}` },
  ]);
  buttons.push([
    { text: "🌙 Akşam 20:00", callback_data: `sched_2000_${draft.id}` },
    { text: "⏰ 1 Saat Sonra", callback_data: `sched_1h_${draft.id}` },
  ]);

  // AI & Dil & Filigran Butonları
  buttons.push([
    { text: draft.hasTranslation ? "🌐 Orijinal Türkçe" : "🌐 Çeviri Ekle (TR+EN)", callback_data: `toggle_lang_${draft.id}` },
    { text: `🎨 Filigran: ${wmIcon}`, callback_data: `toggle_wm_${draft.id}` },
  ]);

  buttons.push([
    { text: "🔄 Başlığı Yeniden Üret", callback_data: `regen_ai_${draft.id}` },
    { text: "❌ İptal Et", callback_data: `cancel_${draft.id}` },
  ]);

  const replyMarkup = { inline_keyboard: buttons };

  if (isEdit && ctx.callbackQuery?.message) {
    try {
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        ctx.callbackQuery.message.message_id,
        undefined,
        messageText,
        { parse_mode: "Markdown", reply_markup: replyMarkup }
      );
      return;
    } catch {}
  }

  await ctx.reply(messageText, { parse_mode: "Markdown", reply_markup: replyMarkup });
}

// ── Zamanlama Kaydı ───────────────────────────────────────────────────────────
async function scheduleDraft(
  ctx: Context,
  draft: PendingDraft,
  scheduledTimeMs: number,
  label: string,
  reason = ""
) {
  let finalPath = draft.localPath;
  const finalAlbumPaths: string[] = [];

  if (draft.albumPaths && draft.albumPaths.length > 0) {
    for (const p of draft.albumPaths) {
      if (draft.applyWatermark) {
        const wm = await applyWatermark(p, config.watermark.text);
        finalAlbumPaths.push(wm);
      } else {
        finalAlbumPaths.push(p);
      }
    }
    finalPath = finalAlbumPaths[0];
  } else if (draft.applyWatermark) {
    finalPath = await applyWatermark(draft.localPath, config.watermark.text);
    mediaProcessor.cleanup(draft.localPath);
  }

  addScheduledItem({
    id: draft.id,
    userId: draft.userId,
    localPath: finalPath,
    albumPaths: finalAlbumPaths.length > 0 ? finalAlbumPaths : undefined,
    caption: draft.caption,
    applyWatermark: draft.applyWatermark,
    targetType: draft.targetType || "feed",
    scheduledAt: scheduledTimeMs,
    createdAt: new Date().toISOString(),
  });

  const timeStr = new Date(scheduledTimeMs).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  const text =
    `⏰ *Gönderiniz Başarıyla Kuyruğa Alındı!*\n\n` +
    `🗓️ *Planlanan Zaman:* ${label} (${timeStr})\n` +
    (reason ? `💡 *Neden:* ${reason}\n\n` : "\n") +
    `✍️ *Açıklama:*\n${draft.caption}\n\n` +
    `✅ Saati geldiğinde otomatik olarak sosyal medya hesaplarınızda yayınlanacak ve Telegram'dan rapor verilecektir.`;

  if (ctx.callbackQuery?.message) {
    try {
      await ctx.telegram.editMessageText(ctx.chat!.id, ctx.callbackQuery.message.message_id, undefined, text, {
        parse_mode: "Markdown",
      });
      return;
    } catch {}
  }

  await ctx.reply(text, { parse_mode: "Markdown" });
}

// ── Anında Paylaşım Akışı ─────────────────────────────────────────────────────
async function executePublishFlow(ctx: Context, draft: PendingDraft, targetType: "feed" | "story" = "feed") {
  let statusMsgId: number | undefined;

  if (ctx.callbackQuery?.message) {
    statusMsgId = ctx.callbackQuery.message.message_id;
    await editMsg(ctx, statusMsgId, "⏳ Gönderi işleniyor ve yayınlanıyor...");
  } else {
    const sent = await ctx.reply("⏳ Gönderi işleniyor ve yayınlanıyor...");
    statusMsgId = sent.message_id;
  }

  let finalImagePath = draft.localPath;
  const finalAlbumPaths: string[] = [];
  const publicUrls: string[] = [];

  try {
    // 1. Çoklu fotoğraf (Carousel)
    if (draft.albumPaths && draft.albumPaths.length > 1) {
      if (statusMsgId) await editMsg(ctx, statusMsgId, "⏳ Karusel fotoğrafları yükleniyor...");

      for (const p of draft.albumPaths) {
        let currentPath = p;
        if (draft.applyWatermark) {
          currentPath = await applyWatermark(p, config.watermark.text);
        }
        finalAlbumPaths.push(currentPath);

        if (config.cloudinary.isConfigured) {
          const u = await cloudinaryUploader.uploadImage(currentPath);
          publicUrls.push(u);
        }
      }

      finalImagePath = finalAlbumPaths[0];
    } else {
      // Tekli görsel
      if (targetType === "story") {
        if (statusMsgId) await editMsg(ctx, statusMsgId, "📱 Story (9:16) formatına dönüştürülüyor...");
        finalImagePath = await mediaProcessor.optimizeForStory(draft.localPath);
      } else {
        finalImagePath = draft.localPath;
      }

      if (draft.applyWatermark) {
        if (statusMsgId) await editMsg(ctx, statusMsgId, "🎨 Filigran ekleniyor...");
        finalImagePath = await applyWatermark(finalImagePath, config.watermark.text);
      }

      if (config.cloudinary.isConfigured) {
        if (statusMsgId) await editMsg(ctx, statusMsgId, "⏳ CDN'e yükleniyor...");
        const u = await cloudinaryUploader.uploadImage(finalImagePath);
        publicUrls.push(u);
      }
    }

    if (statusMsgId) await editMsg(ctx, statusMsgId, "⏳ Platformlara yayınlanıyor...");
    const publishTasks: Promise<PublishResult>[] = [];

    // Facebook
    if (config.facebook.isConfigured) {
      if (publicUrls.length > 1) {
        publishTasks.push(facebookPublisher.postCarousel(publicUrls, draft.caption));
      } else {
        const source = publicUrls[0] || finalImagePath;
        publishTasks.push(facebookPublisher.postPhoto(source, draft.caption));
      }
    }

    // Instagram
    if (config.instagram.isConfigured) {
      if (targetType === "story") {
        if (publicUrls[0]) {
          publishTasks.push(instagramPublisher.postStory(publicUrls[0], false));
        } else {
          publishTasks.push(Promise.resolve({ platform: "instagram", success: false, error: "Cloudinary CDN gereklidir." }));
        }
      } else if (publicUrls.length > 1) {
        publishTasks.push(instagramPublisher.postCarousel(publicUrls, draft.caption));
      } else if (publicUrls[0]) {
        publishTasks.push(instagramPublisher.postPhoto(publicUrls[0], draft.caption));
      } else {
        publishTasks.push(Promise.resolve({ platform: "instagram", success: false, error: "Cloudinary CDN gereklidir." }));
      }
    }

    // LinkedIn
    if (config.linkedin.isConfigured && targetType !== "story") {
      publishTasks.push(linkedInPublisher.postPhoto(finalImagePath, draft.caption));
    }

    const results = await Promise.all(publishTasks);
    if (statusMsgId) await editMsg(ctx, statusMsgId, buildReport(results));

    for (const r of results) {
      if (r.success) {
        logEvent("success", r.platform as any, `${r.platform.toUpperCase()} üzerinde paylaşım başarılı.`, { draftId: draft.id });
      } else {
        logEvent("error", r.platform as any, `${r.platform.toUpperCase()} paylaşım hatası: ${r.error}`, { draftId: draft.id });
      }
    }

    // Geçmişe kaydet
    const historyRecord: PostRecord = {
      id: draft.id,
      createdAt: new Date().toISOString(),
      caption: draft.caption,
      mediaType: publicUrls.length > 1 ? "carousel" : "photo",
      targetType,
      mediaUrl: publicUrls[0] || "",
      albumUrls: publicUrls.length > 1 ? publicUrls : undefined,
      status: results.some((r) => r.success) ? "published" : "failed",
      platforms: {},
    };

    for (const r of results) {
      if (r.platform === "facebook") historyRecord.platforms.facebook = { success: r.success, error: r.error };
      if (r.platform === "instagram") historyRecord.platforms.instagram = { success: r.success, error: r.error };
      if (r.platform === "linkedin") historyRecord.platforms.linkedin = { success: r.success, error: r.error };
    }

    addHistory(historyRecord);
  } catch (err) {
    if (statusMsgId) await editMsg(ctx, statusMsgId, `🚨 *Hata:*\n\`${String(err).slice(0, 300)}\``);
  } finally {
    mediaProcessor.cleanup(draft.localPath, finalImagePath, ...finalAlbumPaths);
  }
}

// ── Sistem Durumu Raporu ──────────────────────────────────────────────────────
async function reportStatus(ctx: Context, isCallback = false): Promise<void> {
  const checks: string[] = [];

  // Facebook
  if (config.facebook.isConfigured) {
    try {
      const { data } = await axios.get(`${config.facebook.baseUrl}/${config.facebook.pageId}`, {
        params: { fields: "id,name", access_token: config.facebook.pageAccessToken },
        timeout: 10_000,
      });
      checks.push(`✅ Facebook: Bağlı (${data.name})`);
    } catch {
      checks.push("❌ Facebook: Bağlantı hatası");
    }
  } else {
    checks.push("⚪ Facebook: Yapılandırılmadı");
  }

  // Instagram
  if (config.instagram.isConfigured) {
    try {
      const { data } = await axios.get(`${config.facebook.baseUrl}/${config.instagram.userId}`, {
        params: { fields: "id,username", access_token: config.facebook.pageAccessToken },
        timeout: 10_000,
      });
      checks.push(`✅ Instagram: @${data.username}`);
    } catch {
      checks.push("❌ Instagram: Bağlantı hatası");
    }
  } else {
    checks.push("⚪ Instagram: Yapılandırılmadı");
  }

  // LinkedIn
  if (config.linkedin.isConfigured) {
    try {
      const { data } = await axios.get(`${config.linkedin.baseUrl}/userinfo`, {
        headers: { Authorization: `Bearer ${config.linkedin.accessToken}` },
        timeout: 10_000,
      });
      const orgText = config.linkedin.organizationId ? ` | Şirket: ${config.linkedin.organizationId}` : "";
      checks.push(`✅ LinkedIn: ${data.name ?? data.sub}${orgText}`);
    } catch {
      checks.push("❌ LinkedIn: Bağlantı hatası");
    }
  } else {
    checks.push("⚪ LinkedIn: Yapılandırılmadı");
  }

  // Cloudinary
  checks.push(config.cloudinary.isConfigured ? "✅ Cloudinary: Aktif" : "⚪ Cloudinary: Yapılandırılmadı");

  // Ücretsiz AI & Gemini
  checks.push("✨ Ücretsiz AI Üretici (Pollinations FLUX): Aktif (Sınırsız/Ücretsiz)");

  // Filigran
  checks.push(`🎨 Filigran: ${config.watermark.enabled ? "Açık" : "Kapalı"} (${config.watermark.text})`);

  const messageText = "🔌 *Sistem & Platform Durumu:*\n\n" + checks.join("\n");
  const buttons = {
    inline_keyboard: [
      [{ text: "🔄 Yeniden Kontrol Et", callback_data: "check_status" }],
      ...(config.facebook.pageId ? [[{ text: "👍 Facebook Sayfası", url: `https://facebook.com/${config.facebook.pageId}` }]] : []),
    ],
  };

  if (isCallback && ctx.callbackQuery?.message) {
    try {
      await ctx.telegram.editMessageText(ctx.chat!.id, ctx.callbackQuery.message.message_id, undefined, messageText, {
        parse_mode: "Markdown",
        reply_markup: buttons,
      });
      return;
    } catch {}
  }

  await ctx.reply(messageText, { parse_mode: "Markdown", reply_markup: buttons });
}

async function downloadFile(ctx: Context, fileId: string, ext: string): Promise<string> {
  const fileInfo = await ctx.telegram.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${config.telegram.botToken}/${fileInfo.file_path}`;
  const localPath = path.join(os.tmpdir(), `${fileId}${ext}`);
  const response = await axios.get(fileUrl, { responseType: "arraybuffer", timeout: 60_000 });
  fs.writeFileSync(localPath, Buffer.from(response.data as ArrayBuffer));
  return localPath;
}

async function editMsg(ctx: Context, msgId: number, text: string): Promise<void> {
  try {
    await ctx.telegram.editMessageText(ctx.chat!.id, msgId, undefined, text, {
      parse_mode: "Markdown",
    });
  } catch {}
}

function buildReport(results: PublishResult[]): string {
  const labels: Record<string, string> = {
    instagram: "📷 Instagram",
    facebook: "👍 Facebook",
    linkedin: "💼 LinkedIn",
  };
  const lines = results.map((r) =>
    r.success
      ? `✅ ${labels[r.platform]}: Başarılı`
      : `❌ ${labels[r.platform]}: \`${(r.error ?? "Hata").slice(0, 120)}\``
  );
  const allOk = results.every((r) => r.success);
  return (
    "📊 *Paylaşım Sonuçları:*\n\n" +
    lines.join("\n") +
    (allOk ? "\n\n🎉 Tüm platformlara paylaşıldı!" : "")
  );
}
