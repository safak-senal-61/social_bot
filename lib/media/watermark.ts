// lib/media/watermark.ts
import sharp from "sharp";
import fs from "fs";
import path from "path";

export const CUSTOM_LOGO_DIR = path.join(process.cwd(), "public", "uploads");
export const CUSTOM_LOGO_PATH = path.join(CUSTOM_LOGO_DIR, "custom_logo.png");
export const LEGACY_LOGO_PATH = path.join(process.cwd(), "public", "logo.png");

export function getCustomLogoPath(): string | null {
  if (fs.existsSync(CUSTOM_LOGO_PATH)) return CUSTOM_LOGO_PATH;
  if (fs.existsSync(LEGACY_LOGO_PATH)) return LEGACY_LOGO_PATH;
  return null;
}

/**
 * Şık, modern koyu cam (dark frosted glass) rozet SVG şablonu üretir.
 * Tipografi: Modern sans-serif, zarif harf aralığı ve kurumsal iş platformu tasarımı.
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function getWatermarkBadgeSvg(
  badgeWidth = 260,
  badgeHeight = 64,
  brandText = "Günübirlik",
  subtitle = "GÜNLÜK İŞ & ELEMAN"
): string {
  const cleanBrand = escapeXml(brandText.trim() || "Günübirlik");
  const cleanSubtitle = escapeXml(subtitle.trim() || "GÜNLÜK İŞ & ELEMAN");

  return `
    <svg width="${badgeWidth}" height="${badgeHeight}" viewBox="0 0 260 64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Koyu cam zemin gradyanı -->
        <linearGradient id="bgGlass" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0b1417" stop-opacity="0.92"/>
          <stop offset="100%" stop-color="#142429" stop-opacity="0.88"/>
        </linearGradient>

        <!-- Lüks metalik çerçeve gradyanı -->
        <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#78cfc3" stop-opacity="0.6"/>
          <stop offset="50%" stop-color="#ffffff" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#5bb8ac" stop-opacity="0.5"/>
        </linearGradient>

        <!-- Monogram amblem gradyanı -->
        <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5bb8ac"/>
          <stop offset="100%" stop-color="#2d7a70"/>
        </linearGradient>

        <!-- Yumuşak gölge -->
        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.55"/>
        </filter>
      </defs>

      <!-- Ana Kapsül Rozet -->
      <rect x="2" y="2" width="256" height="60" rx="30" fill="url(#bgGlass)" stroke="url(#borderGrad)" stroke-width="1.5" filter="url(#softGlow)"/>

      <!-- Sol Logo/Monogram İkonu Dairesi -->
      <circle cx="32" cy="32" r="18" fill="url(#brandGrad)"/>
      
      <!-- Geometrik Modern 'G' Monogramı & İş Gücü Şimşeği -->
      <path d="M37 26.5 H30 C26.5 26.5 24 29 24 32 C24 35 26.5 37.5 30 37.5 H36 V32 H31.5" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="36" cy="24" r="2.2" fill="#d9bf8c"/>

      <!-- Marka Adı (Şık Tipografi) -->
      <text x="59" y="31" font-family="'Plus Jakarta Sans', 'Montserrat', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#ffffff" letter-spacing="0.8px">
        ${cleanBrand}
      </text>

      <!-- Alt Başlık / Slogan -->
      <text x="59.5" y="44" font-family="'Plus Jakarta Sans', 'Montserrat', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="8.5" font-weight="700" fill="#93a6aa" letter-spacing="1.4px">
        ${cleanSubtitle}
      </text>

      <!-- Sağ Uç Durum Göstergesi (Aktif İş Platformu Işığı) -->
      <circle cx="236" cy="32" r="4.5" fill="#5bb8ac"/>
      <circle cx="236" cy="32" r="2" fill="#ffffff"/>
    </svg>
  `;
}

export async function applyWatermark(
  imagePath: string,
  brandText = "Günübirlik"
): Promise<string> {
  const outputPath = imagePath.replace(/\.[^.]+$/, "_wm.jpg");
  const logoPath = getCustomLogoPath();

  const image = sharp(imagePath);
  const metadata = await image.metadata();
  const width = metadata.width || 1080;
  const height = metadata.height || 1080;

  // Filigran genişliğini görselin boyutuna göre orantıla (%24 - %30 arası)
  const watermarkWidth = Math.max(200, Math.min(360, Math.round(width * 0.26)));
  const watermarkHeight = Math.round(watermarkWidth * (64 / 260));

  let overlayBuffer: Buffer;

  if (logoPath && fs.existsSync(logoPath)) {
    try {
      // Kullanıcının yüklediği özel logo varsa:
      // Logonun en-boy oranını bozmadan şık bir drop-shadow ile boyutlandır
      const logoMeta = await sharp(logoPath).metadata();
      const logoAspect = (logoMeta.width || 1) / (logoMeta.height || 1);
      
      const resizedWidth = watermarkWidth;
      const resizedHeight = Math.round(resizedWidth / logoAspect);

      // Koyu yarı saydam bir rozet zemin üzerine logoyu oturt (kontrast ve her arka planda okunurluk için)
      const badgePadding = Math.round(resizedHeight * 0.2);
      const containerWidth = resizedWidth + badgePadding * 2;
      const containerHeight = resizedHeight + badgePadding * 2;

      const logoBuffer = await sharp(logoPath)
        .resize({ width: resizedWidth, height: resizedHeight, fit: "inside" })
        .toBuffer();

      const bgSvg = `
        <svg width="${containerWidth}" height="${containerHeight}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${containerWidth}" height="${containerHeight}" rx="${Math.round(containerHeight * 0.3)}" fill="rgba(11, 20, 23, 0.85)" stroke="rgba(255, 255, 255, 0.2)" stroke-width="1.5"/>
        </svg>
      `;

      overlayBuffer = await sharp(Buffer.from(bgSvg))
        .composite([
          {
            input: logoBuffer,
            gravity: "center",
          },
        ])
        .png()
        .toBuffer();
    } catch (err) {
      console.warn("[Watermark] Özel logo işlenemedi, rozet şablonu kullanılıyor:", err);
      const svgBadge = getWatermarkBadgeSvg(watermarkWidth, watermarkHeight, brandText);
      overlayBuffer = Buffer.from(svgBadge);
    }
  } else {
    // Özel logo yoksa: Ultra şık 'Günübirlik' koyu cam rozet SVG şablonu
    const svgBadge = getWatermarkBadgeSvg(watermarkWidth, watermarkHeight, brandText);
    overlayBuffer = Buffer.from(svgBadge);
  }

  // Sağ alt köşeye %3 kenar payıyla yerleştir
  const margin = Math.round(width * 0.035);
  const left = width - watermarkWidth - margin;
  const top = height - watermarkHeight - margin;

  await sharp(imagePath)
    .composite([
      {
        input: overlayBuffer,
        top: Math.max(0, top),
        left: Math.max(0, left),
      },
    ])
    .toFile(outputPath);

  console.log(`[Watermark] ✅ Filigran eklendi: ${outputPath}`);
  return outputPath;
}
