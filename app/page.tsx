"use client";

import { useState, useEffect } from "react";

interface Settings {
  telegramBotToken: string;
  allowedUserIds: string;
  fbAppId: string;
  fbAppSecret: string;
  fbPageId: string;
  fbPageAccessToken: string;
  igUserId: string;
  linkedinAccessToken: string;
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
  appUrl: string;
  notificationEmail?: string;
  smtpHost?: string;
  smtpUser?: string;
  smtpPass?: string;
}

interface HelpModalContent {
  title: string;
  steps: string[];
  link?: { label: string; url: string };
  tip?: string;
}

export default function Dashboard() {
  const [settings, setSettings] = useState<Settings>({
    telegramBotToken: "",
    allowedUserIds: "",
    fbAppId: "",
    fbAppSecret: "",
    fbPageId: "",
    fbPageAccessToken: "",
    igUserId: "",
    linkedinAccessToken: "",
    cloudinaryCloudName: "",
    cloudinaryApiKey: "",
    cloudinaryApiSecret: "",
    appUrl: "",
    notificationEmail: "",
    smtpHost: "",
    smtpUser: "",
    smtpPass: "",
  });

  const [activeTab, setActiveTab] = useState<"overview" | "telegram" | "facebook" | "linkedin" | "cloudinary" | "features">("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Şifre alanlarının görünürlüğü
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});

  // Bağlantı test durumları
  const [testResults, setTestResults] = useState<Record<string, { loading?: boolean; msg?: string; ok?: boolean }>>({});

  // Yardım / Nasıl Alınır Modalı
  const [helpModal, setHelpModal] = useState<HelpModalContent | null>(null);

  // Doğrudan Web'den Test Gönderi Paylaşma
  const [testPostText, setTestPostText] = useState("Social Poster Bot üzerinden test paylaşımı! 🚀");
  const [testPostStatus, setTestPostStatus] = useState<string | null>(null);
  const [testPostLoading, setTestPostLoading] = useState(false);

  // Ayarları yükle
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.settings) {
          setSettings(data.settings);
        }
      })
      .catch((err) => console.error("Ayarlar yüklenirken hata:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key: keyof Settings, val: string) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const toggleVisibility = (key: string) => {
    setShowTokens((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus("✅ Ayarlar başarıyla kaydedildi!");
      } else {
        setSaveStatus(`❌ Kayıt başarısız: ${data.error}`);
      }
    } catch (e: any) {
      setSaveStatus(`❌ Hata: ${e.message}`);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus(null), 5000);
    }
  };

  const testConnection = async (platform: string, credentials: Record<string, string>) => {
    setTestResults((prev) => ({ ...prev, [platform]: { loading: true } }));
    try {
      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, credentials }),
      });
      const data = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [platform]: { loading: false, msg: data.message, ok: data.success },
      }));
    } catch (e: any) {
      setTestResults((prev) => ({
        ...prev,
        [platform]: { loading: false, msg: e.message, ok: false },
      }));
    }
  };

  // Web üzerinden doğrudan Facebook sayfasına test gönderisi paylaş
  const handleQuickPost = async () => {
    if (!settings.fbPageId || !settings.fbPageAccessToken) {
      alert("Önce Facebook Page ID ve Access Token'ı kaydedin!");
      return;
    }
    setTestPostLoading(true);
    setTestPostStatus(null);
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${settings.fbPageId}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: testPostText,
          access_token: settings.fbPageAccessToken,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setTestPostStatus(`✅ Facebook sayfanızda başarıyla paylaşıldı! (Gönderi ID: ${data.id})`);
      } else {
        setTestPostStatus(`❌ Hata: ${data.error?.message || "Bilinmeyen hata"}`);
      }
    } catch (e: any) {
      setTestPostStatus(`❌ İstek hatası: ${e.message}`);
    } finally {
      setTestPostLoading(false);
    }
  };

  // Yardım rehberleri kütüphanesi
  const showHelp = (topic: string) => {
    const guides: Record<string, HelpModalContent> = {
      telegramBotToken: {
        title: "Telegram Bot Token Nasıl Alınır?",
        steps: [
          "1. Telegram uygulamanızda @BotFather aratın ve sohbeti açın.",
          "2. /newbot komutunu gönderin.",
          "3. Botunuz için bir isim belirleyin (Örn: Günübirlik Poster).",
          "4. Sonunda 'bot' olan benzersiz bir kullanıcı adı yazın (Örn: gunubirlik_test_bot).",
          "5. BotFather size 'Use this token to access the HTTP API:' şeklinde kırmızı renkli bir token verecektir. Onu kopyalayıp buraya yapıştırın."
        ],
        link: { label: "@BotFather'ı Telegram'da Aç", url: "https://t.me/BotFather" },
        tip: "Token'ı kimseyle paylaşmayın; token botunuzun anahtarıdır."
      },
      allowedUserIds: {
        title: "Telegram User ID'nizi Nasıl Bulursunuz?",
        steps: [
          "1. Telegram'da @userinfobot botunu aratın ve Başlat'a basın.",
          "2. Bot size Id numaranızı (örneğin 5388579485 gibi bir rakam) yazacaktır.",
          "3. Bu numarayı kopyalayıp buraya yazın.",
          "4. Birden fazla kişinin botu kullanmasını istiyorsanız virgülle ayırabilirsiniz (Örn: 5388579485, 123456789)."
        ],
        link: { label: "@userinfobot'u Telegram'da Aç", url: "https://t.me/userinfobot" },
        tip: "Bu alanı doldurmazsanız bot herkese açık olur. Güvenlik için kendi ID'nizi eklemeniz önerilir."
      },
      fbPageId: {
        title: "Facebook Page ID (Sayfa Kodu) Nereden Alınır?",
        steps: [
          "1. facebook.com adresinden gönderi paylaşmak istediğiniz Sayfanıza geçiş yapın.",
          "2. Sol menüden Ayarlar > Sayfa Kurulumu veya Sayfa Bilgileri bölümüne tıklayın.",
          "3. Sayfa Kimliği / Sayfa ID (Örn: 1425751537280637) numarasını göreceksiniz.",
          "4. Ya da sayfanızın 'Hakkında' sekmesinde en altta 'Sayfa Şeffaflığı' bölümünde de yazar."
        ],
        link: { label: "Facebook Sayfalarım", url: "https://www.facebook.com/pages" },
      },
      fbPageAccessToken: {
        title: "Facebook Page Access Token Nasıl Alınır?",
        steps: [
          "1. developers.facebook.com/tools/explorer adresine gidin.",
          "2. Sağ tarafta uygulamanızı seçin (İşletme türünde olmalı).",
          "3. 'Add a permission' kutusundan pages_show_list, pages_manage_posts, pages_read_engagement izinlerini seçin.",
          "4. 'Generate Access Token' butonuna basıp izinleri onaylayın.",
          "5. 'User or Page' açılır kutusundan Sayfanızın Adını seçin.",
          "6. Üst kutuda oluşan EAA... ile başlayan token'ı kopyalayıp buraya yapıştırın."
        ],
        link: { label: "Graph API Gezgini'ni Aç", url: "https://developers.facebook.com/tools/explorer" },
        tip: "Bu token kalıcı sayfa yönetim yetkisi sağlar."
      },
      igUserId: {
        title: "Instagram Business User ID Nasıl Alınır?",
        steps: [
          "1. Instagram hesabınızın Profesyonel / İşletme hesabına geçirilmiş olması gerekir.",
          "2. Bu Instagram hesabını Facebook Sayfanıza bağlayın (Facebook Sayfa Ayarları > Bağlı Hesaplar > Instagram).",
          "3. Graph API Explorer'da şu sorguyu çalıştırın: GET /1425751537280637?fields=instagram_business_account",
          "4. Dönen instagram_business_account.id değerini buraya yapıştırın."
        ],
        link: { label: "Facebook Bağlı Hesaplar", url: "https://www.facebook.com" },
        tip: "Kişisel Instagram profillerine API üzerinden otomatik paylaşım yapılamaz, profesyonel hesap şarttır."
      },
      linkedinAccessToken: {
        title: "LinkedIn Access Token Nasıl Alınır?",
        steps: [
          "1. linkedin.com/developers adresinde bir Uygulama (App) oluşturun.",
          "2. 'Products' sekmesinden 'Share on LinkedIn' ve 'Sign In with LinkedIn' ürünlerini ekleyin.",
          "3. Auth sekmesinden OAuth 2.0 ile w_member_social izni olan bir token oluşturun (Postman ile veya OAuth akışıyla).",
          "4. Oluşan AQV... token'ını buraya yapıştırın."
        ],
        link: { label: "LinkedIn Developers Portalı", url: "https://www.linkedin.com/developers" }
      },
      cloudinary: {
        title: "Cloudinary Anahtarları Nereden Alınır?",
        steps: [
          "1. cloudinary.com adresine gidin ve ücretsiz hesap açın (kredi kartı gerekmez).",
          "2. Giriş yaptıktan sonra Dashboard (Kontrol Paneli) ana sayfasını açın.",
          "3. 'Product Environment Credentials' kutucuğunu göreceksiniz.",
          "4. Cloud Name, API Key ve göz ikonuna tıklayarak API Secret değerlerini kopyalayıp buraya girin."
        ],
        link: { label: "Cloudinary Dashboard", url: "https://console.cloudinary.com" },
        tip: "Cloudinary, fotoğrafları Instagram'ın istediği boyutlara otomatik ölçeklemek ve kalıcı hızlı CDN linki üretmek için kullanılır."
      },
      webhook: {
        title: "Telegram Webhook Nasıl Kurulur?",
        steps: [
          "1. Botun Telegram'dan mesaj alabilmesi için internete açık bir HTTPS adresine ihtiyacı vardır.",
          "2. Yerel geliştirme için terminalde şu komutu çalıştırın: npx localtunnel --port 3000",
          "3. Size verilen https://...loca.lt adresini aşağıdaki kutucuğa yapıştırın.",
          "4. 'Webhook'u Kaydet' butonuna basın.",
          "5. Eğer projeyi Vercel'e yüklerseniz doğrudan Vercel adresinizi (https://projem.vercel.app) girebilirsiniz."
        ],
        tip: "Localtunnel veya ngrok açık kaldığı sürece Telegram botunuz yerel bilgisayarınızla konuşur."
      }
    };

    if (guides[topic]) {
      setHelpModal(guides[topic]);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1rem" }}>
        <div style={{ width: "36px", height: "36px", border: "3px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <p style={{ color: "#9ca3af" }}>Yönetim paneli yükleniyor...</p>
      </div>
    );
  }

  const isTelegramOk = !!settings.telegramBotToken;
  const isFbOk = !!(settings.fbPageId && settings.fbPageAccessToken);
  const isIgOk = !!settings.igUserId;
  const isLinkedinOk = !!settings.linkedinAccessToken;
  const isCloudinaryOk = !!(settings.cloudinaryCloudName && settings.cloudinaryApiKey && settings.cloudinaryApiSecret);

  return (
    <div className="dashboard-container">
      {/* Üst Başlık & Kaydet Butonu */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "2.2rem" }}>🤖</span>
            <h1 style={{ fontSize: "1.75rem", fontWeight: "700", letterSpacing: "-0.02em" }}>
              Social Poster Bot
            </h1>
          </div>
          <p style={{ color: "#9ca3af", fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Telegram üzerinden sosyal medya hesaplarınıza tek tıkla otomatik paylaşım paneli
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? "Kaydediliyor..." : "💾 Tüm Ayarları Kaydet"}
        </button>
      </div>

      {/* Kayıt Bildirimi */}
      {saveStatus && (
        <div style={{
          padding: "0.85rem 1.25rem",
          borderRadius: "12px",
          marginBottom: "1.5rem",
          background: saveStatus.startsWith("✅") ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
          border: `1px solid ${saveStatus.startsWith("✅") ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
          color: saveStatus.startsWith("✅") ? "#34d399" : "#f87171",
          fontSize: "0.9rem",
          fontWeight: 500
        }}>
          {saveStatus}
        </div>
      )}

      {/* Sekmeler (Tabs) */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", overflowX: "auto", paddingBottom: "0.5rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={() => setActiveTab("overview")}
          className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
        >
          📊 Genel Durum
        </button>
        <button
          onClick={() => setActiveTab("telegram")}
          className={`tab-btn ${activeTab === "telegram" ? "active" : ""}`}
        >
          ✈️ Telegram & Webhook
        </button>
        <button
          onClick={() => setActiveTab("facebook")}
          className={`tab-btn ${activeTab === "facebook" ? "active" : ""}`}
        >
          👍 Facebook & Instagram
        </button>
        <button
          onClick={() => setActiveTab("linkedin")}
          className={`tab-btn ${activeTab === "linkedin" ? "active" : ""}`}
        >
          💼 LinkedIn
        </button>
        <button
          onClick={() => setActiveTab("cloudinary")}
          className={`tab-btn ${activeTab === "cloudinary" ? "active" : ""}`}
        >
          ☁️ Cloudinary (CDN)
        </button>
        <button
          onClick={() => setActiveTab("features")}
          className={`tab-btn ${activeTab === "features" ? "active" : ""}`}
        >
          ✨ Yeni Özellikler & Mail
        </button>
      </div>

      {/* TAB 1: GENEL DURUM (OVERVIEW) */}
      {activeTab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            {/* Telegram Kartı */}
            <div className="panel-card" style={{ marginBottom: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "1.5rem" }}>✈️</span>
                <span className={isTelegramOk ? "badge-connected" : "badge-disconnected"}>
                  {isTelegramOk ? "Bağlı" : "Eksik"}
                </span>
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600" }}>Telegram Bot</h3>
              <p style={{ color: "#9ca3af", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                {isTelegramOk ? "@Social_gunubirlik_bot" : "Bot Token girilmedi"}
              </p>
            </div>

            {/* Facebook Kartı */}
            <div className="panel-card" style={{ marginBottom: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "1.5rem" }}>👍</span>
                <span className={isFbOk ? "badge-connected" : "badge-disconnected"}>
                  {isFbOk ? "Bağlı" : "Eksik"}
                </span>
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600" }}>Facebook Sayfası</h3>
              <p style={{ color: "#9ca3af", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                {isFbOk ? `Günübirlik (ID: ${settings.fbPageId})` : "Sayfa ayarlanmadı"}
              </p>
            </div>

            {/* Instagram Kartı */}
            <div className="panel-card" style={{ marginBottom: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "1.5rem" }}>📷</span>
                <span className={isIgOk ? "badge-connected" : "badge-disconnected"}>
                  {isIgOk ? "Bağlı" : "Pasif"}
                </span>
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600" }}>Instagram</h3>
              <p style={{ color: "#9ca3af", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                {isIgOk ? `ID: ${settings.igUserId}` : "İsteğe bağlı"}
              </p>
            </div>

            {/* LinkedIn Kartı */}
            <div className="panel-card" style={{ marginBottom: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "1.5rem" }}>💼</span>
                <span className={isLinkedinOk ? "badge-connected" : "badge-disconnected"}>
                  {isLinkedinOk ? "Bağlı" : "Pasif"}
                </span>
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600" }}>LinkedIn</h3>
              <p style={{ color: "#9ca3af", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                {isLinkedinOk ? "Token tanımlı" : "İsteğe bağlı"}
              </p>
            </div>
          </div>

          {/* Web Üzerinden Hızlı Test Paylaşımı */}
          {isFbOk && (
            <div className="panel-card" style={{ background: "rgba(30, 41, 59, 0.7)" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>📢</span> Web Panelinden Hızlı Gönderi Paylaş (Facebook Test)
              </h3>
              <p style={{ fontSize: "0.8rem", color: "#9ca3af", marginBottom: "0.75rem" }}>
                Telegram'ı beklemeden sayfanıza doğrudan bir gönderi atıp çalışıp çalışmadığını anında görün:
              </p>

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <input
                  type="text"
                  value={testPostText}
                  onChange={(e) => setTestPostText(e.target.value)}
                  placeholder="Sayfada paylaşılacak mesaj..."
                  className="form-input"
                  style={{ flex: 1, minWidth: "260px" }}
                />
                <button
                  onClick={handleQuickPost}
                  disabled={testPostLoading || !testPostText}
                  className="btn-primary"
                  style={{ background: "#2563eb", whiteSpace: "nowrap" }}
                >
                  {testPostLoading ? "Paylaşılıyor..." : "🚀 Sayfamda Paylaş"}
                </button>
              </div>

              {testPostStatus && (
                <div style={{
                  marginTop: "0.75rem",
                  padding: "0.65rem",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  background: testPostStatus.startsWith("✅") ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: testPostStatus.startsWith("✅") ? "#34d399" : "#f87171"
                }}>
                  {testPostStatus}
                </div>
              )}
            </div>
          )}

          {/* Hızlı Bilgi & Kullanım */}
          <div className="panel-card">
            <h3 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "0.75rem" }}>🚀 Bot Nasıl Kullanılır?</h3>
            <ol style={{ paddingLeft: "1.25rem", color: "#d1d5db", fontSize: "0.875rem", lineHeight: "1.8" }}>
              <li>Telegram uygulamanızdan <strong>@Social_gunubirlik_bot</strong>'u açın.</li>
              <li>Bota <code>/start</code> veya <code>/status</code> gönderin. Şık butonlar aracılığıyla sayfanızı ve durumunuzu görebilirsiniz.</li>
              <li>Sayfanızda paylaşmak istediğiniz bir <strong>fotoğraf</strong> veya <strong>video</strong> gönderin.</li>
              <li>Medyanın altına yazdığınız açıklama (caption) doğrudan Facebook sayfanızın gönderi metni olarak paylaşılacaktır.</li>
            </ol>
          </div>
        </div>
      )}

      {/* TAB 2: TELEGRAM & WEBHOOK */}
      {activeTab === "telegram" && (
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: "600" }}>✈️ Telegram Yapılandırması</h2>
              <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Telegram bot anahtarı ve yetkili kullanıcı ayarları</p>
            </div>
            <button
              onClick={() => testConnection("telegram", { botToken: settings.telegramBotToken })}
              disabled={testResults["telegram"]?.loading || !settings.telegramBotToken}
              className="btn-secondary"
            >
              {testResults["telegram"]?.loading ? "Kontrol ediliyor..." : "🔍 Bağlantıyı Test Et"}
            </button>
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Telegram Bot Token (@BotFather)</label>
              <button onClick={() => showHelp("telegramBotToken")} className="btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>
                ℹ️ Nasıl Alınır?
              </button>
            </div>
            <div style={{ position: "relative" }}>
              <input
                type={showTokens["telegram"] ? "text" : "password"}
                value={settings.telegramBotToken}
                onChange={(e) => handleChange("telegramBotToken", e.target.value)}
                className="form-input"
                style={{ paddingRight: "3rem" }}
              />
              <button
                type="button"
                onClick={() => toggleVisibility("telegram")}
                style={{ position: "absolute", right: "0.6rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "0.8rem" }}
              >
                {showTokens["telegram"] ? "Gizle" : "Göster"}
              </button>
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Yetkili Telegram User ID'leri (Virgülle ayırın)</label>
              <button onClick={() => showHelp("allowedUserIds")} className="btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>
                ℹ️ Nasıl Alınır?
              </button>
            </div>
            <input
              type="text"
              value={settings.allowedUserIds}
              onChange={(e) => handleChange("allowedUserIds", e.target.value)}
              placeholder="Örn: 5388579485"
              className="form-input"
            />
            <p style={{ color: "#6b7280", fontSize: "0.75rem", marginTop: "0.25rem" }}>
              Sadece bu ID'lere sahip kişiler bota medya gönderip paylaşım yapabilir.
            </p>
          </div>

          {testResults["telegram"]?.msg && (
            <div style={{
              padding: "0.75rem",
              borderRadius: "8px",
              marginBottom: "1.25rem",
              fontSize: "0.85rem",
              background: testResults["telegram"].ok ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: testResults["telegram"].ok ? "#34d399" : "#f87171"
            }}>
              {testResults["telegram"].msg}
            </div>
          )}

          <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.06)", margin: "1.5rem 0" }} />

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: "600" }}>🔗 Telegram Webhook Kurulumu</h3>
              <button onClick={() => showHelp("webhook")} className="btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>
                ℹ️ Nasıl Alınır?
              </button>
            </div>
            <p style={{ fontSize: "0.8rem", color: "#9ca3af", marginBottom: "0.75rem" }}>
              Botun mesajları sunucunuza iletebilmesi için genel açık adresinizi (ngrok, localtunnel veya canlı site) girin:
            </p>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <input
                type="text"
                value={settings.appUrl}
                onChange={(e) => handleChange("appUrl", e.target.value)}
                placeholder="https://your-domain.loca.lt veya https://your-site.vercel.app"
                className="form-input"
                style={{ flex: 1, minWidth: "260px" }}
              />
              <button
                onClick={() => {
                  if (!settings.appUrl) {
                    alert("Lütfen bir URL girin!");
                    return;
                  }
                  window.open(`/api/setup-webhook?url=${encodeURIComponent(settings.appUrl)}`, "_blank");
                }}
                className="btn-primary"
                style={{ background: "#059669", whiteSpace: "nowrap" }}
              >
                Webhook'u Kaydet 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FACEBOOK & INSTAGRAM */}
      {activeTab === "facebook" && (
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: "600" }}>👍 Facebook Sayfası & 📷 Instagram</h2>
              <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Sayfanızda otomatik paylaşım yetkileri</p>
            </div>
            <button
              onClick={() => testConnection("facebook", { pageId: settings.fbPageId, pageAccessToken: settings.fbPageAccessToken })}
              disabled={testResults["facebook"]?.loading || !settings.fbPageAccessToken}
              className="btn-secondary"
            >
              {testResults["facebook"]?.loading ? "Kontrol ediliyor..." : "🔍 Facebook Test Et"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Facebook Page ID</label>
                <button onClick={() => showHelp("fbPageId")} className="btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>
                  ℹ️ Nasıl Alınır?
                </button>
              </div>
              <input
                type="text"
                value={settings.fbPageId}
                onChange={(e) => handleChange("fbPageId", e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Facebook App ID</label>
              </div>
              <input
                type="text"
                value={settings.fbAppId}
                onChange={(e) => handleChange("fbAppId", e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Facebook Page Access Token</label>
              <button onClick={() => showHelp("fbPageAccessToken")} className="btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>
                ℹ️ Nasıl Alınır?
              </button>
            </div>
            <div style={{ position: "relative" }}>
              <input
                type={showTokens["fbToken"] ? "text" : "password"}
                value={settings.fbPageAccessToken}
                onChange={(e) => handleChange("fbPageAccessToken", e.target.value)}
                className="form-input"
                style={{ paddingRight: "3rem" }}
              />
              <button
                type="button"
                onClick={() => toggleVisibility("fbToken")}
                style={{ position: "absolute", right: "0.6rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "0.8rem" }}
              >
                {showTokens["fbToken"] ? "Gizle" : "Göster"}
              </button>
            </div>
          </div>

          {testResults["facebook"]?.msg && (
            <div style={{
              padding: "0.75rem",
              borderRadius: "8px",
              marginBottom: "1.25rem",
              fontSize: "0.85rem",
              background: testResults["facebook"].ok ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: testResults["facebook"].ok ? "#34d399" : "#f87171"
            }}>
              {testResults["facebook"].msg}
            </div>
          )}

          <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.06)", margin: "1.5rem 0" }} />

          {/* Instagram Bölümü */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: "600" }}>📷 Instagram Bağlantısı (Opsiyonel)</h3>
              <button
                onClick={() => testConnection("instagram", { igUserId: settings.igUserId, pageAccessToken: settings.fbPageAccessToken })}
                disabled={testResults["instagram"]?.loading || !settings.igUserId}
                className="btn-secondary"
              >
                {testResults["instagram"]?.loading ? "..." : "🔍 Instagram Test Et"}
              </button>
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Instagram Business User ID</label>
                <button onClick={() => showHelp("igUserId")} className="btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>
                  ℹ️ Nasıl Alınır?
                </button>
              </div>
              <input
                type="text"
                value={settings.igUserId}
                onChange={(e) => handleChange("igUserId", e.target.value)}
                placeholder="Örn: 17841400000000000"
                className="form-input"
              />
            </div>

            {testResults["instagram"]?.msg && (
              <div style={{
                padding: "0.75rem",
                borderRadius: "8px",
                fontSize: "0.85rem",
                background: testResults["instagram"].ok ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                color: testResults["instagram"].ok ? "#34d399" : "#f87171"
              }}>
                {testResults["instagram"].msg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: LINKEDIN */}
      {activeTab === "linkedin" && (
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: "600" }}>💼 LinkedIn Bağlantısı (Opsiyonel)</h2>
              <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>LinkedIn profil veya şirket sayfası paylaşımı</p>
            </div>
            <button
              onClick={() => testConnection("linkedin", { accessToken: settings.linkedinAccessToken })}
              disabled={testResults["linkedin"]?.loading || !settings.linkedinAccessToken}
              className="btn-secondary"
            >
              {testResults["linkedin"]?.loading ? "Kontrol ediliyor..." : "🔍 Bağlantıyı Test Et"}
            </button>
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label className="form-label" style={{ marginBottom: 0 }}>LinkedIn Access Token</label>
              <button onClick={() => showHelp("linkedinAccessToken")} className="btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>
                ℹ️ Nasıl Alınır?
              </button>
            </div>
            <div style={{ position: "relative" }}>
              <input
                type={showTokens["linkedin"] ? "text" : "password"}
                value={settings.linkedinAccessToken}
                onChange={(e) => handleChange("linkedinAccessToken", e.target.value)}
                placeholder="AQV..."
                className="form-input"
                style={{ paddingRight: "3rem" }}
              />
              <button
                type="button"
                onClick={() => toggleVisibility("linkedin")}
                style={{ position: "absolute", right: "0.6rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "0.8rem" }}
              >
                {showTokens["linkedin"] ? "Gizle" : "Göster"}
              </button>
            </div>
          </div>

          {testResults["linkedin"]?.msg && (
            <div style={{
              padding: "0.75rem",
              borderRadius: "8px",
              fontSize: "0.85rem",
              background: testResults["linkedin"].ok ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: testResults["linkedin"].ok ? "#34d399" : "#f87171"
            }}>
              {testResults["linkedin"].msg}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: CLOUDINARY */}
      {activeTab === "cloudinary" && (
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: "600" }}>☁️ Cloudinary (Medya CDN)</h2>
              <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Instagram ve medya dosyaları için</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={() => showHelp("cloudinary")} className="btn-secondary">
                ℹ️ Nasıl Alınır?
              </button>
              <button
                onClick={() => testConnection("cloudinary", { cloudName: settings.cloudinaryCloudName, apiKey: settings.cloudinaryApiKey, apiSecret: settings.cloudinaryApiSecret })}
                disabled={testResults["cloudinary"]?.loading || !settings.cloudinaryCloudName}
                className="btn-secondary"
              >
                {testResults["cloudinary"]?.loading ? "..." : "🔍 Ping Testi"}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Cloud Name</label>
            <input
              type="text"
              value={settings.cloudinaryCloudName}
              onChange={(e) => handleChange("cloudinaryCloudName", e.target.value)}
              placeholder="Örn: mycloud"
              className="form-input"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">API Key</label>
              <input
                type="text"
                value={settings.cloudinaryApiKey}
                onChange={(e) => handleChange("cloudinaryApiKey", e.target.value)}
                placeholder="123456789..."
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">API Secret</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showTokens["cloudinary"] ? "text" : "password"}
                  value={settings.cloudinaryApiSecret}
                  onChange={(e) => handleChange("cloudinaryApiSecret", e.target.value)}
                  className="form-input"
                  style={{ paddingRight: "3rem" }}
                />
                <button
                  type="button"
                  onClick={() => toggleVisibility("cloudinary")}
                  style={{ position: "absolute", right: "0.6rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "0.8rem" }}
                >
                  {showTokens["cloudinary"] ? "Gizle" : "Göster"}
                </button>
              </div>
            </div>
          </div>

          {testResults["cloudinary"]?.msg && (
            <div style={{
              padding: "0.75rem",
              borderRadius: "8px",
              fontSize: "0.85rem",
              background: testResults["cloudinary"].ok ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: testResults["cloudinary"].ok ? "#34d399" : "#f87171"
            }}>
              {testResults["cloudinary"].msg}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: YENİ ÖZELLİKLER & MAİL (FEATURES & SUGGESTIONS) */}
      {activeTab === "features" && (
        <div>
          {/* E-Posta Bildirim Ayarları */}
          <div className="panel-card">
            <div className="panel-header">
              <div>
                <h2 style={{ fontSize: "1.15rem", fontWeight: "600" }}>📧 E-Posta Bildirim Sistemi (Yeni)</h2>
                <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Her başarılı paylaşımda veya hata anında otomatik e-posta raporu alın</p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Bildirim Gönderilecek E-Posta Adresi</label>
              <input
                type="email"
                value={settings.notificationEmail || ""}
                onChange={(e) => handleChange("notificationEmail" as any, e.target.value)}
                placeholder="Örn: websachat@gmail.com"
                className="form-input"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">SMTP Sunucusu (Gmail / Yandex vb.)</label>
                <input
                  type="text"
                  value={settings.smtpHost || ""}
                  onChange={(e) => handleChange("smtpHost" as any, e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">SMTP Kullanıcı / E-Posta</label>
                <input
                  type="text"
                  value={settings.smtpUser || ""}
                  onChange={(e) => handleChange("smtpUser" as any, e.target.value)}
                  placeholder="user@gmail.com"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">SMTP Uygulama Şifresi</label>
                <input
                  type="password"
                  value={settings.smtpPass || ""}
                  onChange={(e) => handleChange("smtpPass" as any, e.target.value)}
                  placeholder="••••••••••••"
                  className="form-input"
                />
              </div>
            </div>
          </div>

          {/* Eklenebilecek Diğer Süper Özellikler Listesi */}
          <div className="panel-card">
            <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "0.5rem" }}>💡 Web Sitesi & Bot İçin Yeni Özellik Önerileri</h3>
            <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "1.25rem" }}>
              Projenizi daha profesyonel kılmak için istediğiniz zaman ekleyebileceğimiz özellikler:
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>⏰</div>
                <h4 style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "0.25rem" }}>Zamanlanmış Paylaşım (Scheduler)</h4>
                <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                  Telegram'a fotoğraf attığınızda bot size <em>"Şimdi mi paylaşılsın, yoksa akşam 20:00'de mi?"</em> diye sorar ve kuyruğa alır.
                </p>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>🤖</div>
                <h4 style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "0.25rem" }}>Yapay Zeka (AI) İle Başlık Üretici</h4>
                <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                  Açıklama yazmadan sadece fotoğraf atsanız bile, AI görseli tanıyıp etkileyici Türkçe başlık ve popüler hashtag'ler (#gezi #günübirlik vb.) üretir.
                </p>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>📜</div>
                <h4 style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "0.25rem" }}>Paylaşım Geçmişi & İstatistikler</h4>
                <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                  Web panelinde daha önce Telegram'dan paylaşılan tüm fotoğrafların önizlemesi, beğeni ve görüntülenme sayıları listelenir.
                </p>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>🎨</div>
                <h4 style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "0.25rem" }}>Otomatik Logo / Filigran (Watermark)</h4>
                <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                  Fotoğraflarınızın sağ alt köşesine "Günübirlik" logonuz otomatik basılarak paylaşılır; böylece görselleriniz çalınmaz.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* YARDIM / NASIL ALINIR MODALI */}
      {helpModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "1rem"
        }}>
          <div style={{
            background: "#111827",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "16px",
            maxWidth: "540px",
            width: "100%",
            padding: "1.5rem",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            color: "#f3f4f6"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: "600", color: "#60a5fa" }}>
                💡 {helpModal.title}
              </h3>
              <button
                onClick={() => setHelpModal(null)}
                style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "1.4rem", cursor: "pointer", lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ color: "#d1d5db", fontSize: "0.875rem", lineHeight: "1.7", marginBottom: "1.25rem" }}>
              {helpModal.steps.map((step, idx) => (
                <p key={idx} style={{ marginBottom: "0.5rem" }}>{step}</p>
              ))}
            </div>

            {helpModal.tip && (
              <div style={{
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                color: "#fbbf24",
                padding: "0.65rem 0.85rem",
                borderRadius: "8px",
                fontSize: "0.8rem",
                marginBottom: "1.25rem"
              }}>
                ⚠️ <strong>Önemli:</strong> {helpModal.tip}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
              {helpModal.link ? (
                <a
                  href={helpModal.link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary"
                  style={{ textDecoration: "none", fontSize: "0.8rem", padding: "0.5rem 1rem" }}
                >
                  🔗 {helpModal.link.label}
                </a>
              ) : <div />}
              <button
                onClick={() => setHelpModal(null)}
                className="btn-secondary"
              >
                Anladım, Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
