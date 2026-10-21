// lib/media/watermark.ts
import sharp from "sharp";
import fs from "fs";
import path from "path";

export async function applyWatermark(imagePath: string, brandText = "Günübirlik"): Promise<string> {
  const outputPath = imagePath.replace(/\.[^.]+$/, "_wm.jpg");
  const logoPath = path.join(process.cwd(), "public", "logo.png");

  const image = sharp(imagePath);
  const metadata = await image.metadata();
  const width = metadata.width || 1080;
  const height = metadata.height || 1080;

  // Filigran genişliğini görselin %25'i civarında orantılı ayarla
  const watermarkWidth = Math.max(160, Math.min(300, Math.round(width * 0.28)));
  const watermarkHeight = Math.round(watermarkWidth * 0.28);

  let overlayBuffer: Buffer;

  if (fs.existsSync(logoPath)) {
    // Özel logo varsa onu orantılayıp kullan
    overlayBuffer = await sharp(logoPath)
      .resize({ width: watermarkWidth })
      .toBuffer();
  } else {
    // Şık, modern koyu cam (frosted glass) rozet SVG filigranı üret
    const svgBadge = `
      <svg width="${watermarkWidth}" height="${watermarkHeight}" viewBox="0 0 200 56" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ec4899" stop-opacity="0.9"/>
            <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.9"/>
          </linearGradient>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
          </filter>
        </defs>
        <rect x="2" y="2" width="196" height="52" rx="26" fill="rgba(15, 23, 42, 0.75)" stroke="rgba(255, 255, 255, 0.2)" stroke-width="1.5" filter="url(#shadow)"/>
        <circle cx="28" cy="28" r="14" fill="url(#grad)"/>
        <polygon points="24,20 34,28 24,36" fill="#ffffff"/>
        <text x="52" y="35" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff" letter-spacing="0.5">${brandText}</text>
      </svg>
    `;
    overlayBuffer = Buffer.from(svgBadge);
  }

  // Sağ alt köşeye 30px boşlukla yerleştir
  const margin = Math.round(width * 0.03); // %3 kenar payı
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
