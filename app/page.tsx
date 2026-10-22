"use client";

import { useState, useEffect, useRef } from "react";
import Rail from "@/components/Rail";
import StatusNote from "@/components/StatusNote";
import { buildRailGroups, TAB_TITLES, TAB_LEADS, type TabId } from "@/lib/ui/navigation";

interface Settings {
  telegramBotToken: string;
  allowedUserIds: string;
  fbAppId: string;
  fbAppSecret: string;
  fbPageId: string;
  fbPageAccessToken: string;
  igUserId: string;
  linkedinAccessToken: string;
  linkedinOrganizationId?: string;
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
  appUrl: string;
  geminiApiKey?: string;
  watermarkEnabled?: boolean;
  watermarkText?: string;
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
    linkedinOrganizationId: "",
    cloudinaryCloudName: "",
    cloudinaryApiKey: "",
    cloudinaryApiSecret: "",
    appUrl: "",
    geminiApiKey: "",
    watermarkEnabled: true,
    watermarkText: "Günübirlik",
    notificationEmail: "",
    smtpHost: "",
    smtpUser: "",
    smtpPass: "",
  });

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [scheduleQueue, setScheduleQueue] = useState<any[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // AI Studio State
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiFormat, setAiFormat] = useState<"feed" | "story">("feed");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    imageBase64: string;
    imagePath: string;
    caption: string;
    format: "feed" | "story";
    prompt: string;
  } | null>(null);
  const [aiPublishStatus, setAiPublishStatus] = useState<string | null>(null);
  const [aiPublishLoading, setAiPublishLoading] = useState(false);

  // Auto-Reply State
  const [autoReplyRules, setAutoReplyRules] = useState<any[]>([]);
  const [autoReplyHistory, setAutoReplyHistory] = useState<any[]>([]);
  const [autoReplyLoading, setAutoReplyLoading] = useState(false);
  const [autoReplyCheckStatus, setAutoReplyCheckStatus] = useState<string | null>(null);
  const [newRuleKeywords, setNewRuleKeywords] = useState("");
  const [newRuleReply, setNewRuleReply] = useState("");
  const [newRuleName, setNewRuleName] = useState("");

  // Logo / Filigran State
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoStatus, setLogoStatus] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const fetchCustomLogo = async () => {
    try {
      const res = await fetch("/api/watermark/logo");
      const data = await res.json();
      if (data.success && data.hasLogo) {
        setCustomLogoUrl(data.logoUrl);
      } else {
        setCustomLogoUrl(null);
      }
    } catch {
      // ignore
    }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    setLogoStatus(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/watermark/logo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setCustomLogoUrl(data.logoUrl);
        setLogoStatus("✅ Logo başarıyla yüklendi ve filigran yapıldı!");
      } else {
        setLogoStatus(`❌ Hata: ${data.error}`);
      }
    } catch (err: any) {
      setLogoStatus(`❌ Yükleme hatası: ${err.message}`);
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm("Özel logonuzu kaldırmak ve varsayılan şık şablona dönmek istiyor musunuz?")) return;
    setLogoUploading(true);
    setLogoStatus(null);
    try {
      const res = await fetch("/api/watermark/logo", {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setCustomLogoUrl(null);
        setLogoStatus("ℹ️ Varsayılan şık şablon rozete dönüldü.");
      } else {
        setLogoStatus(`❌ Hata: ${data.error}`);
      }
    } catch (err: any) {
      setLogoStatus(`❌ Silme hatası: ${err.message}`);
    } finally {
      setLogoUploading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (data.success) setHistory(data.history || []);
    } catch {} finally {
      setHistoryLoading(false);
    }
  };

  const fetchSchedule = async () => {
    setScheduleLoading(true);
    try {
      const res = await fetch("/api/schedule");
      const data = await res.json();
      if (data.success) setScheduleQueue(data.queue || []);
    } catch {} finally {
      setScheduleLoading(false);
    }
  };

  const fetchAutoReply = async () => {
    setAutoReplyLoading(true);
    try {
      const res = await fetch("/api/autoreply");
      const data = await res.json();
      if (data.success) {
        setAutoReplyRules(data.rules || []);
        setAutoReplyHistory(data.history || []);
      }
    } catch {} finally {
      setAutoReplyLoading(false);
    }
  };

  const handleGenerateAi = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiResult(null);
    setAiPublishStatus(null);
    try {
      const res = await fetch("/api/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, format: aiFormat }),
      });
      const data = await res.json();
      if (data.success) {
        setAiResult(data.data);
      } else {
        alert("Üretim hatası: " + data.error);
      }
    } catch (e: any) {
      alert("Hata: " + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handlePublishAiPost = async () => {
    if (!aiResult) return;
    setAiPublishLoading(true);
    setAiPublishStatus(null);
    try {
      const res = await fetch("/api/quick-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: aiResult.caption }),
      });
      const data = await res.json();
      if (data.success) {
        setAiPublishStatus("✅ Başarıyla sayfanızda yayınlandı!");
        fetchHistory();
      } else {
        setAiPublishStatus(`❌ Paylaşım hatası: ${data.error}`);
      }
    } catch (e: any) {
      setAiPublishStatus(`❌ Hata: ${e.message}`);
    } finally {
      setAiPublishLoading(false);
    }
  };

  const cancelScheduledItem = async (id: string) => {
    if (!confirm("Bu zamanlanmış gönderiyi iptal etmek istediğinize emin misiniz?")) return;
    try {
      await fetch("/api/schedule", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchSchedule();
    } catch {
      alert("İptal işlemi başarısız");
    }
  };

  const triggerAutoReplyCheck = async () => {
    setAutoReplyCheckStatus("Yorumlar taranıyor...");
    try {
      const res = await fetch("/api/autoreply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger_check" }),
      });
      const data = await res.json();
      setAutoReplyCheckStatus(data.message || "Tarama tamamlandı.");
      fetchAutoReply();
    } catch (e: any) {
      setAutoReplyCheckStatus("Hata: " + e.message);
    }
  };

  const saveAutoReplyRules = async (rulesToSave: any[]) => {
    try {
      await fetch("/api/autoreply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: rulesToSave }),
      });
      setAutoReplyRules(rulesToSave);
    } catch {
      alert("Kurallar kaydedilemedi");
    }
  };

  const toggleRule = (ruleId: string) => {
    const updated = autoReplyRules.map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );
    saveAutoReplyRules(updated);
  };

  const addCustomRule = () => {
    if (!newRuleKeywords.trim() || !newRuleReply.trim()) {
      alert("Lütfen anahtar kelime ve yanıt metnini girin.");
      return;
    }
    const keywords = newRuleKeywords.split(",").map((k) => k.trim()).filter(Boolean);
    const newRule = {
      id: `rule_${Date.now()}`,
      name: newRuleName.trim() || "Özel Kural",
      keywords,
      reply: newRuleReply.trim(),
      enabled: true,
    };
    const updated = [...autoReplyRules, newRule];
    saveAutoReplyRules(updated);
    setNewRuleKeywords("");
    setNewRuleReply("");
    setNewRuleName("");
  };

  const deleteRule = (ruleId: string) => {
    if (!confirm("Bu kuralı silmek istediğinize emin misiniz?")) return;
    const updated = autoReplyRules.filter((r) => r.id !== ruleId);
    saveAutoReplyRules(updated);
  };

  useEffect(() => {
    if (activeTab === "history") fetchHistory();
    if (activeTab === "schedule") fetchSchedule();
    if (activeTab === "autoreply") fetchAutoReply();
  }, [activeTab]);

  // /debug sayfasından "/?tab=history" gibi bağlantılarla gelinirse ilgili sekmeyi aç
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab") as TabId | null;
    if (tab && tab in TAB_TITLES) setActiveTab(tab);
  }, []);

  // Şifre alanlarının görünürlüğü
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});

  // Bağlantı test durumları
  const [testResults, setTestResults] = useState<Record<string, { loading?: boolean; msg?: string; ok?: boolean }>>({});

  // Yardım / Nasıl Alınır Modalı
  const [helpModal, setHelpModal] = useState<HelpModalContent | null>(null);

  // Doğrudan Web'den Test Gönderi Paylaşma
  const [testPostText, setTestPostText] = useState("Social Poster Bot üzerinden test paylaşımı! ");
  const [testPostStatus, setTestPostStatus] = useState<string | null>(null);
  const [testPostLoading, setTestPostLoading] = useState(false);

  // Ayarları ve verileri yükle
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

    fetchHistory();
    fetchSchedule();
    fetchAutoReply();
    fetchCustomLogo();
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
    <div className="shell">
      <Rail
        groups={buildRailGroups({
          history: history.length,
          schedule: scheduleQueue.length,
          autoreply: autoReplyRules.length,
        })}
        active={activeTab}
        onSelect={(id) => setActiveTab(id as TabId)}
      />

      <main className="stage">
        <header className="stage-head">
          <div>
            <h1>{TAB_TITLES[activeTab]}</h1>
            <p className="stage-lead">{TAB_LEADS[activeTab]}</p>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "Kaydediliyor..." : "Ayarları kaydet"}
          </button>
        </header>

        {saveStatus && <StatusNote text={saveStatus} />}

      {/* TAB 1: GENEL DURUM (OVERVIEW) */}
      {activeTab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            {/* Telegram Kartı */}
            <div className="panel-card" style={{ marginBottom: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
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
                Web Panelinden Hızlı Gönderi Paylaş (Facebook Test)
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
                  {testPostLoading ? "Paylaşılıyor..." : "Sayfamda Paylaş"}
                </button>
              </div>

              {testPostStatus && <StatusNote text={testPostStatus} />}
            </div>
          )}

          {/* Hızlı Bilgi & Kullanım */}
          <div className="panel-card">
            <h3 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "0.75rem" }}>Bot Nasıl Kullanılır?</h3>
            <ol style={{ paddingLeft: "1.25rem", color: "#d1d5db", fontSize: "0.875rem", lineHeight: "1.8" }}>
              <li>Telegram uygulamanızdan <strong>@Social_gunubirlik_bot</strong>'u açın.</li>
              <li>Bota <code>/start</code> veya <code>/status</code> gönderin. Şık butonlar aracılığıyla sayfanızı ve durumunuzu görebilirsiniz.</li>
              <li>Sayfanızda paylaşmak istediğiniz bir <strong>fotoğraf</strong> veya <strong>video</strong> gönderin.</li>
              <li>Medyanın altına yazdığınız açıklama (caption) doğrudan Facebook sayfanızın gönderi metni olarak paylaşılacaktır.</li>
            </ol>
          </div>
        </div>
      )}

      {/* TAB: PAYLAŞIM GEÇMİŞİ (HISTORY) */}
      {activeTab === "history" && (
        <div>
          {/* İstatistik & Başlık */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "700" }}>Paylaşım Geçmişi & İstatistikler</h2>
              <p style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
                Telegram üzerinden sosyal medya hesaplarınıza gönderilen tüm paylaşımlar
              </p>
            </div>
            <button
              onClick={fetchHistory}
              disabled={historyLoading}
              className="btn-secondary"
              style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}
            >
              {historyLoading ? "Yenileniyor..." : "Yenile"}
            </button>
          </div>

          {/* Özet İstatistik Kartları */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            <div className="panel-card" style={{ marginBottom: 0, padding: "1rem" }}>
              <div style={{ color: "#9ca3af", fontSize: "0.8rem", fontWeight: 500 }}>Toplam Paylaşım</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: "0.25rem", color: "#60a5fa" }}>
                {history.length}
              </div>
            </div>
            <div className="panel-card" style={{ marginBottom: 0, padding: "1rem" }}>
              <div style={{ color: "#9ca3af", fontSize: "0.8rem", fontWeight: 500 }}>Başarılı Yayınlar</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: "0.25rem", color: "#34d399" }}>
                {history.filter((h) => h.status === "published").length}
              </div>
            </div>
            <div className="panel-card" style={{ marginBottom: 0, padding: "1rem" }}>
              <div style={{ color: "#9ca3af", fontSize: "0.8rem", fontWeight: 500 }}>Zamanlanmış Kuyruk</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: "0.25rem", color: "#fbbf24" }}>
                {scheduleQueue.length}
              </div>
            </div>
          </div>

          {/* Geçmiş Gönderi Listesi */}
          {historyLoading && history.length === 0 ? (
            <div className="panel-card" style={{ textAlign: "center", padding: "3rem 1rem" }}>
              <div style={{ width: "32px", height: "32px", border: "3px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 1rem auto" }} />
              <p style={{ color: "#9ca3af" }}>Paylaşım geçmişi yükleniyor...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="panel-card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}></div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "0.5rem" }}>Henüz Paylaşım Yapılmadı</h3>
              <p style={{ color: "#9ca3af", fontSize: "0.875rem", maxWidth: "460px", margin: "0 auto 1.5rem auto" }}>
                Telegram botunuza bir fotoğraf gönderin. AI otomatik başlık üretsin veya kendi açıklamanızı ekleyin, ardından hemen veya zamanlayarak paylaşın!
              </p>
              <a
                href="https://t.me/Social_gunubirlik_bot"
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
                style={{ textDecoration: "none", display: "inline-block", fontSize: "0.85rem" }}
              >
                Telegram Botu Aç (@Social_gunubirlik_bot)
              </a>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {history.map((item) => {
                const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleString("tr-TR") : "-";
                return (
                  <div key={item.id} className="panel-card" style={{ marginBottom: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontSize: "1.1rem" }}>{item.mediaType === "video" ? "" : ""}</span>
                        <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>{dateStr}</span>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {item.platforms?.facebook && (
                          <span style={{
                            fontSize: "0.75rem",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "6px",
                            background: item.platforms.facebook.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                            color: item.platforms.facebook.success ? "#34d399" : "#f87171",
                            border: `1px solid ${item.platforms.facebook.success ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
                          }}>
                            Facebook: {item.platforms.facebook.success ? "Yayınlandı" : "Hata"}
                          </span>
                        )}
                        {item.platforms?.instagram && (
                          <span style={{
                            fontSize: "0.75rem",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "6px",
                            background: item.platforms.instagram.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                            color: item.platforms.instagram.success ? "#34d399" : "#f87171",
                            border: `1px solid ${item.platforms.instagram.success ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
                          }}>
                            Instagram: {item.platforms.instagram.success ? "Yayınlandı" : "Hata"}
                          </span>
                        )}
                        {item.platforms?.linkedin && (
                          <span style={{
                            fontSize: "0.75rem",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "6px",
                            background: item.platforms.linkedin.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                            color: item.platforms.linkedin.success ? "#34d399" : "#f87171",
                            border: `1px solid ${item.platforms.linkedin.success ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
                          }}>
                            LinkedIn: {item.platforms.linkedin.success ? "Yayınlandı" : "Hata"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
                      {item.mediaUrl && (
                        <div style={{ width: "90px", height: "90px", borderRadius: "10px", overflow: "hidden", flexShrink: 0, background: "#1f2937", border: "1px solid rgba(255,255,255,0.1)" }}>
                          <img
                            src={item.mediaUrl}
                            alt="Gönderi Görseli"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: "240px" }}>
                        <p style={{
                          fontSize: "0.875rem",
                          lineHeight: "1.6",
                          whiteSpace: "pre-wrap",
                          color: "#e5e7eb",
                          background: "rgba(0,0,0,0.25)",
                          padding: "0.75rem",
                          borderRadius: "8px",
                          border: "1px solid rgba(255,255,255,0.04)"
                        }}>
                          {item.caption || "(Açıklama girilmedi)"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: ZAMANLANMIŞ KUYRUK (SCHEDULE) */}
      {activeTab === "schedule" && (
        <div>
          {/* İstatistik & Başlık */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "700" }}>Zamanlanmış Paylaşım Kuyruğu</h2>
              <p style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
                Otomatik saati geldiğinde Facebook, Instagram ve LinkedIn hesaplarınızda yayınlanacak gönderiler
              </p>
            </div>
            <button
              onClick={fetchSchedule}
              disabled={scheduleLoading}
              className="btn-secondary"
              style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}
            >
              {scheduleLoading ? "Yenileniyor..." : "Yenile"}
            </button>
          </div>

          {scheduleLoading && scheduleQueue.length === 0 ? (
            <div className="panel-card" style={{ textAlign: "center", padding: "3rem 1rem" }}>
              <div style={{ width: "32px", height: "32px", border: "3px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 1rem auto" }} />
              <p style={{ color: "#9ca3af" }}>Kuyruk kontrol ediliyor...</p>
            </div>
          ) : scheduleQueue.length === 0 ? (
            <div className="panel-card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}></div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "0.5rem" }}>Kuyrukta Bekleyen Gönderi Yok</h3>
              <p style={{ color: "#9ca3af", fontSize: "0.875rem", maxWidth: "480px", margin: "0 auto 1.5rem auto" }}>
                Telegram botunuza fotoğraf gönderdiğinizde çıkan onay kartından <strong>"Akşam 20:00"</strong> veya <strong>"1 Saat Sonra"</strong> butonlarına tıklayarak gönderilerinizi otomatik sıraya alabilirsiniz.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {scheduleQueue.map((item) => {
                const targetDate = new Date(item.scheduledAt);
                const remainingMinutes = Math.max(0, Math.round((item.scheduledAt - Date.now()) / 60000));
                return (
                  <div key={item.id} className="panel-card" style={{ marginBottom: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div>
                          <div style={{ fontSize: "0.95rem", fontWeight: "600", color: "#fbbf24" }}>
                            {targetDate.toLocaleString("tr-TR")}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                            {remainingMinutes > 0 ? `Yaklaşık ${remainingMinutes} dakika sonra yayınlanacak` : "Zamanı geldi, worker yayınlıyor..."}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{
                          fontSize: "0.75rem",
                          padding: "0.25rem 0.6rem",
                          borderRadius: "6px",
                          background: item.applyWatermark ? "rgba(16, 185, 129, 0.15)" : "rgba(156, 163, 175, 0.15)",
                          color: item.applyWatermark ? "#34d399" : "#9ca3af",
                          border: `1px solid ${item.applyWatermark ? "rgba(16, 185, 129, 0.3)" : "rgba(156, 163, 175, 0.2)"}`
                        }}>
                          Filigran: {item.applyWatermark ? "Açık" : "Kapalı"}
                        </span>
                        <button
                          onClick={() => cancelScheduledItem(item.id)}
                          className="btn-secondary"
                          style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.3)" }}
                        >
                          İptal Et
                        </button>
                      </div>
                    </div>

                    <div style={{
                      fontSize: "0.875rem",
                      lineHeight: "1.6",
                      whiteSpace: "pre-wrap",
                      color: "#e5e7eb",
                      background: "rgba(0,0,0,0.25)",
                      padding: "0.75rem",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.04)"
                    }}>
                      {item.caption || "(Açıklama girilmedi)"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: YAPAY ZEKA STÜDYOSU (AI STUDIO) */}
      {activeTab === "aistudio" && (
        <div>
          <div className="panel-card">
            <div className="panel-header">
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "700" }}>Tamamen Ücretsiz AI İş Görseli & İlan Stüdyosu</h2>
                <p style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
                  Herhangi bir API key gerektirmeden profesyonel iş ilanı ve çalışma anı görsellerini, Türkçe başlığını ve etiketlerini tek tıkla üretin
                </p>
              </div>
              <span className="badge-connected">Sınırsız / 100% Ücretsiz (FLUX.1)</span>
            </div>

            {/* Prompt Girişi */}
            <div className="form-group">
              <label className="form-label">Hangi İş Kolu veya İlan İçin Görsel İstiyorsunuz?</label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Örn: Restoranda güler yüzlü günlük garson sipariş alırken, profesyonel iş ilanı fotoğrafı"
                className="form-input"
                rows={3}
                style={{ resize: "vertical" }}
              />
              {/* İlham Hapları */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                {[
                  "Restoranda güler yüzlü günlük garson sipariş alırken",
                  "Modern ev temizliği yapan profesyonel yardımcı personel",
                  "İnşaat ustası iç mekan tadilatı ve boya yaparken",
                  "Depoda koli yükleyen enerjik nakliye işçisi",
                  "Motosikletli kurye hızlı paket teslimatında",
                  "Etkinlik ve fuar karşılama personeli şık giyimli",
                ].map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAiPrompt(sample)}
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "9999px",
                      padding: "0.25rem 0.65rem",
                      fontSize: "0.75rem",
                      color: "#9ca3af",
                      cursor: "pointer",
                    }}
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            {/* Format Seçici & Üret Butonu */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginTop: "1.25rem" }}>
              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                <label style={{ fontSize: "0.875rem", color: "#d1d5db", display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="aiFormat"
                    value="feed"
                    checked={aiFormat === "feed"}
                    onChange={() => setAiFormat("feed")}
                    style={{ accentColor: "#3b82f6" }}
                  />
                  Akış Gönderisi (1:1 Kare)
                </label>
                <label style={{ fontSize: "0.875rem", color: "#d1d5db", display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="aiFormat"
                    value="story"
                    checked={aiFormat === "story"}
                    onChange={() => setAiFormat("story")}
                    style={{ accentColor: "#3b82f6" }}
                  />
                  Instagram Hikayesi (9:16 Dikey)
                </label>
              </div>

              <button
                onClick={handleGenerateAi}
                disabled={aiLoading || !aiPrompt.trim()}
                className="btn-primary"
                style={{ background: "#8b5cf6", fontSize: "0.9rem", padding: "0.6rem 1.5rem" }}
              >
                {aiLoading ? "Yapay Zeka Çiziyor (10-15 sn)..." : "Görsel & Başlık Üret"}
              </button>
            </div>
          </div>

          {/* AI Sonuç Önizleme Kartı */}
          {aiResult && (
            <div className="panel-card" style={{ borderColor: "rgba(139, 92, 246, 0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0.75rem" }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#c084fc" }}>
                  Üretilen Gönderi Önizlemesi ({aiResult.format === "story" ? "Instagram Story 9:16" : "Post 1:1"})
                </h3>
                <span className="badge-connected">Günübirlik Filigranı Eklendi</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", alignItems: "flex-start" }}>
                {/* Görsel */}
                <div style={{ textAlign: "center", background: "#0b0f19", padding: "0.5rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <img
                    src={aiResult.imageBase64}
                    alt="AI Generated Visual"
                    style={{
                      maxWidth: "100%",
                      maxHeight: aiResult.format === "story" ? "460px" : "360px",
                      borderRadius: "8px",
                      objectFit: "contain",
                    }}
                  />
                </div>

                {/* Açıklama & Paylaşım Butonu */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Yapay Zeka Tarafından Yazılan Başlık & Etiketler</label>
                    <textarea
                      value={aiResult.caption}
                      onChange={(e) => setAiResult({ ...aiResult, caption: e.target.value })}
                      className="form-input"
                      rows={7}
                      style={{ lineHeight: "1.6", resize: "vertical" }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    <button
                      onClick={handlePublishAiPost}
                      disabled={aiPublishLoading}
                      className="btn-primary"
                      style={{ flex: 1, background: "#2563eb" }}
                    >
                      {aiPublishLoading ? "Paylaşılıyor..." : "Facebook & Instagram'da Paylaş"}
                    </button>
                    <a
                      href="https://t.me/Social_gunubirlik_bot"
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary"
                      style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                    >
                      Telegram'a Git
                    </a>
                  </div>

                  {aiPublishStatus && <StatusNote text={aiPublishStatus} />}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: OTOMATİK YORUM & YANITLAMA (AUTO-REPLY) */}
      {activeTab === "autoreply" && (
        <div>
          {/* Başlık & Tetikleyici */}
          <div className="panel-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "700" }}>Otomatik Yorum & DM Yanıtlama (Auto-Reply)</h2>
                <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginTop: "0.2rem" }}>
                  Instagram ve Facebook gönderilerinizin altına gelen "fiyat nedir?", "neresi burası?", "detay alabilir miyim?" yorumlarına anında akıllı yanıt verin
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={triggerAutoReplyCheck}
                  className="btn-primary"
                  style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}
                >
                  Şimdi Yorumları Tara & Yanıtla
                </button>
                <button
                  onClick={fetchAutoReply}
                  disabled={autoReplyLoading}
                  className="btn-secondary"
                  style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}
                >
                  Yenile
                </button>
              </div>
            </div>

            {autoReplyCheckStatus && <StatusNote text={autoReplyCheckStatus} tone="neutral" />}
          </div>

          {/* Kurallar Listesi */}
          <div className="panel-card">
            <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "1rem" }}>
              Aktif Yanıt Kuralları ({autoReplyRules.length})
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {autoReplyRules.map((rule) => (
                <div
                  key={rule.id}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "12px",
                    padding: "1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: "260px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{rule.name}</span>
                      <span style={{
                        fontSize: "0.7rem",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "9999px",
                        background: rule.enabled ? "rgba(16, 185, 129, 0.15)" : "rgba(156, 163, 175, 0.15)",
                        color: rule.enabled ? "#34d399" : "#9ca3af"
                      }}>
                        {rule.enabled ? "Aktif" : "Pasif"}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                      {rule.keywords.map((kw: string, i: number) => (
                        <span key={i} style={{ fontSize: "0.75rem", background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", padding: "0.15rem 0.5rem", borderRadius: "6px" }}>
                          #{kw}
                        </span>
                      ))}
                    </div>

                    <p style={{ fontSize: "0.85rem", color: "#e5e7eb", background: "rgba(0,0,0,0.3)", padding: "0.6rem", borderRadius: "8px", margin: 0 }}>
                      <em>"{rule.reply}"</em>
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className="btn-secondary"
                      style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                    >
                      {rule.enabled ? "Devre Dışı Bırak" : "Etkinleştir"}
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="btn-secondary"
                      style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", color: "#f87171", borderColor: "rgba(239,68,68,0.3)" }}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Yeni Kural Ekleme Formu */}
          <div className="panel-card">
            <h3 style={{ fontSize: "1.05rem", fontWeight: "600", marginBottom: "0.75rem" }}>Yeni Otomatik Yanıt Kuralı Ekle</h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Kural Adı</label>
                <input
                  type="text"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  placeholder="Örn: İletişim & Telefon Soruları"
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Tetikleyici Kelimeler (Virgülle Ayırın)</label>
                <input
                  type="text"
                  value={newRuleKeywords}
                  onChange={(e) => setNewRuleKeywords(e.target.value)}
                  placeholder="telefon, whatsapp, numara, ara"
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Gönderilecek Otomatik Yanıt Metni</label>
              <textarea
                value={newRuleReply}
                onChange={(e) => setNewRuleReply(e.target.value)}
                placeholder="Örn: Bize 0850 ... numarasından veya profildeki WhatsApp hattımızdan 7/24 ulaşabilirsiniz! "
                className="form-input"
                rows={2}
              />
            </div>

            <button onClick={addCustomRule} className="btn-primary" style={{ fontSize: "0.85rem" }}>
              Kuralı Ekle & Kaydet
            </button>
          </div>

          {/* Son Yanıtlanan Yorumlar */}
          <div className="panel-card">
            <h3 style={{ fontSize: "1.05rem", fontWeight: "600", marginBottom: "0.75rem" }}>
              Son Otomatik Yanıtlanan Yorumlar ({autoReplyHistory.length})
            </h3>

            {autoReplyHistory.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: "0.85rem" }}>Henüz otomatik yanıt verilmiş bir yorum bulunmuyor.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {autoReplyHistory.slice(0, 15).map((rec, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "rgba(0,0,0,0.25)",
                      padding: "0.75rem",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.04)",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem", color: "#9ca3af", fontSize: "0.75rem" }}>
                      <span>
                        {rec.platform === "instagram" ? "Instagram" : "Facebook"} • <strong>{rec.authorName}</strong>
                      </span>
                      <span>{new Date(rec.repliedAt).toLocaleString("tr-TR")}</span>
                    </div>
                    <div style={{ color: "#f3f4f6", marginBottom: "0.3rem" }}>
                      Yorum: "<em>{rec.commentText}</em>"
                    </div>
                    <div style={{ color: "#34d399", paddingLeft: "1rem", borderLeft: "2px solid #10b981" }}>
                      Verilen Yanıt: {rec.replyText}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TELEGRAM & WEBHOOK */}
      {activeTab === "telegram" && (
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: "600" }}>Telegram Yapılandırması</h2>
              <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Telegram bot anahtarı ve yetkili kullanıcı ayarları</p>
            </div>
            <button
              onClick={() => testConnection("telegram", { botToken: settings.telegramBotToken })}
              disabled={testResults["telegram"]?.loading || !settings.telegramBotToken}
              className="btn-secondary"
            >
              {testResults["telegram"]?.loading ? "Kontrol ediliyor..." : "Bağlantıyı Test Et"}
            </button>
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Telegram Bot Token (@BotFather)</label>
              <button onClick={() => showHelp("telegramBotToken")} className="btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>
                Nasıl Alınır?
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
                Nasıl Alınır?
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
              <h3 style={{ fontSize: "0.95rem", fontWeight: "600" }}>Telegram Webhook Kurulumu</h3>
              <button onClick={() => showHelp("webhook")} className="btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>
                Nasıl Alınır?
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
                Webhook'u Kaydet 
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
              <h2 style={{ fontSize: "1.15rem", fontWeight: "600" }}>Facebook Sayfası & Instagram</h2>
              <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Sayfanızda otomatik paylaşım yetkileri</p>
            </div>
            <button
              onClick={() => testConnection("facebook", { pageId: settings.fbPageId, pageAccessToken: settings.fbPageAccessToken })}
              disabled={testResults["facebook"]?.loading || !settings.fbPageAccessToken}
              className="btn-secondary"
            >
              {testResults["facebook"]?.loading ? "Kontrol ediliyor..." : "Facebook Test Et"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Facebook Page ID</label>
                <button onClick={() => showHelp("fbPageId")} className="btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>
                  Nasıl Alınır?
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
                Nasıl Alınır?
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
              <h3 style={{ fontSize: "0.95rem", fontWeight: "600" }}>Instagram Bağlantısı (Opsiyonel)</h3>
              <button
                onClick={() => testConnection("instagram", { igUserId: settings.igUserId, pageAccessToken: settings.fbPageAccessToken })}
                disabled={testResults["instagram"]?.loading || !settings.igUserId}
                className="btn-secondary"
              >
                {testResults["instagram"]?.loading ? "..." : "Instagram Test Et"}
              </button>
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Instagram Business User ID</label>
                <button onClick={() => showHelp("igUserId")} className="btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>
                  Nasıl Alınır?
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
              <h2 style={{ fontSize: "1.15rem", fontWeight: "600" }}>LinkedIn Bağlantısı (Opsiyonel)</h2>
              <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>LinkedIn profil veya şirket sayfası paylaşımı</p>
            </div>
            <button
              onClick={() => testConnection("linkedin", { accessToken: settings.linkedinAccessToken, organizationId: settings.linkedinOrganizationId || "" })}
              disabled={testResults["linkedin"]?.loading || !settings.linkedinAccessToken}
              className="btn-secondary"
            >
              {testResults["linkedin"]?.loading ? "Kontrol ediliyor..." : "Bağlantıyı Test Et"}
            </button>
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label className="form-label" style={{ marginBottom: 0 }}>LinkedIn Access Token</label>
              <button onClick={() => showHelp("linkedinAccessToken")} className="btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>
                Nasıl Alınır?
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

          <div className="form-group" style={{ marginTop: "1rem" }}>
            <label className="form-label">Şirket Sayfası (Organization) ID (Opsiyonel)</label>
            <input
              type="text"
              value={settings.linkedinOrganizationId || ""}
              onChange={(e) => handleChange("linkedinOrganizationId", e.target.value)}
              placeholder="Örn: 112026985 (Boş bırakılırsa kişisel profilde paylaşılır)"
              className="form-input"
            />
            <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>
              Şirketinizin LinkedIn admin URL&apos;sindeki rakamdır. (Örn: linkedin.com/company/<strong>112026985</strong>/admin)
            </p>
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
              <h2 style={{ fontSize: "1.15rem", fontWeight: "600" }}>Cloudinary (Medya CDN)</h2>
              <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Instagram ve medya dosyaları için</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={() => showHelp("cloudinary")} className="btn-secondary">
                Nasıl Alınır?
              </button>
              <button
                onClick={() => testConnection("cloudinary", { cloudName: settings.cloudinaryCloudName, apiKey: settings.cloudinaryApiKey, apiSecret: settings.cloudinaryApiSecret })}
                disabled={testResults["cloudinary"]?.loading || !settings.cloudinaryCloudName}
                className="btn-secondary"
              >
                {testResults["cloudinary"]?.loading ? "..." : "Ping Testi"}
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
          {/* 1. Yapay Zeka (AI) Başlık & Hashtag Üretici */}
          <div className="panel-card">
            <div className="panel-header">
              <div>
                <h2 style={{ fontSize: "1.15rem", fontWeight: "600" }}>Yapay Zeka (AI) Başlık & Hashtag Üretici</h2>
                <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                  Google Gemini Vision modeli fotoğrafları piksel piksel inceleyip otomatik Türkçe başlık ve popüler etiketler üretir
                </p>
              </div>
              <span className={settings.geminiApiKey ? "badge-connected" : "badge-disconnected"}>
                {settings.geminiApiKey ? "Aktif" : "API Key Bekleniyor"}
              </span>
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Google Gemini API Key</label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#60a5fa", fontSize: "0.8rem", textDecoration: "none" }}
                >
                  Ücretsiz API Key Al (Google AI Studio)
                </a>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showTokens["gemini"] ? "text" : "password"}
                  value={settings.geminiApiKey || ""}
                  onChange={(e) => handleChange("geminiApiKey" as any, e.target.value)}
                  placeholder="AIzaSy..."
                  className="form-input"
                  style={{ paddingRight: "4rem" }}
                />
                <button
                  type="button"
                  onClick={() => toggleVisibility("gemini")}
                  style={{ position: "absolute", right: "0.6rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "0.8rem" }}
                >
                  {showTokens["gemini"] ? "Gizle" : "Göster"}
                </button>
              </div>
              <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.35rem" }}>
                API Key girilmediğinde sistem dahili seyahat şablon başlıklarını kullanır. Gemini API key girdiğinizde ise fotoğraftaki mekanı, havayı ve nesneleri analiz ederek özel başlık üretir.
              </p>
            </div>
          </div>

          {/* 2. Otomatik Logo / Filigran (Watermark) */}
          <div className="panel-card">
            <div className="panel-header">
              <div>
                <h2 style={{ fontSize: "1.15rem", fontWeight: "600" }}>Otomatik Logo / Filigran (Watermark)</h2>
                <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                  Tüm paylaşılan fotoğrafların sağ alt köşesine kurumsal logonuzu veya şık Günübirlik rozetini otomatik basar
                </p>
              </div>
              <span className={settings.watermarkEnabled !== false ? "badge-connected" : "badge-disconnected"}>
                {settings.watermarkEnabled !== false ? "Filigran Aktif" : "Devre Dışı"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", alignItems: "start" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
                  <input
                    type="checkbox"
                    id="watermarkToggle"
                    checked={settings.watermarkEnabled !== false}
                    onChange={(e) => setSettings((prev) => ({ ...prev, watermarkEnabled: e.target.checked }))}
                    style={{ width: "18px", height: "18px", accentColor: "#5bb8ac", cursor: "pointer" }}
                  />
                  <label htmlFor="watermarkToggle" style={{ fontSize: "0.9rem", color: "#f3f4f6", cursor: "pointer", fontWeight: 500 }}>
                    Tüm paylaşılan fotoğraflara otomatik filigran bas
                  </label>
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label">Filigran Metni (Şablon İçin)</label>
                  <input
                    type="text"
                    value={settings.watermarkText || "Günübirlik"}
                    onChange={(e) => handleChange("watermarkText" as any, e.target.value)}
                    placeholder="Günübirlik"
                    className="form-input"
                  />
                </div>

                {/* Cihazdan Logo Yükleme Alanı */}
                <div style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px dashed rgba(120, 207, 195, 0.35)",
                  borderRadius: "10px",
                  padding: "1rem",
                  marginTop: "0.75rem"
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#e5e7eb" }}>
                      Özel Logo (Cihazınızdan)
                    </span>
                    {customLogoUrl ? (
                      <span style={{ fontSize: "0.72rem", background: "rgba(91, 184, 172, 0.2)", color: "#78cfc3", padding: "0.15rem 0.5rem", borderRadius: "9999px", border: "1px solid rgba(120, 207, 195, 0.4)" }}>
                        Özel Logo Aktif
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.72rem", background: "rgba(255, 255, 255, 0.05)", color: "#9ca3af", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                        Şablon Rozet Aktif
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: "0.76rem", color: "#9ca3af", lineHeight: 1.4, marginBottom: "0.85rem" }}>
                    Cihazınızdan PNG veya SVG formatında şeffaf logoyu yükleyin. Yüklediğiniz logo fotoğraf köşelerinde otomatik kullanılır.
                  </p>

                  <input
                    type="file"
                    ref={logoInputRef}
                    onChange={handleUploadLogo}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    style={{ display: "none" }}
                  />

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
                    <button
                      type="button"
                      disabled={logoUploading}
                      onClick={() => logoInputRef.current?.click()}
                      className="btn"
                      style={{
                        background: "rgba(91, 184, 172, 0.2)",
                        color: "#78cfc3",
                        border: "1px solid rgba(120, 207, 195, 0.45)",
                        fontSize: "0.82rem",
                        padding: "0.45rem 0.9rem",
                        cursor: logoUploading ? "not-allowed" : "pointer"
                      }}
                    >
                      {logoUploading ? "Yükleniyor..." : "📁 Cihazdan Logo Seç"}
                    </button>

                    {customLogoUrl && (
                      <button
                        type="button"
                        disabled={logoUploading}
                        onClick={handleDeleteLogo}
                        className="btn"
                        style={{
                          background: "rgba(239, 68, 68, 0.15)",
                          color: "#fca5a5",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          fontSize: "0.82rem",
                          padding: "0.45rem 0.9rem",
                          cursor: logoUploading ? "not-allowed" : "pointer"
                        }}
                      >
                        🗑️ Logoyu Kaldır (Şablona Dön)
                      </button>
                    )}
                  </div>

                  {logoStatus && (
                    <div style={{ marginTop: "0.6rem", fontSize: "0.78rem", color: logoStatus.startsWith("✅") ? "#6ee7b7" : "#cbd5e1" }}>
                      {logoStatus}
                    </div>
                  )}
                </div>
              </div>

              {/* Rozet Önizleme */}
              <div style={{
                background: "rgba(0,0,0,0.5)",
                padding: "1.5rem",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.08)",
                textAlign: "center"
              }}>
                <span style={{ fontSize: "0.75rem", color: "#9ca3af", display: "block", marginBottom: "1rem", letterSpacing: "0.5px" }}>
                  Canlı Filigran Önizlemesi (Fotoğrafın Sağ Alt Köşesi)
                </span>

                {customLogoUrl ? (
                  <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(11, 20, 23, 0.88)",
                    border: "1.5px solid rgba(120, 207, 195, 0.4)",
                    borderRadius: "28px",
                    padding: "0.7rem 1.6rem",
                    boxShadow: "0 10px 28px rgba(0,0,0,0.6)",
                    minWidth: "220px",
                    minHeight: "56px"
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={customLogoUrl}
                      alt="Özel Filigran Logo"
                      style={{ maxHeight: "42px", maxWidth: "180px", objectFit: "contain" }}
                    />
                  </div>
                ) : (
                  <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.85rem",
                    background: "linear-gradient(135deg, rgba(11, 20, 23, 0.95) 0%, rgba(20, 36, 41, 0.92) 100%)",
                    border: "1.5px solid rgba(120, 207, 195, 0.45)",
                    borderRadius: "32px",
                    padding: "0.55rem 1.25rem 0.55rem 0.75rem",
                    boxShadow: "0 10px 28px rgba(0, 0, 0, 0.65)"
                  }}>
                    {/* Sol Monogram */}
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #5bb8ac 0%, #2d7a70 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      fontWeight: 800,
                      fontSize: "1.1rem",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
                    }}>
                      G
                    </div>

                    {/* Metinler */}
                    <div style={{ textAlign: "left" }}>
                      <div style={{
                        color: "#ffffff",
                        fontWeight: 800,
                        fontSize: "0.98rem",
                        letterSpacing: "0.8px",
                        lineHeight: 1.15,
                        fontFamily: "'Plus Jakarta Sans', 'Montserrat', 'Inter', sans-serif"
                      }}>
                        {settings.watermarkText || "Günübirlik"}
                      </div>
                      <div style={{
                        color: "#93a6aa",
                        fontWeight: 700,
                        fontSize: "0.62rem",
                        letterSpacing: "1.4px",
                        marginTop: "2px",
                        fontFamily: "'Plus Jakarta Sans', 'Montserrat', 'Inter', sans-serif"
                      }}>
                        GÜNLÜK İŞ & ELEMAN
                      </div>
                    </div>

                    {/* Sağ Durum Işığı */}
                    <div style={{
                      marginLeft: "0.4rem",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#5bb8ac",
                      boxShadow: "0 0 8px #5bb8ac"
                    }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. E-Posta Bildirim Ayarları */}
          <div className="panel-card">
            <div className="panel-header">
              <div>
                <h2 style={{ fontSize: "1.15rem", fontWeight: "600" }}>E-Posta Bildirim Sistemi</h2>
                <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Paylaşımlar tamamlandığında veya hata oluştuğunda e-posta raporu alın</p>
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
                <label className="form-label">SMTP Sunucusu</label>
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

          {/* 4. Sisteme Eklenebilecek Gelecek Yenilikçi Özellikler */}
          <div className="panel-card">
            <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "0.5rem" }}>Eklenebilecek Yeni Süper Özellik Önerileri</h3>
            <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "1.25rem" }}>
              Zamanlayıcı, AI Başlık, Filigran ve Geçmiş başarıyla entegre edildi! İşte projenizi daha da büyütecek sonraki adım önerileri:
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}></div>
                <h4 style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "0.25rem" }}>1. Instagram Hikaye (Story) & Reels Paylaşımı</h4>
                <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                  Sadece feed gönderisi değil; Telegram'dan video veya fotoğraf attığınızda doğrudan Instagram Story veya Reels olarak otomatik boyutlandırılıp yayınlansın.
                </p>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}></div>
                <h4 style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "0.25rem" }}>2. Telegram Kanal & Grup Dinleyicisi</h4>
                <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                  Botu yöneticisi olduğunuz bir Telegram kanalına veya seyahat grubunuza eklersiniz. Kanala atılan her tur duyurusu otomatik tüm sosyal ağlara dağıtılır.
                </p>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}></div>
                <h4 style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "0.25rem" }}>3. Akıllı Paylaşım Saati Önerisi (Smart Time)</h4>
                <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                  Sayfanızın takipçilerinin en aktif olduğu saatleri (örn. Cuma 19:30, Pazar 11:00) analiz ederek bot size "En yüksek etkileşim için Pazar 11:00'e zamanlayalım mı?" der.
                </p>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}></div>
                <h4 style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "0.25rem" }}>4. Otomatik Yorum & DM Yanıtlama (Auto-Reply)</h4>
                <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                  Instagram ve Facebook'ta gönderinin altına gelen "fiyat nedir?", "neresi burası?", "detay alabilir miyim?" yorumlarına anında otomatik yanıt veya DM gönderir.
                </p>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}></div>
                <h4 style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "0.25rem" }}>5. Çok Dilli (Multi-Language) Paylaşım</h4>
                <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                  Yabancı turistlere hitap etmek için AI aynı gönderinin altına İngilizce, Rusça veya Almanca çevirisini ve küresel hashtag'leri otomatik ekler.
                </p>
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}></div>
                <h4 style={{ fontSize: "0.95rem", fontWeight: "600", marginBottom: "0.25rem" }}>6. Çoklu Fotoğraf / Karusel (Carousel) Desteği</h4>
                <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                  Telegram'dan 5-10 fotoğrafı albüm olarak gönderdiğinizde, Instagram ve Facebook'ta kaydırmalı galeri (karusel) şeklinde paylaşır.
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
                {helpModal.title}
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
                <strong>Önemli:</strong> {helpModal.tip}
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
                  {helpModal.link.label}
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
      </main>
    </div>
  );
}
