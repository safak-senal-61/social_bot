// lib/media/watermark.ts
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { config } from "../config";

export interface WatermarkOptions {
  brandText?: string;
  subtitle?: string;
  showText?: boolean;
  layout?: "pill" | "logo_only" | "text_only" | "minimal" | "pattern";
  size?: "small" | "medium" | "large";
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left" | "center";
  opacity?: number; // 0 - 100
}

export function getCustomLogoDir(): string {
  return path.join(process.cwd(), "public", "uploads");
}

export function getCustomLogoPath(): string {
  return path.join(getCustomLogoDir(), "custom_logo.png");
}

export function getLegacyLogoPath(): string {
  return path.join(process.cwd(), "public", "logo.png");
}

export function findExistingLogoPath(): string | null {
  try {
    const custom = getCustomLogoPath();
    if (fs.existsSync(custom)) return custom;
    const legacy = getLegacyLogoPath();
    if (fs.existsSync(legacy)) return legacy;
  } catch (err) {
    console.warn("[Watermark] Logo yolu arama hatası:", err);
  }
  return null;
}

export const CUSTOM_LOGO_DIR = path.join(process.cwd(), "public", "uploads");
export const CUSTOM_LOGO_PATH = path.join(CUSTOM_LOGO_DIR, "custom_logo.png");
export const LEGACY_LOGO_PATH = path.join(process.cwd(), "public", "logo.png");

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Şık, modern koyu cam (dark frosted glass) rozet SVG şablonu üretir.
 */
