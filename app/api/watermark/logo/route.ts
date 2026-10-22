import { withApiLog } from "@/lib/api/with_log";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import {
  CUSTOM_LOGO_DIR,
  CUSTOM_LOGO_PATH,
  LEGACY_LOGO_PATH,
  getCustomLogoPath,
} from "@/lib/media/watermark";

async function GETHandler() {
  try {
    const logoPath = getCustomLogoPath();
    if (logoPath && fs.existsSync(logoPath)) {
      const stats = fs.statSync(logoPath);
      const isCustom = logoPath === CUSTOM_LOGO_PATH;
      const logoUrl = isCustom
        ? `/uploads/custom_logo.png?v=${stats.mtimeMs}`
        : `/logo.png?v=${stats.mtimeMs}`;

      return NextResponse.json({
        success: true,
        hasLogo: true,
        logoUrl,
        filename: path.basename(logoPath),
      });
    }

    return NextResponse.json({
      success: true,
      hasLogo: false,
      logoUrl: null,
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
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Lütfen bir logo görseli seçin." },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "Yüklenen dosya geçerli bir görsel olmalıdır." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!fs.existsSync(CUSTOM_LOGO_DIR)) {
      fs.mkdirSync(CUSTOM_LOGO_DIR, { recursive: true });
    }

    // Logo görselini sharp ile optimize edip şeffaf PNG olarak kaydet
    await sharp(buffer)
      .resize({
        width: 800,
        height: 800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png({ quality: 90 })
      .toFile(CUSTOM_LOGO_PATH);

    return NextResponse.json({
      success: true,
      message: "Özel logo başarıyla yüklendi ve filigran olarak ayarlandı!",
      logoUrl: `/uploads/custom_logo.png?v=${Date.now()}`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Logo yükleme hatası: ${String(error)}` },
      { status: 500 }
    );
  }
}

async function DELETEHandler() {
  try {
    let deleted = false;
    if (fs.existsSync(CUSTOM_LOGO_PATH)) {
      fs.unlinkSync(CUSTOM_LOGO_PATH);
      deleted = true;
    }
    if (fs.existsSync(LEGACY_LOGO_PATH)) {
      fs.unlinkSync(LEGACY_LOGO_PATH);
      deleted = true;
    }

    return NextResponse.json({
      success: true,
      message: deleted
        ? "Özel logo silindi. Standart şık şablon rozet kullanılacak."
        : "Silinecek özel logo bulunamadı.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export const GET = withApiLog("watermark/logo", GETHandler);
export const POST = withApiLog("watermark/logo", POSTHandler);
export const DELETE = withApiLog("watermark/logo", DELETEHandler);
