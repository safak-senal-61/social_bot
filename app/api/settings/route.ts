import { withApiLog } from "@/lib/api/with_log";
// app/api/settings/route.ts
import { NextResponse } from "next/server";
import { loadEnvFromFile, saveEnvToFile } from "@/lib/config";
import { resetBot } from "@/lib/telegram/bot";

async function GETHandler() {
  try {
    const env = loadEnvFromFile();

    // Hassas verileri kısmi maskeli veya doğrudan frontend için hazırla
    return NextResponse.json({
      success: true,
      settings: {
        telegramBotToken: env.TELEGRAM_BOT_TOKEN || "",
        allowedUserIds: env.ALLOWED_USER_IDS || "",
        fbAppId: env.FB_APP_ID || "",
        fbAppSecret: env.FB_APP_SECRET || "",
        fbPageId: env.FB_PAGE_ID || "",
        fbPageAccessToken: env.FB_PAGE_ACCESS_TOKEN || "",
        igUserId: env.IG_USER_ID || "",
        linkedinAccessToken: env.LINKEDIN_ACCESS_TOKEN || "",
        linkedinOrganizationId: env.LINKEDIN_ORGANIZATION_ID || "",
        cloudinaryCloudName: env.CLOUDINARY_CLOUD_NAME || "",
        cloudinaryApiKey: env.CLOUDINARY_API_KEY || "",
        cloudinaryApiSecret: env.CLOUDINARY_API_SECRET || "",
        appUrl: env.NEXT_PUBLIC_APP_URL || "",
        geminiApiKey: env.GEMINI_API_KEY || "",
        watermarkEnabled: env.WATERMARK_ENABLED !== "false",
        watermarkText: env.WATERMARK_TEXT || "Günübirlik",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

async function POSTHandler(req: Request) {
  try {
    const body = await req.json();

    const envUpdates: Record<string, string> = {
      TELEGRAM_BOT_TOKEN: body.telegramBotToken?.trim() || "",
      ALLOWED_USER_IDS: body.allowedUserIds?.trim() || "",
      FB_APP_ID: body.fbAppId?.trim() || "",
      FB_APP_SECRET: body.fbAppSecret?.trim() || "",
      FB_PAGE_ID: body.fbPageId?.trim() || "",
      FB_PAGE_ACCESS_TOKEN: body.fbPageAccessToken?.trim() || "",
      IG_USER_ID: body.igUserId?.trim() || "",
      LINKEDIN_ACCESS_TOKEN: body.linkedinAccessToken?.trim() || "",
      LINKEDIN_ORGANIZATION_ID: body.linkedinOrganizationId?.trim() || "",
      CLOUDINARY_CLOUD_NAME: body.cloudinaryCloudName?.trim() || "",
      CLOUDINARY_API_KEY: body.cloudinaryApiKey?.trim() || "",
      CLOUDINARY_API_SECRET: body.cloudinaryApiSecret?.trim() || "",
      NEXT_PUBLIC_APP_URL: body.appUrl?.trim() || "",
      GEMINI_API_KEY: body.geminiApiKey?.trim() || "",
      WATERMARK_ENABLED: body.watermarkEnabled === false ? "false" : "true",
      WATERMARK_TEXT: body.watermarkText?.trim() || "Günübirlik",
    };

    saveEnvToFile(envUpdates);
    resetBot(); // Bot instance'ını sıfırla ki yeni token ile başlasın

    return NextResponse.json({
      success: true,
      message: "Ayarlar başarıyla kaydedildi ve güncellendi!",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withApiLog("settings", GETHandler);
export const POST = withApiLog("settings", POSTHandler);
