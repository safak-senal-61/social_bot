// scripts/run-bot.ts
// Telegram Botunu doğrudan Polling (Doğrudan Dinleme) modunda çalıştırır.
// Hiçbir ngrok, tünel veya webhook URL'i gerektirmez!

import { config, loadEnvFromFile } from "../lib/config";
import { getBot } from "../lib/telegram/bot";

async function main() {
  loadEnvFromFile();

  console.log("==========================================");
  console.log("🤖 Social Poster Bot Başlatılıyor...");
  console.log("==========================================");

  if (!config.telegram.botToken) {
    console.error("❌ Hata: Telegram Bot Token bulunamadı!");
    process.exit(1);
  }

  const bot = getBot();

  try {
    // Önce varsa eski webhook'u kaldır ki polling ile çakışmasın
    await bot.telegram.deleteWebhook({ drop_pending_updates: false });
    console.log("✅ Webhook temizlendi, Polling moduna geçiliyor...");

    const botInfo = await bot.telegram.getMe();
    console.log(`🚀 BOT ÇALIŞIYOR: @${botInfo.username} (${botInfo.first_name})`);
    console.log(`👤 Yetkili ID: ${config.telegram.allowedUserIds.join(", ") || "Herkese Açık"}`);
    console.log(`👍 Facebook Sayfa ID: ${config.facebook.pageId || "Yapılandırılmadı"}`);
    console.log("==========================================");
    console.log("📲 Şimdi Telegram'dan botunuza mesaj veya fotoğraf gönderebilirsiniz!");

    await bot.launch();
  } catch (err) {
    console.error("❌ Bot başlatma hatası:", err);
  }

  // Graceful stop
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

main();
