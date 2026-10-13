// app/api/settings/route.ts
import { NextResponse } from "next/server";
import { loadEnvFromFile, saveEnvToFile } from "@/lib/config";
import { resetBot } from "@/lib/telegram/bot";

export async function GET() {
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
        cloudinaryCloudName: env.CLOUDINARY_CLOUD_NAME || "",
        cloudinaryApiKey: env.CLOUDINARY_API_KEY || "",
        cloudinaryApiSecret: env.CLOUDINARY_API_SECRET || "",
        appUrl: env.NEXT_PUBLIC_APP_URL || "",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
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
      CLOUDINARY_CLOUD_NAME: body.cloudinaryCloudName?.trim() || "",
      CLOUDINARY_API_KEY: body.cloudinaryApiKey?.trim() || "",
      CLOUDINARY_API_SECRET: body.cloudinaryApiSecret?.trim() || "",
      NEXT_PUBLIC_APP_URL: body.appUrl?.trim() || "",
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
