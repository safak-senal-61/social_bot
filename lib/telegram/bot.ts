// lib/telegram/bot.ts
// Telegraf bot — lazy singleton pattern
// Build-time'da token okunmaz; yalnızca ilk HTTP isteğinde başlatılır.

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
import type { PublishResult } from "@/lib/types";

// ── Lazy singleton ────────────────────────────────────────────────────────────

let _bot: Telegraf | null = null;

export function resetBot(): void {
  _bot = null;
}

/**
 * Bot instance'ını döner; yoksa oluşturup handler'ları bağlar.
 * Build-time'da değil yalnızca runtime'da çalışır.
 */
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
    const activePlatforms = [];
    if (config.facebook.isConfigured) activePlatforms.push("👍 Facebook");
    if (config.instagram.isConfigured) activePlatforms.push("📷 Instagram");
    if (config.linkedin.isConfigured) activePlatforms.push("💼 LinkedIn");

    const statusText = activePlatforms.length > 0
      ? `*Aktif Platformlar:*\n${activePlatforms.join("\n")}`
      : "⚠️ Henüz hiçbir sosyal medya hesabı bağlanmamış.";

    const inlineKeyboard = [];

    // Facebook Sayfa Butonu (Eğer varsa)
    if (config.facebook.pageId) {
      inlineKeyboard.push([
        { text: "👍 Facebook Sayfama Git", url: `https://facebook.com/${config.facebook.pageId}` }
      ]);
    }

    // Web Paneli ve Durum Butonları
    const appUrl = config.appUrl && config.appUrl.startsWith("https") ? config.appUrl : null;
    const secondRow = [
      { text: "🔍 Durumu Kontrol Et", callback_data: "check_status" },
      { text: "📖 Yardım", callback_data: "show_help" }
    ];

    if (appUrl) {
      inlineKeyboard.push([
        { text: "🌐 Web Yönetim Paneli", web_app: { url: appUrl } }
      ]);
    }

    inlineKeyboard.push(secondRow);

    await ctx.reply(
      "👋 *Social Poster Bot'a Hoş Geldiniz!*\n\n" +
        "Telegram üzerinden gönderdiğiniz görsel ve videoları tek tıkla sosyal medya hesaplarınıza yayınlarım.\n\n" +
        `${statusText}\n\n` +
        "📸 *Hemen Başlayın:* Bir fotoğraf veya video gönderip açıklama (caption) yazın!",
      {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: inlineKeyboard }
      }
    );
  });

  // ── /help ───────────────────────────────────────────────────────────────────
  _bot.help(async (ctx) => {
    await ctx.reply(
      "📖 *Hızlı Kullanım Rehberi*\n\n" +
        "1️⃣ *Fotoğraf Paylaşımı:* Fotoğraf gönderin. Açıklama kutusuna gönderi metninizi yazın.\n" +
        "2️⃣ *Video Paylaşımı:* Video gönderin. MP4 formatında ve 100 MB altı önerilir.\n" +
        "3️⃣ *Otomatik İşleme:* Boyutlandırma ve format optimizasyonu otomatik yapılır.\n\n" +
        "Hesaplarınızı yönetmek için aşağıdaki butonları kullanabilirsiniz:",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔍 Platform Durumu", callback_data: "check_status" }],
            ...(config.facebook.pageId ? [[{ text: "👍 Facebook Sayfası", url: `https://facebook.com/${config.facebook.pageId}` }]] : [])
          ]
        }
      }
    );
  });

  // ── Callback Query (Buton Tıklamaları) ──────────────────────────────────────
  _bot.action("check_status", async (ctx) => {
    await ctx.answerCbQuery("Durum kontrol ediliyor...");
    await reportStatus(ctx, true);
  });

  _bot.action("show_help", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      "💡 *İpucu:* Gönderinizin altına yazdığınız açıklama (caption) doğrudan Facebook sayfanızın gönderi metni olarak paylaşılır.\n\n" +
      "Hashtag (#günübirlik vb.) ekleyebilirsiniz!",
      { parse_mode: "Markdown" }
    );
  });

  // ── /status ─────────────────────────────────────────────────────────────────
  _bot.command("status", async (ctx) => {
    await reportStatus(ctx, false);
  });

  // ── Fotoğraf handler ────────────────────────────────────────────────────────
  _bot.on("photo", async (ctx) => {
    const caption = (ctx.message as Message.PhotoMessage).caption ?? "";
    const photo = (ctx.message as Message.PhotoMessage).photo.at(-1)!;
    const statusMsg = await ctx.reply("⏳ Fotoğraf işleniyor...");
    let localPath: string | undefined;
    let optimizedPath: string | undefined;

    try {
      localPath = await downloadFile(ctx, photo.file_id, ".jpg");
      optimizedPath = await mediaProcessor.optimizeImage(localPath);

      let publicUrl = "";
      if (config.cloudinary.isConfigured) {
        await editMsg(ctx, statusMsg.message_id, "⏳ CDN'e yükleniyor...");
        publicUrl = await cloudinaryUploader.uploadImage(optimizedPath);
      }

      await editMsg(ctx, statusMsg.message_id, "⏳ Platformlara yayınlanıyor...");
      const publishTasks: Promise<PublishResult>[] = [];

      // Facebook
      if (config.facebook.isConfigured) {
        // Public URL varsa URL ile, yoksa doğrudan yerel optimize edilmiş dosya ile yükle
        const source = publicUrl || optimizedPath;
        publishTasks.push(facebookPublisher.postPhoto(source, caption));
      }

      // Instagram (Public URL gerektirir)
      if (config.instagram.isConfigured) {
        if (publicUrl) {
          publishTasks.push(instagramPublisher.postPhoto(publicUrl, caption));
        } else {
          publishTasks.push(
            Promise.resolve({
              platform: "instagram",
              success: false,
              error: "Instagram için Cloudinary CDN gereklidir.",
            })
          );
        }
      }

      // LinkedIn
      if (config.linkedin.isConfigured) {
        publishTasks.push(linkedInPublisher.postPhoto(optimizedPath, caption));
      }

      if (publishTasks.length === 0) {
        await editMsg(ctx, statusMsg.message_id, "⚠️ Henüz hiçbir aktif platform (Facebook, Instagram, LinkedIn) yapılandırılmamış!");
        return;
      }

      const results = await Promise.all(publishTasks);
      await editMsg(ctx, statusMsg.message_id, buildReport(results));
    } catch (err) {
      await editMsg(ctx, statusMsg.message_id, `🚨 *Hata:*\n\`${String(err).slice(0, 300)}\``);
    } finally {
      mediaProcessor.cleanup(localPath, optimizedPath);
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

      // Facebook
      if (config.facebook.isConfigured) {
        publishTasks.push(facebookPublisher.postVideo(localPath, caption));
      }

      // Instagram (Public URL şart)
      if (config.instagram.isConfigured) {
        if (publicUrl) {
          publishTasks.push(instagramPublisher.postVideo(publicUrl, caption));
        } else {
          publishTasks.push(
            Promise.resolve({
              platform: "instagram",
              success: false,
              error: "Instagram video için Cloudinary CDN gereklidir.",
            })
          );
        }
      }

      // LinkedIn
      if (config.linkedin.isConfigured) {
        publishTasks.push(linkedInPublisher.postText(caption));
      }

      if (publishTasks.length === 0) {
        await editMsg(ctx, statusMsg.message_id, "⚠️ Henüz hiçbir aktif platform yapılandırılmamış!");
        return;
      }

      const results = await Promise.all(publishTasks);
      await editMsg(ctx, statusMsg.message_id, buildReport(results));
    } catch (err) {
      await editMsg(ctx, statusMsg.message_id, `🚨 *Hata:*\n\`${String(err).slice(0, 300)}\``);
    } finally {
      mediaProcessor.cleanup(localPath);
    }
  });

  return _bot;
}

// ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────

async function reportStatus(ctx: Context, isCallback = false): Promise<void> {
  const checks: string[] = [];

  // Facebook
  if (config.facebook.isConfigured) {
    try {
      const { data } = await axios.get(
        `${config.facebook.baseUrl}/${config.facebook.pageId}`,
        {
          params: { fields: "id,name", access_token: config.facebook.pageAccessToken },
          timeout: 10_000,
        }
      );
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
      const { data } = await axios.get(
        `${config.facebook.baseUrl}/${config.instagram.userId}`,
        {
          params: { fields: "id,username", access_token: config.facebook.pageAccessToken },
          timeout: 10_000,
        }
      );
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
      checks.push(`✅ LinkedIn: ${data.name ?? data.sub}`);
    } catch {
      checks.push("❌ LinkedIn: Bağlantı hatası");
    }
  } else {
    checks.push("⚪ LinkedIn: Yapılandırılmadı");
  }

  // Cloudinary
  checks.push(config.cloudinary.isConfigured ? "✅ Cloudinary: Aktif" : "⚪ Cloudinary: Yapılandırılmadı");

  const messageText = "🔌 *Platform Bağlantı Durumu:*\n\n" + checks.join("\n");
  const buttons = {
    inline_keyboard: [
      [{ text: "🔄 Yeniden Kontrol Et", callback_data: "check_status" }],
      ...(config.facebook.pageId ? [[{ text: "👍 Facebook Sayfası", url: `https://facebook.com/${config.facebook.pageId}` }]] : [])
    ]
  };

  if (isCallback && ctx.callbackQuery && ctx.callbackQuery.message) {
    try {
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        ctx.callbackQuery.message.message_id,
        undefined,
        messageText,
        { parse_mode: "Markdown", reply_markup: buttons }
      );
      return;
    } catch {
      // Mesaj değişmemişse yoksay
    }
  }

  await ctx.reply(messageText, { parse_mode: "Markdown", reply_markup: buttons });
}

async function downloadFile(ctx: Context, fileId: string, ext: string): Promise<string> {
  const fileInfo = await ctx.telegram.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${config.telegram.botToken}/${fileInfo.file_path}`;
  const localPath = path.join(os.tmpdir(), `${fileId}${ext}`);
  const response = await axios.get(fileUrl, { responseType: "arraybuffer", timeout: 60_000 });
  fs.writeFileSync(localPath, Buffer.from(response.data as ArrayBuffer));
  console.log(`[Bot] İndirildi: ${localPath}`);
  return localPath;
}

async function editMsg(ctx: Context, msgId: number, text: string): Promise<void> {
  try {
    await ctx.telegram.editMessageText(ctx.chat!.id, msgId, undefined, text, {
      parse_mode: "Markdown",
    });
  } catch {
    /* mesaj değişmemişse Telegram hata fırlatır — görmezden gel */
  }
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
