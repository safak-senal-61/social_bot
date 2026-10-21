// lib/ai/caption.ts
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { config } from "@/lib/config";

export async function generateCaptionFromImage(imagePath: string, customContext = ""): Promise<string> {
  const apiKey = config.ai.geminiApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log("[AI] Gemini API Key bulunamadı, şablon başlık kullanılıyor.");
    return generateFallbackCaption(customContext);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const imageBytes = fs.readFileSync(imagePath);
    const base64Data = imageBytes.toString("base64");

    const prompt = `Sen profesyonel bir sosyal medya yöneticisisin. Bu görseli detaylı incele.
Instagram, Facebook ve LinkedIn için çok etkileyici, samimi ve dikkat çekici Türkçe bir paylaşım açıklaması yaz.
Kurallar:
1. Türkçe yaz.
2. 2-3 cümlelik akıcı, samimi bir metin oluştur.
3. Sonuna konuyla ve #günübirlik #gezi #kamp #keşfet #doğa #iş konseptiyle uyumlu 4-6 popüler hashtag ekle.
4. Başka hiçbir açıklama veya giriş cümlesi yazma, doğrudan paylaşılacak metni ver.
${customContext ? `Kullanıcının belirttiği özel bağlam: "${customContext}"` : ""}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Data,
              },
            },
          ],
        },
      ],
    });

    const caption = response.text?.trim();
    if (caption) {
      console.log("[AI] ✅ Yapay zeka başlığı üretildi:", caption.slice(0, 50) + "...");
      return caption;
    }
  } catch (err) {
    console.warn("[AI] Gemini API çağrısı başarısız oldu:", err);
  }

  return generateFallbackCaption(customContext);
}

function generateFallbackCaption(context = ""): string {
  const templates = [
    "Bugünden harika bir an! Yeni yerler keşfetmek, anın tadını çıkarmak ve günü dolu dolu yaşamak gibisi yok. ✨\n\n#günübirlik #keşfet #gezi #kamp #huzur #günaydın",
    "Günün en güzel karesi! Her adımda yeni bir deneyim, her anında ayrı bir güzellik saklı. 🌿\n\n#günübirlik #doğa #seyahat #manzara #keşifteyiz",
    "Harika bir günden kalanlar. Enerjinizi tazeleyin, yeni rotalara doğru yola çıkın! 🚀\n\n#günübirlik #macera #haftasonu #gezelimgörelim #rota",
  ];
  const selected = templates[Math.floor(Math.random() * templates.length)];
  return context ? `${context}\n\n${selected}` : selected;
}
