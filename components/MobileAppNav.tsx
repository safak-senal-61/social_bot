"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Props {
  active?: string;
  onSelect?: (id: string) => void;
  onDebugPage?: boolean;
}

interface Pulse {
  botAlive: boolean | null;
  lastBeat: string | null;
}

export default function MobileAppNav({ active, onSelect, onDebugPage }: Props) {
  const [pulse, setPulse] = useState<Pulse>({ botAlive: null, lastBeat: null });

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const res = await fetch("/api/logs?summary=1", { cache: "no-store" });
        const data = await res.json();
        if (stopped || !data.success) return;
        setPulse({
          botAlive: data.bot.alive,
          lastBeat: data.bot.lastBeat,
        });
      } catch {}
    };
    load();
    const timer = setInterval(load, 12_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  const navItems = [
    { id: "overview", label: "Genel", icon: "📊" },
    { id: "aistudio", label: "AI Stüdyo", icon: "✨" },
    { id: "schedule", label: "Kuyruk", icon: "⏰" },
    { id: "history", label: "Geçmiş", icon: "📜" },
    { id: "features", label: "Ayarlar", icon: "⚙️" },
  ];

  return (
    <>
      {/* Mobil Üst Bar (Sticky Header) */}
      <header className="mobile-top-bar" aria-label="Mobil Başlık">
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <Link href="/" className="mobile-top-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-wordmark.webp"
              alt="Günübirlik"
              onError={(e) => {
                // Eğer webp yüklenemezse png'ye dön
                (e.target as HTMLImageElement).src = "/logo.png";
              }}
            />
          </Link>
          <span style={{
            fontSize: "0.65rem",
            fontFamily: "var(--font-code)",
            fontWeight: 700,
            background: "var(--brand-mint)",
            color: "var(--brand-green)",
            padding: "0.1rem 0.4rem",
            borderRadius: "4px",
            border: "1px solid rgba(13, 104, 71, 0.2)"
          }}>
            PANEL
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            className={`dot ${pulse.botAlive === null ? "dot-idle" : pulse.botAlive ? "dot-ok" : "dot-bad"}`}
            title={pulse.botAlive ? "Bot aktif" : "Bot kapalı"}
          />
          <a
            href="https://gunubirlik.qrders.com.tr"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "0.72rem",
              fontWeight: 600,
              color: "var(--brand-green)",
              background: "var(--brand-mint)",
              border: "1px solid rgba(13, 104, 71, 0.25)",
              padding: "0.2rem 0.55rem",
              borderRadius: "6px",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem"
            }}
          >
            <span>Web Sitesi</span>
            <span style={{ fontSize: "0.65rem" }}>↗</span>
          </a>
        </div>
      </header>

      {/* Mobil Alt Menü Barı (iOS/Android App Style Navigation) */}
      <nav className="mobile-bottom-nav" aria-label="Mobil Menü">
        {navItems.map((item) => {
          const isActive = !onDebugPage && active === item.id;
          return onSelect ? (
            <button
              key={item.id}
              type="button"
              className={`mobile-nav-btn ${isActive ? "is-active" : ""}`}
              onClick={() => onSelect(item.id)}
            >
              <span className="mobile-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {isActive && <span className="mobile-nav-dot" />}
            </button>
          ) : (
            <Link
              key={item.id}
              href={`/?tab=${item.id}`}
              className={`mobile-nav-btn ${isActive ? "is-active" : ""}`}
            >
              <span className="mobile-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {isActive && <span className="mobile-nav-dot" />}
            </Link>
          );
        })}

        {/* Debug Butonu */}
        <Link
          href="/debug"
          className={`mobile-nav-btn ${onDebugPage ? "is-active" : ""}`}
        >
          <span className="mobile-nav-icon">🐞</span>
          <span>Debug</span>
          {onDebugPage && <span className="mobile-nav-dot" />}
        </Link>
      </nav>
    </>
  );
}
