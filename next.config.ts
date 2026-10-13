import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sharp'ın sunucu tarafında düzgün çalışması için
  serverExternalPackages: ["sharp"],
  // API route boyut limiti — büyük fotoğraflar için (Telegram max 20MB gönderir)
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
