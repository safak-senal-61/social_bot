// scripts/run-bot.ts
// Telegram Botunu doğrudan Polling (Doğrudan Dinleme) modunda çalıştırır.
// Hiçbir ngrok, tünel veya webhook URL'i gerektirmez!

import { config, loadEnvFromFile } from "../lib/config";
import { getBot } from "../lib/telegram/bot";
import { startSchedulerWorker, stopSchedulerWorker } from "../lib/scheduler/worker";
import { logEvent, captureError } from "../lib/storage/logger";
import { writeHeartbeat, HEARTBEAT_INTERVAL_MS } from "../lib/storage/heartbeat";

// Bu süreçte yazılan tüm loglar debug sayfasında "bot" olarak etiketlenir
process.env.LOG_ORIGIN = "bot";

process.on("unhandledRejection", (reason) => {
  captureError("system", "Bot: yakalanmamış Promise hatası", reason);
});
process.on("uncaughtException", (err) => {
  captureError("system", "Bot: yakalanmamış istisna", err);
});

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

    logEvent("success", "system", `Bot başlatıldı: @${botInfo.username}`, { pid: process.pid });
    writeHeartbeat({ pid: process.pid });
    setInterval(() => writeHeartbeat({ pid: process.pid }), HEARTBEAT_INTERVAL_MS).unref();

    // Zamanlayıcı servisini başlat
    startSchedulerWorker();

    await bot.launch();
  } catch (err) {
    captureError("system", "Bot başlatılamadı", err);
    console.error("❌ Bot başlatma hatası:", err);
  }

  // Graceful stop
  process.once("SIGINT", () => {
    stopSchedulerWorker();
    bot.stop("SIGINT");
  });
  process.once("SIGTERM", () => {
    stopSchedulerWorker();
    bot.stop("SIGTERM");
  });
}

main();
