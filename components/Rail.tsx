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
  /** Panel sayfasında aktif sekme; /debug sayfasında boş bırakılır */
  active?: string;
  /** Verilirse öğeler buton olur (aynı sayfada sekme geçişi), verilmezse /?tab=... bağlantısı */
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
        // Ağ hatası menüyü bozmasın; bir sonraki turda tekrar denenir
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

  return (
    <aside className="rail" aria-label="Ana menü">
      <div className="rail-brand">
        <span className="rail-brand-name">Günübirlik</span>
        <span className="rail-brand-sub">Yayın paneli</span>
      </div>

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
          <p className="rail-group-title">Sorun giderme</p>
          <Link href="/debug" className="rail-item" aria-current={onDebugPage ? "page" : undefined}>
            <span>Hata ayıklama</span>
            {pulse.errorsLastHour > 0 ? (
              <span className="rail-count rail-count-alert" title="Son 1 saatteki hata sayısı">
                {pulse.errorsLastHour}
              </span>
            ) : null}
          </Link>
        </div>
      </nav>

      <div className="rail-status" aria-live="polite">
        <span
          className={`dot ${pulse.botAlive === null ? "dot-idle" : pulse.botAlive ? "dot-ok" : "dot-bad"}`}
          aria-hidden="true"
        />
        <div>
          <p className="rail-status-line">
            {pulse.botAlive === null ? "Bot durumu okunuyor" : pulse.botAlive ? "Telegram botu çalışıyor" : "Telegram botu kapalı"}
          </p>
          {pulse.lastBeat ? <p className="rail-status-sub">son sinyal {formatAgo(pulse.lastBeat)}</p> : null}
        </div>
      </div>
    </aside>
  );
}
