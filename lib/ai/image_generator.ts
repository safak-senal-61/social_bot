// lib/ai/image_generator.ts
// Tamamen ÜCRETSİZ Yüksek Kaliteli Yapay Zeka Görsel & Başlık Üretici
// Model: black-forest-labs/FLUX.1-schnell (Hugging Face Spaces üzerinden 1024x1024 kristal netlikte, filigransız)

import dns from "dns";
// Node.js Windows IPv6 bağlantı gecikmesini / timeout'unu engellemek için
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}

import fs from "fs";
import path from "path";
import os from "os";
import axios from "axios";
import { Client } from "@gradio/client";
import { applyWatermark } from "@/lib/media/watermark";
import { mediaProcessor } from "@/lib/media/processor";
import { config } from "@/lib/config";

export interface GeneratedAiPost {
  imagePath: string;
  caption: string;
  prompt: string;
  format: "feed" | "story";
}

export class FreeAiGenerator {
  /**
   * Kullanıcının verdiği Türkçe veya İngilizce prompt'a göre FLUX.1-schnell ile
   * fotogerçekçi, kristal netlikte 1024x1024 görsel (veya 9:16 Story) üretir,
   * ardından Türkçe başlık ve hashtag hazırlar.
   */
  async generatePost(
    userPrompt: string,
    format: "feed" | "story" = "feed",
    watermark = true
  ): Promise<GeneratedAiPost> {
    console.log(`[FreeAI] Görsel ve başlık üretimi başlatılıyor... Format: ${format}, Prompt: "${userPrompt}"`);

    // 1. Prompt'u FLUX.1 için görsel kalitesini ve detayları maksimize edecek şekilde İngilizce'ye çevir & zenginleştir
    const enhancedPrompt = await this.enhanceVisualPrompt(userPrompt, format);

    // 2. FLUX.1-schnell üzerinden görseli üret
    const rawImagePath = await this.generateFluxImage(enhancedPrompt);

    // 3. Format Story ise 1080x1920 dikey kanvasa dönüştür
    let formattedPath = rawImagePath;
    if (format === "story") {
      formattedPath = await mediaProcessor.optimizeForStory(rawImagePath);
      if (formattedPath !== rawImagePath && fs.existsSync(rawImagePath)) {
        try { fs.unlinkSync(rawImagePath); } catch {}
      }
    }

    // 4. İstenirse sadece kendi "Günübirlik" marka filigranını bas (yabancı logo/filigran YOKTUR)
    let finalImagePath = formattedPath;
    if (watermark && config.watermark.enabled) {
      finalImagePath = await applyWatermark(formattedPath, config.watermark.text);
      if (formattedPath !== finalImagePath && fs.existsSync(formattedPath)) {
        try { fs.unlinkSync(formattedPath); } catch {}
      }
    }

    // 5. Eş zamanlı veya hemen ardından etkileyici Türkçe başlık ve hashtag üret
    const caption = await this.generateCaption(userPrompt);

    console.log(`[FreeAI] ✅ Başarıyla tamamlandı! Dosya: ${finalImagePath}`);
    return {
      imagePath: finalImagePath,
      caption,
      prompt: userPrompt,
      format,
    };
  }

  /**
   * FLUX.1-schnell modelini Gradio client üzerinden çalıştırır ve görseli yerel diske kaydeder.
   * Tamamen ücretsizdir, API anahtarı istemez, filigran basmaz.
   */
  private async generateFluxImage(prompt: string): Promise<string> {
    console.log(`[FreeAI] 🚀 FLUX.1-schnell ile görsel çiziliyor... Prompt: "${prompt}"`);
    const tempDir = os.tmpdir();
    const outputPath = path.join(tempDir, `flux_${Date.now()}_raw.jpg`);

    try {
      const client = await Client.connect("black-forest-labs/FLUX.1-schnell");
      const result: any = await client.predict("/infer", {
        prompt,
        seed: Math.floor(Math.random() * 1000000),
        randomize_seed: true,
        width: 1024,
        height: 1024,
        num_inference_steps: 4,
      });

      const imageUrl = result?.data?.[0]?.url;
      if (!imageUrl) {
        throw new Error("Gradio FLUX yanıtında görsel URL bulunamadı");
      }

      console.log(`[FreeAI] FLUX görseli üretildi, indiriliyor: ${imageUrl}`);
      const downloadRes = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 60_000,
      });

      fs.writeFileSync(outputPath, Buffer.from(downloadRes.data));
      return outputPath;
    } catch (err: any) {
      console.error("[FreeAI] FLUX.1-schnell hatası, fallback deneniyor:", err.message);

      // Fallback: Hugging Face alternatif açık Space veya Pollinations flux
      return await this.fallbackImageDownload(prompt, outputPath);
    }
  }

  /**
   * Beklenmedik bağlantı kopmalarında kesintisiz çalışmayı garanti eden yedek görsel kanalı
   */
  private async fallbackImageDownload(prompt: string, targetPath: string): Promise<string> {
    const seed = Math.floor(Math.random() * 9999999);
    const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt
    )}?width=1024&height=1024&model=flux&nologo=true&seed=${seed}`;

    console.log(`[FreeAI] Yedek kanal üzerinden görsel alınıyor...`);
    const response = await axios.get(fallbackUrl, {
      responseType: "arraybuffer",
      timeout: 60_000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    fs.writeFileSync(targetPath, Buffer.from(response.data));
    return targetPath;
  }

  /**
   * Verilen konuyu/prompt'u görsel modeli için profesyonel fotoğrafçılık detaylarıyla İngilizceye zenginleştirir.
   */
  private async enhanceVisualPrompt(prompt: string, format: "feed" | "story"): Promise<string> {
    try {
      const instructions = `You are an expert prompt engineer for FLUX.1 photorealistic image model.
