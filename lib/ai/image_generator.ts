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
   * Günübirlik iş alma & iş verme platformuna uygun ticari iş gücü, usta, personel ve çalışma anı görselleri üretir.
   */
  private async enhanceVisualPrompt(prompt: string, format: "feed" | "story"): Promise<string> {
    try {
      const instructions = `You are an expert commercial prompt engineer for FLUX.1 photorealistic image model.
You are generating visuals for "Günübirlik", an on-demand daily labor, gig work, craftsmanship and local job recruitment platform in Turkey (daily jobs like construction workers, craftsmen, waiters, baristas, cleaning staff, couriers, warehouse workers, movers, event staff).

Translate and expand the following user request into a concise 30-50 word ENGLISH prompt.
Focus on: authentic, dynamic, professional commercial photography, skilled daily worker in action, modern workplace in Turkey, crisp natural lighting, realistic work clothes or uniforms, clean candid shot, vibrant natural colors, ultra realistic 8k, masterwork, high quality recruitment advertisement visual.
NO cartoon, NO 3D render, NO tourist landscapes.
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
        return `${enhanced}, ultra realistic 8k photography, commercial job recruitment photo, authentic Turkish daily worker in action, clean composition, cinematic lighting, masterwork, highly detailed`;
      }
    } catch (err) {
      console.warn("[FreeAI] enhanceVisualPrompt fallback kullanılıyor:", err);
    }

    // Doğrudan zenginleştirilmiş İngilizce fallback (Günübirlik iş & çalışma temalı)
    return `Professional commercial photography of skilled daily workers for ${prompt}, authentic modern workplace, candid action shot, clean natural lighting, ultra realistic 8k, sharp focus, highly detailed recruitment visual`;
  }

  /**
   * Konuya göre sosyal medya için hazır Türkçe başlık ve popüler etiketler üretir (Günübirlik iş ilanları & duyurular).
   */
  async generateCaption(prompt: string): Promise<string> {
    try {
      const instructions = `Sen "Günübirlik" isimli günübirlik iş alma, iş verme ve yevmiyeli çalışma platformunun sosyal medya içerik yöneticisisin.
Konu / İş İlanı: "${prompt}"
Lütfen bu görsel ve konu için Instagram, Facebook ve LinkedIn'de iş arayanların ve işverenlerin dikkatini çekecek profesyonel, güven veren ve harekete geçiren Türkçe bir paylaşım metni oluştur:
1. Türkçe olsun.
2. İşin fırsatını, kazancını veya aciliyetini anlatan 2-3 etkileyici cümle içersin.
3. İlgilenenlerin başvurması veya ilan vermesi için net bir çağrı (CTA) ekle (Örn: "Hemen başvurmak veya detayları öğrenmek için DM atın ya da profilimizdeki linke tıklayın!").
4. Sonuna konuyla ve günübirlik iş konseptiyle uyumlu 5-7 popüler etiket (#günübirlik #işilanı #günlükiş #yevmiye #ekiş #elemanaranıyor #işfırsatı vb.) ekle.
5. Sadece doğrudan paylaşılacak gönderi metnini ver, başka hiçbir giriş/çıkış lafı yazma.`;

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

    // Fallback şablon (İş & Yevmiye Odaklı)
    return `Günübirlik iş fırsatları cebinizde! Günlük yevmiyeli işler, anlık eleman ihtiyaçları ve güvenilir kazanç fırsatları için Günübirlik yanınızda. Hemen başvurmak veya ilan vermek için bize DM'den ulaşabilirsiniz. 💼⚡\n\n#günübirlik #işilanı #günlükiş #yevmiye #ekiş #elemanaranıyor #işfırsatı #günlükkazanç`;
  }

  /**
   * Türkçe başlığı İngilizce'ye çevirip uluslararası iş & kariyer etiketleri ekler (Multi-Language).
   */
  async translateToEnglish(turkishText: string): Promise<string> {
    try {
      const instructions = `Translate this Turkish job announcement/daily work social media post to natural, professional English for international candidates and employers.
Add 4-5 relevant job & gig hashtags like #dailywork #jobopportunity #hiring #gigworker #parttimejob at the end.
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

    return `${turkishText}\n\n─── 🇬🇧 English ───\nLooking for daily work or urgent staff? Günübirlik connects you with flexible daily job opportunities and skilled workers instantly! Send a DM to apply or post a job. 💼\n\n#dailywork #jobopportunity #hiring #gigworkers #dailygigs`;
  }
}

export const freeAiGenerator = new FreeAiGenerator();
