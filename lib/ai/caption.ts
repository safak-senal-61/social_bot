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

    const prompt = `Sen "Günübirlik" isimli iş alma ve iş verme platformunun profesyonel sosyal medya yöneticisisin. Bu görseli detaylı incele.
Instagram, Facebook ve LinkedIn için iş arayanları ve işverenleri harekete geçirecek, güven veren ve etkileyici Türkçe bir paylaşım açıklaması yaz.
Kurallar:
1. Türkçe yaz.
2. 2-3 cümlelik akıcı, profesyonel ve ilgi çekici bir metin oluştur.
3. Görseldeki iş koluna ve #günübirlik #işilanı #günlükiş #yevmiye #ekiş #elemanaranıyor #işfırsatı konseptine uygun 4-6 popüler hashtag ekle.
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
    "Günübirlik iş arayanlar ve acil eleman ihtiyacı olanlar burada buluşuyor! Güvenilir yevmiyeli iş fırsatları ve anlık çalışma olanakları için profilimizdeki bağlantıyı inceleyin veya bize DM atın. 💼⚡\n\n#günübirlik #işilanı #günlükiş #yevmiye #ekiş #elemanaranıyor #işfırsatı",
    "Gününüzü kazanca dönüştürün! İster ek gelir sağlayın, ister işletmeniz için acil personel bulun. Detaylar ve başvuru için bize hemen ulaşın. 🛠️✨\n\n#günübirlik #günlükiş #yevmiyeli #ustalarişi #garson #temizlik #nakliye #işilanları",
    "Acil iş ve hızlı eleman çözümü Günübirlik'te! Günlük ödemeli iş ilanlarını kaçırmayın. Başvurmak için profildeki linke tıklayın. 📲🚀\n\n#günübirlik #işimvar #işarıyorum #günlükkazanç #fırsat #kariyer",
  ];
  const selected = templates[Math.floor(Math.random() * templates.length)];
  return context ? `${context}\n\n${selected}` : selected;
}
