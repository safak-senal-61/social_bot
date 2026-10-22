// app/api/logs/route.ts
import { NextResponse } from "next/server";
import { getSystemLogs, clearSystemLogs, logEvent } from "@/lib/storage/logger";
import type { LogLevel } from "@/lib/storage/logger";
import { readHeartbeat } from "@/lib/storage/heartbeat";
import { summarizeLogs } from "@/lib/storage/log_analysis";

const LEVELS: LogLevel[] = ["info", "success", "warn", "error"];
const MAX_MESSAGE = 600;
const MAX_FIELD = 4000;

export async function GET(req?: Request) {
  const logs = getSystemLogs();
  const bot = readHeartbeat();
  const serverTime = new Date().toISOString();

  // Menüdeki rozet için hafif yanıt: kayıt listesini taşımadan yalnızca özet
  const summaryOnly = req ? new URL(req.url).searchParams.get("summary") === "1" : false;
  if (summaryOnly) {
    return NextResponse.json({ success: true, summary: summarizeLogs(logs), bot, serverTime });
  }

  return NextResponse.json({ success: true, logs, bot, serverTime });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.action === "clear") {
      clearSystemLogs();
      return NextResponse.json({ success: true, message: "Loglar temizlendi." });
    }

    if (body.action === "test") {
      logEvent("info", "web", "Debug sayfasından test kaydı gönderildi.");
      logEvent("warn", "web", "Bu bir test uyarısıdır.");
      logEvent("error", "web", "Bu bir test hatasıdır (gerçek bir sorun değil).");
      return NextResponse.json({ success: true, message: "Test kayıtları oluşturuldu." });
    }

    // Tarayıcıda oluşan hatalar (yakalanmamış JS hataları, başarısız fetch çağrıları)
    if (body.action === "client") {
      if (typeof body.message !== "string" || !body.message.trim()) {
        return NextResponse.json({ success: false, error: "Mesaj gerekli." }, { status: 400 });
      }
      const level: LogLevel = LEVELS.includes(body.level) ? body.level : "error";
      logEvent(
        level,
        "client",
        body.message.slice(0, MAX_MESSAGE),
        typeof body.details === "string" ? body.details.slice(0, MAX_FIELD) : undefined,
        { stack: typeof body.stack === "string" ? body.stack.slice(0, MAX_FIELD) : undefined }
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Bilinmeyen eylem." }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