export function getWatermarkBadgeSvg(
  badgeWidth = 260,
  badgeHeight = 64,
  brandText = "Günübirlik",
  subtitle = "GÜNLÜK İŞ & ELEMAN",
  hasCustomLogo = false,
  showText = true,
  opacity = 90
): string {
  const cleanBrand = escapeXml(brandText.trim() || "Günübirlik");
  const cleanSubtitle = escapeXml(subtitle.trim() || "GÜNLÜK İŞ & ELEMAN");
  const alphaFactor = Math.min(1, Math.max(0.1, opacity / 100));

  // Sadece logo isteniyorsa kare/dairesel rozet
  if (!showText) {
    const size = Math.min(badgeWidth, badgeHeight);
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" opacity="${alphaFactor}">
        <defs>
          <linearGradient id="bgGlass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0b1417" stop-opacity="0.92"/>
            <stop offset="100%" stop-color="#142429" stop-opacity="0.88"/>
          </linearGradient>
          <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#78cfc3" stop-opacity="0.6"/>
            <stop offset="100%" stop-color="#5bb8ac" stop-opacity="0.5"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="url(#bgGlass)" stroke="url(#borderGrad)" stroke-width="1.5"/>
        ${
          !hasCustomLogo
            ? `
          <circle cx="32" cy="32" r="20" fill="linear-gradient(135deg, #5bb8ac 0%, #2d7a70 100%)"/>
          <path d="M37 26.5 H30 C26.5 26.5 24 29 24 32 C24 35 26.5 37.5 30 37.5 H36 V32 H31.5" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="36" cy="24" r="2.2" fill="#d9bf8c"/>
        `
            : ""
        }
      </svg>
    `;
  }

  // Yatay Kapsül Rozet
  return `
    <svg width="${badgeWidth}" height="${badgeHeight}" viewBox="0 0 260 64" xmlns="http://www.w3.org/2000/svg" opacity="${alphaFactor}">
      <defs>
        <linearGradient id="bgGlass" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0b1417" stop-opacity="0.94"/>
          <stop offset="100%" stop-color="#142429" stop-opacity="0.90"/>
        </linearGradient>

        <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#78cfc3" stop-opacity="0.65"/>
          <stop offset="50%" stop-color="#ffffff" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#5bb8ac" stop-opacity="0.5"/>
        </linearGradient>

        <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5bb8ac"/>
          <stop offset="100%" stop-color="#2d7a70"/>
        </linearGradient>

        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.55"/>
        </filter>
      </defs>

      <!-- Ana Kapsül Rozet -->
      <rect x="2" y="2" width="256" height="60" rx="30" fill="url(#bgGlass)" stroke="url(#borderGrad)" stroke-width="1.5" filter="url(#softGlow)"/>

      ${
        !hasCustomLogo
          ? `
        <!-- Sol Varsayılan Monogram Amblemi -->
        <circle cx="32" cy="32" r="18" fill="url(#brandGrad)"/>
        <path d="M37 26.5 H30 C26.5 26.5 24 29 24 32 C24 35 26.5 37.5 30 37.5 H36 V32 H31.5" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="36" cy="24" r="2.2" fill="#d9bf8c"/>
      `
          : `
        <!-- Özel logo için sol dairesel yuva arka planı -->
        <circle cx="32" cy="32" r="18" fill="rgba(255, 255, 255, 0.08)" stroke="rgba(120, 207, 195, 0.3)" stroke-width="1"/>
      `
      }

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

/**
 * Tüm görseli kaplayan hafif çapraz telif deseni SVG'si üretir.
 */
export function getPatternWatermarkSvg(
  width: number,
  height: number,
  brandText = "Günübirlik",
  opacity = 18
): string {
  const cleanBrand = escapeXml(brandText.trim() || "Günübirlik");
  const alpha = (Math.min(100, Math.max(5, opacity)) / 100) * 0.28;

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="wmPattern" width="220" height="120" patternTransform="rotate(-30)" patternUnits="userSpaceOnUse">
          <text x="20" y="40" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="800" fill="rgba(255, 255, 255, ${alpha})" letter-spacing="1px">
            ${cleanBrand}
          </text>
          <text x="20" y="55" font-family="'Plus Jakarta Sans', sans-serif" font-size="8" font-weight="700" fill="rgba(120, 207, 195, ${alpha})" letter-spacing="1.5px">
            GÜNLÜK İŞ &amp; ELEMAN
          </text>
        </pattern>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#wmPattern)"/>
    </svg>
  `;
}

export async function applyWatermark(
  imagePath: string,
  optionsOrBrandText?: string | WatermarkOptions
): Promise<string> {
  const outputPath = imagePath.replace(/\.[^.]+$/, "_wm.jpg");
  const logoPath = findExistingLogoPath();

  // Ayarları birleştir (fonksiyon parametresi öncelikli, yoksa config.watermark)
  const cfg = config.watermark;
  const opts: WatermarkOptions =
    typeof optionsOrBrandText === "string"
      ? { brandText: optionsOrBrandText }
      : optionsOrBrandText || {};

  const brandText = opts.brandText ?? cfg.text ?? "Günübirlik";
  const subtitle = opts.subtitle ?? cfg.subtitle ?? "GÜNLÜK İŞ & ELEMAN";
  const showText = opts.showText ?? cfg.showText ?? true;
  const layout = opts.layout ?? cfg.layout ?? "pill";
  const size = opts.size ?? cfg.size ?? "medium";
  const position = opts.position ?? cfg.position ?? "bottom-right";
  const opacity = opts.opacity ?? cfg.opacity ?? 90;

  const image = sharp(imagePath);
  const metadata = await image.metadata();
  const width = metadata.width || 1080;
  const height = metadata.height || 1080;

  // Çapraz desen modu istenmişse:
  if (layout === "pattern") {
    const patternSvg = getPatternWatermarkSvg(width, height, brandText, opacity);
    await sharp(imagePath)
      .composite([{ input: Buffer.from(patternSvg), top: 0, left: 0 }])
      .toFile(outputPath);
    console.log(`[Watermark] ✅ Çapraz desen filigran eklendi: ${outputPath}`);
    return outputPath;
  }

  // Boyut oranı hesapla (%18 küçük, %26 orta, %36 büyük)
  const sizeRatio = size === "small" ? 0.18 : size === "large" ? 0.36 : 0.26;
  const watermarkWidth = Math.max(160, Math.min(520, Math.round(width * sizeRatio)));
  const watermarkHeight = Math.round(watermarkWidth * (64 / 260));

  const hasCustomLogo = !!(logoPath && fs.existsSync(logoPath));
  let overlayBuffer: Buffer;

  // 1. Sadece Logo modu (veya showText === false)
  if (layout === "logo_only" || (!showText && hasCustomLogo)) {
    if (hasCustomLogo && logoPath) {
      const logoMeta = await sharp(logoPath).metadata();
      const logoAspect = (logoMeta.width || 1) / (logoMeta.height || 1);
      const iconSize = Math.max(64, Math.round(watermarkHeight * 1.3));
      const iconWidth = logoAspect >= 1 ? iconSize : Math.round(iconSize * logoAspect);
      const iconHeight = logoAspect >= 1 ? Math.round(iconSize / logoAspect) : iconSize;

      const logoBuffer = await sharp(logoPath)
        .resize({ width: iconWidth, height: iconHeight, fit: "inside" })
        .toBuffer();

      const badgePadding = Math.round(iconSize * 0.18);
      const containerW = iconWidth + badgePadding * 2;
      const containerH = iconHeight + badgePadding * 2;

      const bgSvg = `
        <svg width="${containerW}" height="${containerH}" xmlns="http://www.w3.org/2000/svg" opacity="${opacity / 100}">
          <rect width="${containerW}" height="${containerH}" rx="${Math.round(containerH * 0.3)}" fill="rgba(11, 20, 23, 0.9)" stroke="rgba(120, 207, 195, 0.5)" stroke-width="1.5"/>
        </svg>
      `;

      overlayBuffer = await sharp(Buffer.from(bgSvg))
        .composite([{ input: logoBuffer, gravity: "center" }])
        .png()
        .toBuffer();
    } else {
      const svgBadge = getWatermarkBadgeSvg(watermarkHeight, watermarkHeight, brandText, subtitle, false, false, opacity);
      overlayBuffer = Buffer.from(svgBadge);
    }
  }
  // 2. Minimal Şeffaf Rozet (Kutu yok, doğrudan logo ve şık metin)
  else if (layout === "minimal") {
    const svgBadge = `
      <svg width="${watermarkWidth}" height="${watermarkHeight}" viewBox="0 0 260 64" xmlns="http://www.w3.org/2000/svg" opacity="${opacity / 100}">
        <filter id="shadow">
          <feDropShadow dx="1" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.85"/>
        </filter>
        <text x="54" y="32" font-family="'Plus Jakarta Sans', sans-serif" font-size="17" font-weight="800" fill="#ffffff" filter="url(#shadow)" letter-spacing="0.8px">
          ${escapeXml(brandText)}
        </text>
        <text x="54.5" y="46" font-family="'Plus Jakarta Sans', sans-serif" font-size="8.5" font-weight="700" fill="#78cfc3" filter="url(#shadow)" letter-spacing="1.4px">
          ${escapeXml(subtitle)}
        </text>
      </svg>
    `;

    if (hasCustomLogo && logoPath) {
      const logoIconSize = Math.round(watermarkHeight * 0.65);
      const resizedLogo = await sharp(logoPath)
        .resize({ width: logoIconSize, height: logoIconSize, fit: "inside" })
        .toBuffer();

      overlayBuffer = await sharp(Buffer.from(svgBadge))
        .composite([{ input: resizedLogo, top: Math.round((watermarkHeight - logoIconSize) / 2), left: 6 }])
        .png()
        .toBuffer();
    } else {
      overlayBuffer = Buffer.from(svgBadge);
    }
  }
  // 3. Standart Yatay Kapsül Rozet (Pill - Hem Logo Hem Metin Şık Cam Rozet)
  else {
    const svgBadge = getWatermarkBadgeSvg(
      watermarkWidth,
      watermarkHeight,
      brandText,
      subtitle,
      hasCustomLogo,
      showText,
      opacity
    );

    if (hasCustomLogo && logoPath) {
      try {
        // Özel logoyu sol yuvaya (x=32, y=32 dairesi) şık şekilde yerleştir
        const iconBoxSize = Math.round(watermarkHeight * 0.58);
        const resizedLogo = await sharp(logoPath)
          .resize({ width: iconBoxSize, height: iconBoxSize, fit: "inside" })
          .toBuffer();

        // Sol yuvanın merkez konumu: sol kenardan ~12% içeride
        const logoLeft = Math.round(watermarkWidth * 0.05);
        const logoTop = Math.round((watermarkHeight - iconBoxSize) / 2);

        overlayBuffer = await sharp(Buffer.from(svgBadge))
          .composite([{ input: resizedLogo, top: logoTop, left: logoLeft }])
          .png()
          .toBuffer();
      } catch (err) {
        console.warn("[Watermark] Özel logo kapsüle yerleştirilemedi, SVG şablonu kullanılıyor:", err);
        overlayBuffer = Buffer.from(svgBadge);
      }
    } else {
      overlayBuffer = Buffer.from(svgBadge);
    }
  }

  // Overlay'in gerçek boyutlarını al
  const overlayMeta = await sharp(overlayBuffer).metadata();
  const actualW = overlayMeta.width || watermarkWidth;
  const actualH = overlayMeta.height || watermarkHeight;

  // Pozisyona göre koordinat hesapla
  const margin = Math.round(width * 0.03);
  let left = width - actualW - margin;
  let top = height - actualH - margin;

  if (position === "bottom-left") {
    left = margin;
    top = height - actualH - margin;
  } else if (position === "top-right") {
    left = width - actualW - margin;
    top = margin;
  } else if (position === "top-left") {
    left = margin;
    top = margin;
  } else if (position === "center") {
    left = Math.round((width - actualW) / 2);
    top = Math.round((height - actualH) / 2);
  }

  await sharp(imagePath)
    .composite([
      {
        input: overlayBuffer,
        top: Math.max(0, top),
        left: Math.max(0, left),
      },
    ])
    .toFile(outputPath);

  console.log(`[Watermark] ✅ Filigran eklendi (${position}, ${layout}, ${size}): ${outputPath}`);
  return outputPath;
}
