// app/api/setup-webhook/route.ts
// Telegram webhook kayıt endpoint'i
// GET /api/setup-webhook?url=https://your-app.vercel.app ile çağırın

import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const appUrl = req.nextUrl.searchParams.get("url") ??
    process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    return NextResponse.json(
      { error: "url parametresi gerekli: ?url=https://your-app.vercel.app" },
      { status: 400 }
    );
  }

  const webhookUrl = `${appUrl}/api/webhook`;

  const response = await fetch(
    `https://api.telegram.org/bot${config.telegram.botToken}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: config.telegram.secretToken,
        allowed_updates: ["message"],
        drop_pending_updates: true,
      }),
    }
  );

  const result = await response.json();
  console.log("[SetupWebhook] Telegram yanıtı:", result);

  return NextResponse.json({
    webhookUrl,
    telegramResponse: result,
  });
}
