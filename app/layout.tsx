import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import ClientErrorReporter from "@/components/ClientErrorReporter";
import "./globals.css";

const ui = Bricolage_Grotesque({
  variable: "--font-ui",
  subsets: ["latin", "latin-ext"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Günübirlik · Yayın paneli",
  description: "Telegram'dan gönderilen içerikleri Facebook, Instagram ve LinkedIn'de yayınlayan yönetim paneli.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${ui.variable} ${mono.variable}`}>
      <body>
        <ClientErrorReporter />
        {children}
      </body>
    </html>
  );
}
