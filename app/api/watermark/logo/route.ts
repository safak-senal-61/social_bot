import { withApiLog } from "@/lib/api/with_log";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sharp from "sharp";

function getUploadsDir(): string {
  return path.join(process.cwd(), "public", "uploads");
}

function getLogoFilePath(): string {
  return path.join(getUploadsDir(), "custom_logo.png");
}

function getLegacyFilePath(): string {
  return path.join(process.cwd(), "public", "logo.png");
}

async function GETHandler() {
  try {
    const logoFile = getLogoFilePath();
    const legacyFile = getLegacyFilePath();

    if (fs.existsSync(logoFile)) {
      const stats = fs.statSync(logoFile);
      return NextResponse.json({
        success: true,
        hasLogo: true,
        logoUrl: `/uploads/custom_logo.png?v=${Math.round(stats.mtimeMs)}`,
        filename: "custom_logo.png",
      });
    }

    if (fs.existsSync(legacyFile)) {
      const stats = fs.statSync(legacyFile);
      return NextResponse.json({
        success: true,
        hasLogo: true,
        logoUrl: `/logo.png?v=${Math.round(stats.mtimeMs)}`,
        filename: "logo.png",
      });
    }

    return NextResponse.json({
      success: true,
      hasLogo: false,
      logoUrl: null,
    });
  } catch (error: any) {
    console.error("[Watermark Logo GET Error]:", error);
    return NextResponse.json(
      { success: false, error: String(error?.message || error) },
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

    if (!file.type || !file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "Yüklenen dosya geçerli bir görsel olmalıdır." },
        { status: 400 }
      );
    }

    const uploadsDir = getUploadsDir();
    const targetPath = getLogoFilePath();

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sharp ile resize & optimize et ve transparan PNG olarak kaydet
    await sharp(buffer)
      .resize({
        width: 800,
        height: 800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png({ quality: 90 })
      .toFile(targetPath);

    return NextResponse.json({
      success: true,
      message: "Özel logo başarıyla yüklendi ve filigran olarak ayarlandı!",
      logoUrl: `/uploads/custom_logo.png?v=${Date.now()}`,
    });
  } catch (error: any) {
    console.error("[Watermark Logo POST Error]:", error);
    return NextResponse.json(
      { success: false, error: `Logo yükleme hatası: ${String(error?.message || error)}` },
      { status: 500 }
    );
  }
}

async function DELETEHandler() {
  try {
    let deleted = false;
    const logoFile = getLogoFilePath();
    const legacyFile = getLegacyFilePath();

    if (fs.existsSync(logoFile)) {
      fs.unlinkSync(logoFile);
      deleted = true;
    }
    if (fs.existsSync(legacyFile)) {
      fs.unlinkSync(legacyFile);
      deleted = true;
    }

    return NextResponse.json({
      success: true,
      message: deleted
        ? "Özel logo silindi. Standart şık şablon rozet kullanılacak."
        : "Silinecek özel logo bulunamadı.",
    });
  } catch (error: any) {
    console.error("[Watermark Logo DELETE Error]:", error);
    return NextResponse.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}

export const GET = withApiLog("watermark/logo", GETHandler);
export const POST = withApiLog("watermark/logo", POSTHandler);
export const DELETE = withApiLog("watermark/logo", DELETEHandler);
