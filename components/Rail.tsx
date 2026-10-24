"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatAgo } from "@/lib/ui/time";

export interface RailItem {
  id: string;
  label: string;
  count?: number;
}

export interface RailGroup {
  title: string;
  items: RailItem[];
}

interface Props {
  groups: RailGroup[];
  active?: string;
  onSelect?: (id: string) => void;
  onDebugPage?: boolean;
}

interface Pulse {
  botAlive: boolean | null;
  lastBeat: string | null;
  errorsLastHour: number;
}

function usePulse(): Pulse {
  const [pulse, setPulse] = useState<Pulse>({ botAlive: null, lastBeat: null, errorsLastHour: 0 });

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
          errorsLastHour: data.summary.errorsLastHour,
        });
      } catch {
        // Ağ hatası menüyü bozmasın
      }
    };
    load();
    const timer = setInterval(load, 10_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  return pulse;
}

export default function Rail({ groups, active, onSelect, onDebugPage }: Props) {
  const pulse = usePulse();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("gb_theme");
    if (saved === "dark") {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("gb_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("gb_theme", "light");
    }
  };

  return (
    <aside className="rail" aria-label="Ana menü">
      {/* Marka & Logo Alanı */}
      <div className="rail-brand">
        <Link href="/" className="rail-brand-link">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-wordmark.webp"
            alt="Günübirlik"
            className="rail-brand-logo"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/logo.png";
            }}
          />
        </Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.5rem" }}>
          <span className="rail-brand-badge">
            YAYIN &amp; İŞ BOTU
          </span>
          <a
            href="https://gunubirlik.qrders.com.tr"
            target="_blank"
            rel="noopener noreferrer"
            title="Canlı Günübirlik web sitesine git"
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              color: "var(--brand-green)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "2px"
            }}
          >
            <span>gunubirlik.qrders.com.tr</span>
            <span>↗</span>
          </a>
        </div>
      </div>

      {/* Navigasyon Listesi */}
      <nav className="rail-nav">
        {groups.map((group) => (
          <div className="rail-group" key={group.title}>
            <p className="rail-group-title">{group.title}</p>
            {group.items.map((item) => {
              const isActive = !onDebugPage && active === item.id;
              const content = (
                <>
                  <span>{item.label}</span>
                  {item.count ? <span className="rail-count">{item.count}</span> : null}
                </>
              );
              return onSelect ? (
                <button
                  key={item.id}
                  type="button"
                  className="rail-item"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onSelect(item.id)}
                >
                  {content}
                </button>
              ) : (
                <Link key={item.id} href={`/?tab=${item.id}`} className="rail-item" aria-current={isActive ? "page" : undefined}>
                  {content}
                </Link>
              );
            })}
          </div>
        ))}

        <div className="rail-group">
          <p className="rail-group-title">Sistem &amp; Tanı</p>
          <Link href="/debug" className="rail-item" aria-current={onDebugPage ? "page" : undefined}>
            <span>Hata &amp; Günlük Kayıtları</span>
            {pulse.errorsLastHour > 0 ? (
              <span className="rail-count rail-count-alert" title="Son 1 saatteki hata sayısı">
                {pulse.errorsLastHour}
              </span>
            ) : null}
          </Link>
        </div>
      </nav>

      {/* Alt Durum & Tema Alanı */}
      <div className="rail-status" aria-live="polite">
        <span
          className={`dot ${pulse.botAlive === null ? "dot-idle" : pulse.botAlive ? "dot-ok" : "dot-bad"}`}
          aria-hidden="true"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="rail-status-line">
            {pulse.botAlive === null ? "Bot okunuyor..." : pulse.botAlive ? "Telegram Botu Aktif" : "Telegram Botu Kapalı"}
          </p>
          {pulse.lastBeat ? <p className="rail-status-sub">sinyal: {formatAgo(pulse.lastBeat)}</p> : null}
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? "Açık Temaya Geç (Varsayılan)" : "Karanlık Temaya Geç"}
          style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--line)",
            borderRadius: "6px",
            padding: "0.25rem 0.45rem",
            fontSize: "0.82rem",
            cursor: "pointer",
            color: "var(--text)"
          }}
        >
          {isDark ? "☀️" : "🌙"}
        </button>
      </div>
    </aside>
  );
}
