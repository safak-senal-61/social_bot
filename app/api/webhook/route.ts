import { withApiLog } from "@/lib/api/with_log";
// app/api/webhook/route.ts
// Telegram webhook endpoint — Next.js App Router API Route
//
// Telegram bu URL'ye POST isteği gönderir.
// Güvenlik: X-Telegram-Bot-Api-Secret-Token header ile doğrulanır.

import { NextRequest, NextResponse } from "next/server";
import { getBot } from "@/lib/telegram/bot";
import { config } from "@/lib/config";

// Next.js'e bu route'un edge runtime DEĞİL Node.js runtime kullandığını belirt
// (Sharp ve fs modülleri Edge Runtime'da çalışmaz)
export const runtime = "nodejs";

async function POSTHandler(req: NextRequest) {
  // ── Güvenlik: Secret token doğrulama ────────────────────────────────────────
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  if (secretHeader !== config.telegram.secretToken) {
    console.warn("[Webhook] Geçersiz secret token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    await getBot().handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Webhook] Update işleme hatası:", err);
    // Telegram'a 200 döndür — aksi hâlde aynı mesajı tekrar gönderir
    return NextResponse.json({ ok: true });
  }
}

// GET isteği: webhook durumu kontrolü için
async function GETHandler() {
  return NextResponse.json({
    status: "running",
    bot: "Social Poster Bot",
    timestamp: new Date().toISOString(),
  });
}

export const POST = withApiLog("webhook", POSTHandler);
export const GET = withApiLog("webhook", GETHandler);
