import { withApiLog } from "@/lib/api/with_log";
// app/api/ai-generate/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import { freeAiGenerator } from "@/lib/ai/image_generator";

async function POSTHandler(req: Request) {
  try {
    const body = await req.json();
    const prompt = body.prompt?.trim();
    const format = body.format === "story" ? "story" : "feed";

    if (!prompt) {
      return NextResponse.json({ success: false, error: "Prompt boş olamaz." }, { status: 400 });
    }

    const result = await freeAiGenerator.generatePost(prompt, format, true);

    // Görseli frontend'de anında göstermek için base64'e çevir
    const fileBytes = fs.readFileSync(result.imagePath);
    const base64Image = `data:image/jpeg;base64,${fileBytes.toString("base64")}`;

    return NextResponse.json({
      success: true,
      data: {
        imageBase64: base64Image,
        imagePath: result.imagePath,
        caption: result.caption,
        format: result.format,
        prompt: result.prompt,
      },
    });
  } catch (error) {
    console.error("[API ai-generate] Hata:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export const POST = withApiLog("ai-generate", POSTHandler);