Translate and expand the following user request into a concise 30-50 word ENGLISH prompt.
Focus on: photorealistic travel photography, authentic Turkey scenery, stunning atmospheric golden hour lighting, cinematic composition, award-winning National Geographic style, ultra-detailed 8k.
CRITICAL: Output ONLY the English prompt, no quotes, no markdown, no introductions.
User request: "${prompt}"`;

      const res = await axios.post(
        "https://text.pollinations.ai/",
        {
          messages: [{ role: "user", content: instructions }],
          model: "openai",
          temperature: 0.7,
        },
        { timeout: 15_000 }
      );

      const enhanced = typeof res.data === "string" ? res.data.trim() : res.data?.choices?.[0]?.message?.content?.trim();
      if (enhanced && enhanced.length > 15) {
        return `${enhanced}, ultra realistic 8k photography, cinematic lighting, national geographic travel photo, vibrant natural colors, masterwork, highly detailed`;
      }
    } catch (err) {
      console.warn("[FreeAI] enhanceVisualPrompt fallback kullanılıyor:", err);
    }

    // Doğrudan zenginleştirilmiş İngilizce fallback
    return `Breathtaking professional travel photography of ${prompt}, authentic landscape, cinematic golden hour light, ultra realistic 8k, award winning national geographic photo, highly detailed, masterwork`;
  }

  /**
   * Konuya göre sosyal medya için hazır Türkçe başlık ve popüler etiketler üretir.
   */
  async generateCaption(prompt: string): Promise<string> {
    try {
      const instructions = `Sen "Günübirlik" isimli popüler bir sosyal medya ve seyahat platformunun içerik yöneticisisin.
Konu: "${prompt}"
Lütfen bu görsel/konu için Instagram ve Facebook'ta yüksek etkileşim alacak harika bir paylaşım metni oluştur:
1. Türkçe olsun.
2. 2-3 samimi, ilham verici ve merak uyandıran cümle içersin.
3. Sonuna konuyla uyumlu 5-7 popüler etiket (#günübirlik #keşfet #gezi #seyahat #doğa vb.) ekle.
4. Sadece doğrudan paylaşılacak gönderi metnini ver, başka hiçbir giriş/çıkış lafı yazma.`;

      const res = await axios.post(
        "https://text.pollinations.ai/",
        {
          messages: [{ role: "user", content: instructions }],
          model: "openai",
          temperature: 0.8,
        },
        { timeout: 15_000 }
      );

      const text = typeof res.data === "string" ? res.data.trim() : res.data?.choices?.[0]?.message?.content?.trim();
      if (text && text.length > 20) {
        return text;
      }
    } catch (err) {
      console.warn("[FreeAI] generateCaption fallback kullanılıyor:", err);
    }

    // Fallback şablon
    return `Hayatın koşturmacasına kısa bir mola verip yollara düşmenin tam zamanı! Yeni rotalar, keşfedilmeyi bekleyen eşsiz manzaralar ve unutulmaz anlar için takipte kalın. ✨🌿\n\n#günübirlik #gezi #keşfet #seyahat #doğa #huzur #tatil`;
  }

  /**
   * Türkçe başlığı İngilizce'ye çevirip uluslararası seyahat etiketleri ekler (Multi-Language).
   */
  async translateToEnglish(turkishText: string): Promise<string> {
    try {
      const instructions = `Translate this Turkish social media post to natural, engaging English for international travelers.
Add 4-5 popular travel hashtags like #travelturkey #explore #daytrip #wanderlust at the end.
Only output the English translation with hashtags, no other comments:
"${turkishText}"`;

      const res = await axios.post(
        "https://text.pollinations.ai/",
        {
          messages: [{ role: "user", content: instructions }],
          model: "openai",
          temperature: 0.6,
        },
        { timeout: 15_000 }
      );

      const enText = typeof res.data === "string" ? res.data.trim() : res.data?.choices?.[0]?.message?.content?.trim();
      if (enText && enText.length > 10) {
        return `${turkishText}\n\n─── 🇬🇧 English ───\n${enText}`;
      }
    } catch (err) {
      console.warn("[FreeAI] Çeviri hatası:", err);
    }

    return `${turkishText}\n\n─── 🇬🇧 English ───\nTake a break and explore the breathtaking beauty of Turkey! Adventure and peace awaits. ✨\n\n#travelturkey #explore #daytrip #nature #holiday`;
  }
}

export const freeAiGenerator = new FreeAiGenerator();
