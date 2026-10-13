# Social Poster Bot — Next.js + Telegraf

Telegram botuna gönderilen fotoğraf/videoları **Instagram**, **Facebook** ve **LinkedIn**'e aynı anda paylaşan, Next.js 14 App Router tabanlı tam-yığın uygulama.

## 📁 Proje Yapısı

```
social-poster/
│
├── app/
│   ├── page.tsx                        # 🖥️  Dashboard arayüzü
│   └── api/
│       ├── webhook/route.ts            # 📡 Telegram webhook alıcısı
│       └── setup-webhook/route.ts      # 🔧 Webhook kayıt endpoint'i
│
├── lib/
│   ├── config.ts                       # ⚙️  Merkezi konfigürasyon
│   ├── types.ts                        # 📝 TypeScript tipleri
│   ├── telegram/
│   │   └── bot.ts                      # 🤖 Telegraf bot + tüm handler'lar
│   ├── media/
│   │   └── processor.ts               # 🖼️  Sharp ile medya işleme
│   ├── uploader/
│   │   └── cloudinary.ts              # ☁️  Cloudinary yükleyici
│   └── publishers/
│       ├── facebook.ts                # 👍 Facebook Graph API
│       ├── instagram.ts               # 📷 Instagram Graph API
│       └── linkedin.ts                # 💼 LinkedIn REST API
│
├── .env.local                          # 🔑 API anahtarları (git'e eklenme!)
├── next.config.ts
└── package.json
```

## 🚀 Kurulum

### 1. Bağımlılıklar zaten kurulu. Sadece `.env.local` dosyasını doldurun:

```bash
# .env.local dosyasını açın
notepad .env.local
```

Şu değerleri girin:
- `TELEGRAM_BOT_TOKEN`
- `FB_PAGE_ACCESS_TOKEN`, `FB_PAGE_ID`, `IG_USER_ID`
- `LINKEDIN_ACCESS_TOKEN`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `ALLOWED_USER_IDS` (kendi Telegram ID'niz)
- `TELEGRAM_SECRET_TOKEN` (istediğiniz gizli bir string)

### 2. Geliştirme sunucusunu başlatın

```bash
npm run dev
```

→ [http://localhost:3000](http://localhost:3000) adresinde dashboard açılır.

---

## 🔗 Webhook Kurulumu

### Yerel geliştirme için — ngrok ile

```bash
# Yeni terminal penceresinde:
npx ngrok http 3000

# Verilen URL ile webhook'u kaydedin:
# Tarayıcıda açın:
http://localhost:3000/api/setup-webhook?url=https://xxxx.ngrok.io
```

### Üretim (Vercel) için

```bash
# Deploy sonrası:
https://your-app.vercel.app/api/setup-webhook?url=https://your-app.vercel.app
```

---

## 🔑 API Token Alma

### Telegram
1. @BotFather → `/newbot` → Token'ı `.env.local`'e yapıştırın
2. Kendi Telegram ID'niz: @userinfobot'a mesaj gönderin

### Facebook + Instagram
1. [developers.facebook.com](https://developers.facebook.com) → İşletme uygulaması oluşturun
2. İzinler: `pages_manage_posts`, `instagram_content_publish`
3. Uzun ömürlü token alın (60 gün geçerli):
```bash
curl "https://graph.facebook.com/v21.0/oauth/access_token\
?grant_type=fb_exchange_token\
&client_id=APP_ID&client_secret=APP_SECRET\
&fb_exchange_token=KISA_TOKEN"
```

### LinkedIn
1. [linkedin.com/developers](https://www.linkedin.com/developers/) → Uygulama oluşturun
2. Products: "Share on LinkedIn" + "Sign In with LinkedIn using OpenID Connect"
3. OAuth 2.0 Authorization Code Flow ile token alın

### Cloudinary
1. [cloudinary.com](https://cloudinary.com) → Ücretsiz hesap açın
2. Dashboard → Cloud Name, API Key, API Secret

---

## 📡 API Endpointleri

| Method | URL | Açıklama |
|--------|-----|----------|
| `POST` | `/api/webhook` | Telegram webhook alıcısı |
| `GET`  | `/api/setup-webhook?url=...` | Webhook'u Telegram'a kaydet |
| `GET`  | `/api/webhook` | Bot durum kontrolü |

---

## 🏗️ Mimari

```
Telegram Bot
    │ (HTTPS POST)
    ▼
/api/webhook  ──────────►  Telegraf bot.handleUpdate()
                                    │
                          ┌─────────┼─────────┐
                          ▼         ▼         ▼
                    MediaProcessor  │   CloudinaryUploader
                    (Sharp)         │   (public URL)
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
             InstagramPublisher  FacebookPublisher  LinkedInPublisher
             (2-step container)  (URL/file upload)  (registerUpload)
```

---

## ⚠️ Önemli Notlar

- **Instagram**: İşletme veya İçerik Üretici hesabı + Facebook Sayfasına bağlı olmalı
- **Next.js bodyLimit**: Telegram'dan gelen dosyalar için `25mb` olarak ayarlandı
- **Sharp**: `serverExternalPackages` listesinde — Edge Runtime'da çalışmaz, Node.js kullanılır
- **Token güvenliği**: `.env.local` asla git'e eklenmez (`.gitignore`'da varsayılan olarak hariç)
