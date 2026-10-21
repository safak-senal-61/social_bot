// app/api/logs/route.ts
import { NextResponse } from "next/server";
import { getSystemLogs, clearSystemLogs, logEvent } from "@/lib/storage/logger";

export async function GET() {
  const logs = getSystemLogs();
  return NextResponse.json({ success: true, logs });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.action === "clear") {
      clearSystemLogs();
      return NextResponse.json({ success: true, message: "Loglar temizlendi." });
    }
    if (body.action === "test") {
      logEvent("info", "web", "Kullanıcı web panelinden test logu gönderdi.", { userAgent: "Next.js Web Panel" });
      logEvent("success", "api", "API bağlantı testi başarıyla tamamlandı.");
      return NextResponse.json({ success: true, message: "Test logları oluşturuldu." });
    }
    return NextResponse.json({ success: false, error: "Bilinmeyen eylem." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
