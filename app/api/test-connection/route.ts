// app/api/test-connection/route.ts
import { NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: Request) {
  try {
    const { platform, credentials } = await req.json();

    switch (platform) {
      case "telegram": {
        const { botToken } = credentials;
        if (!botToken) {
          return NextResponse.json({ success: false, message: "Bot token girilmemiş." });
        }
        const res = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`, { timeout: 10_000 });
        if (res.data?.ok) {
          return NextResponse.json({
            success: true,
            message: `Bağlandı! Bot adı: @${res.data.result.username} (${res.data.result.first_name})`,
          });
        }
        return NextResponse.json({ success: false, message: "Telegram geçersiz yanıt verdi." });
      }

      case "facebook": {
        const { pageId, pageAccessToken } = credentials;
        if (!pageId || !pageAccessToken) {
          return NextResponse.json({ success: false, message: "Page ID ve Page Access Token gereklidir." });
        }
        const res = await axios.get(`https://graph.facebook.com/v21.0/${pageId}`, {
          params: { fields: "id,name", access_token: pageAccessToken },
          timeout: 10_000,
        });
        return NextResponse.json({
          success: true,
          message: `Bağlandı! Sayfa Adı: ${res.data.name} (ID: ${res.data.id})`,
        });
      }

      case "instagram": {
        const { igUserId, pageAccessToken } = credentials;
        if (!igUserId || !pageAccessToken) {
          return NextResponse.json({ success: false, message: "Instagram User ID ve Facebook Access Token gereklidir." });
        }
        const res = await axios.get(`https://graph.facebook.com/v21.0/${igUserId}`, {
          params: { fields: "id,username,name", access_token: pageAccessToken },
          timeout: 10_000,
        });
        return NextResponse.json({
          success: true,
          message: `Bağlandı! Instagram Hesabı: @${res.data.username || res.data.id}`,
        });
      }

      case "linkedin": {
        const { accessToken, organizationId } = credentials;
        if (!accessToken) {
          return NextResponse.json({ success: false, message: "LinkedIn Access Token gereklidir." });
        }
        const res = await axios.get("https://api.linkedin.com/v2/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10_000,
        });
        const userName = res.data.name || res.data.sub;
        if (organizationId) {
          return NextResponse.json({
            success: true,
            message: `Bağlandı! Kullanıcı: ${userName} | Hedef Şirket ID: ${organizationId}`,
          });
        }
        return NextResponse.json({
          success: true,
          message: `Bağlandı! Kullanıcı: ${userName} (Kişisel Profil)`,
        });
      }

      case "cloudinary": {
        const { cloudName, apiKey, apiSecret } = credentials;
        if (!cloudName || !apiKey || !apiSecret) {
          return NextResponse.json({ success: false, message: "Cloudinary için Cloud Name, API Key ve Secret gereklidir." });
        }
        const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
        const res = await axios.get(`https://api.cloudinary.com/v1_1/${cloudName}/ping`, {
          headers: { Authorization: `Basic ${auth}` },
          timeout: 10_000,
        });
        if (res.data?.status === "ok") {
          return NextResponse.json({ success: true, message: "Cloudinary bağlantısı başarılı!" });
        }
        return NextResponse.json({ success: false, message: "Cloudinary bağlantı kurulamadı." });
      }

      default:
        return NextResponse.json({ success: false, message: "Bilinmeyen platform" }, { status: 400 });
    }
  } catch (err: any) {
    const errorDetail = err?.response?.data?.error?.message || err?.message || String(err);
    return NextResponse.json({ success: false, message: `Hata: ${errorDetail}` });
  }
}
