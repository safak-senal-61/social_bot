// app/api/autoreply/route.ts
import { NextResponse } from "next/server";
import { autoReplyEngine } from "@/lib/autoreply/engine";

export async function GET() {
  try {
    const rules = autoReplyEngine.getRules();
    const history = autoReplyEngine.getRepliedHistory();
    return NextResponse.json({
      success: true,
      rules,
      history,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.action === "trigger_check") {
      const stats = await autoReplyEngine.checkAndReplyRecentComments();
      return NextResponse.json({
        success: true,
        message: `Yorum kontrolü tamamlandı: ${stats.checked} yorum incelendi, ${stats.replied} yoruma otomatik yanıt yazıldı.`,
        stats,
      });
    }

    if (body.rules && Array.isArray(body.rules)) {
      autoReplyEngine.saveRules(body.rules);
      return NextResponse.json({
        success: true,
        message: "Otomatik yanıt kuralları başarıyla kaydedildi!",
        rules: autoReplyEngine.getRules(),
      });
    }

    return NextResponse.json({ success: false, error: "Geçersiz istek parametreleri" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
