"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Rail from "@/components/Rail";
import MobileAppNav from "@/components/MobileAppNav";
import { RAIL_GROUPS } from "@/lib/ui/navigation";
import {
  filterLogs,
  groupErrors,
  summarizeLogs,
  type LogLevel,
  type LogSource,
  type SystemLogEntry,
} from "@/lib/storage/log_analysis";
import { formatAgo, formatClock } from "@/lib/ui/time";

const LEVEL_LABEL: Record<LogLevel, string> = {
  error: "Hata",
  warn: "Uyarı",
  success: "Başarılı",
  info: "Bilgi",
};

const SOURCE_LABEL: Record<LogSource, string> = {
  telegram: "Telegram botu",
  web: "Panel sunucusu",
  client: "Panel tarayıcısı",
  api: "API",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  ai: "Yapay zeka",
  scheduler: "Zamanlayıcı",
  autoreply: "Otomatik yanıt",
  system: "Sistem",
};

const RANGES: Array<{ label: string; ms: number | undefined }> = [
  { label: "Son 15 dakika", ms: 15 * 60_000 },
  { label: "Son 1 saat", ms: 60 * 60_000 },
  { label: "Son 24 saat", ms: 24 * 60 * 60_000 },
  { label: "Tümü", ms: undefined },
];

interface BotState {
  alive: boolean;
  lastBeat: string | null;
  pid: number | null;
}

function stamp(iso: string, now: number): string {
  const sameDay = new Date(iso).toDateString() === new Date(now).toDateString();
  if (sameDay) return formatClock(iso);
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${formatClock(iso)}`;
}

function entryAsText(log: SystemLogEntry): string {
  return [
    `${log.timestamp}  [${LEVEL_LABEL[log.level]}]  ${SOURCE_LABEL[log.source]} (${log.origin})`,
    log.message,
    log.details ? `Ayrıntı: ${log.details}` : "",
    log.durationMs !== undefined ? `Süre: ${log.durationMs} ms` : "",
    log.stack ? `\n${log.stack}` : "",
    `Kayıt kimliği: ${log.id}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function EntryDetail({ log }: { log: SystemLogEntry }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(entryAsText(log));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // pano erişimi reddedildiyse sessizce vazgeç
    }
  };
  return (
    <div className="dbg-detail">
      <p className="dbg-detail-message">{log.message}</p>
      <dl className="dbg-meta">
        <div>
          <dt>Zaman</dt>
          <dd>{new Date(log.timestamp).toLocaleString("tr-TR")}</dd>
        </div>
        <div>
          <dt>Kaynak</dt>
          <dd>
            {SOURCE_LABEL[log.source]} · {log.origin === "bot" ? "bot süreci" : "web süreci"}
          </dd>
        </div>
        {log.durationMs !== undefined && (
          <div>
            <dt>Süre</dt>
            <dd>{log.durationMs} ms</dd>
          </div>
        )}
        <div>
          <dt>Kayıt kimliği</dt>
          <dd>{log.id}</dd>
        </div>
      </dl>
      {log.details && (
        <>
          <p className="dbg-detail-label">Ayrıntı</p>
          <pre className="dbg-pre">{log.details}</pre>
        </>
      )}
      {log.stack && (
        <>
          <p className="dbg-detail-label">Hata izi (stack)</p>
          <pre className="dbg-pre">{log.stack}</pre>
        </>
      )}
      <button type="button" className="btn-secondary" onClick={copy}>
        {copied ? "Kopyalandı" : "Kaydı kopyala"}
      </button>
    </div>
  );
}

export default function DebugPage() {
  const [all, setAll] = useState<SystemLogEntry[]>([]);
  const [bot, setBot] = useState<BotState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(Date.now());
  const [now, setNow] = useState<number>(Date.now());

  const [view, setView] = useState<"stream" | "groups">("stream");
  const [levels, setLevels] = useState<LogLevel[]>([]);
  const [source, setSource] = useState<LogSource | "all">("all");
  const [rangeIndex, setRangeIndex] = useState(3);
  const [query, setQuery] = useState("");
  const [live, setLive] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Okuma sırasında akışın kaymaması için yeni kayıtlar listeye ancak kullanıcı en üstteyse eklenir
  const [shown, setShown] = useState<SystemLogEntry[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const frozen = expanded !== null || scrolled;

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/logs", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Beklenmeyen yanıt");
      setAll(data.logs as SystemLogEntry[]);
      setBot(data.bot as BotState);
      setFetchError(null);
      setLastFetch(Date.now());
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [live, load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!frozen) setShown(all);
  }, [all, frozen]);

  const pendingCount = Math.max(0, all.length - shown.length);

  const summary = useMemo(() => summarizeLogs(all, now), [all, now]);
  const visible = useMemo(
    () =>
      filterLogs(
        shown,
        {
          levels: levels.length ? levels : undefined,
          sources: source === "all" ? undefined : [source],
          query,
          sinceMs: RANGES[rangeIndex].ms,
        },
        now
      ),
    [shown, levels, source, query, rangeIndex, now]
  );
  const groups = useMemo(() => groupErrors(visible), [visible]);

  const toggleLevel = (level: LogLevel) =>
    setLevels((prev) => (prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]));

  const post = async (action: "clear" | "test") => {
    if (action === "clear" && !confirm("Tüm kayıtlar silinecek. Bu işlem geri alınamaz. Devam edilsin mi?")) return;
    await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setExpanded(null);
    await load();
  };

  const download = () => {
    const blob = new Blob([JSON.stringify(visible, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gunubirlik-kayitlar-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const levelCounts = summary.byLevel;
  const sourcesPresent = (Object.keys(summary.bySource) as LogSource[]).sort();

  return (
    <div className="shell">
      <MobileAppNav onDebugPage />
      <Rail groups={RAIL_GROUPS} onDebugPage />
      <main className="stage">
        <header className="stage-head">
          <div>
            <h1>Hata ayıklama</h1>
            <p className="stage-lead">
              Telegram botunun, panelin ve Facebook, Instagram, LinkedIn çağrılarının tek akışı. Hatalar ve
              uyarılar burada toplanır.
            </p>
          </div>
          <div className="dbg-actions">
            <button type="button" className="btn-secondary" onClick={() => post("test")}>
              Test kaydı ekle
            </button>
            <button type="button" className="btn-secondary" onClick={download} disabled={!visible.length}>
              Görünenleri indir
            </button>
            <button type="button" className="btn-danger" onClick={() => post("clear")} disabled={!all.length}>
              Kayıtları temizle
            </button>
          </div>
        </header>

        {fetchError && (
          <p className="status-note status-error" role="alert">
            Kayıtlar okunamadı: {fetchError}. Panel sunucusu çalışıyor mu?
          </p>
        )}

        <section className="dbg-vitals" aria-label="Genel durum">
          <div>
            <p className="dbg-vital-label">Telegram botu</p>
            <p className="dbg-vital-value">
              <span className={`dot ${bot?.alive ? "dot-ok" : "dot-bad"}`} aria-hidden="true" />
              {bot === null ? "…" : bot.alive ? "Çalışıyor" : "Kapalı"}
            </p>
            <p className="dbg-vital-sub">
              {bot?.lastBeat ? `son sinyal ${formatAgo(bot.lastBeat, now)}` : "hiç sinyal gelmedi: npm run bot çalışıyor mu?"}
            </p>
          </div>
          <div>
            <p className="dbg-vital-label">Son 1 saatteki hata</p>
            <p className={`dbg-vital-value ${summary.errorsLastHour ? "is-bad" : ""}`}>{summary.errorsLastHour}</p>
            <p className="dbg-vital-sub">
              {summary.lastErrorAt ? `en son ${formatAgo(summary.lastErrorAt, now)}` : "hata kaydı yok"}
            </p>
          </div>
          <div>
            <p className="dbg-vital-label">Toplam kayıt</p>
            <p className="dbg-vital-value">{summary.total}</p>
            <p className="dbg-vital-sub">
              {levelCounts.warn} uyarı · {levelCounts.success} başarılı işlem
            </p>
          </div>
          <div>
            <p className="dbg-vital-label">Son veri çekme</p>
            <p className="dbg-vital-value">{formatAgo(new Date(lastFetch).toISOString(), now)}</p>
            <p className="dbg-vital-sub">{live ? "3 saniyede bir yenileniyor" : "otomatik yenileme kapalı"}</p>
          </div>
        </section>

        <section className="dbg-filters" aria-label="Süzgeçler">
          <div className="dbg-levels" role="group" aria-label="Seviye">
            {(["error", "warn", "success", "info"] as LogLevel[]).map((level) => (
              <button
                key={level}
                type="button"
                className={`dbg-level dbg-level-${level}`}
                aria-pressed={levels.includes(level)}
                onClick={() => toggleLevel(level)}
              >
                {LEVEL_LABEL[level]} <span>{levelCounts[level]}</span>
              </button>
            ))}
          </div>

          <label className="dbg-field">
            <span>Kaynak</span>
            <select className="form-input" value={source} onChange={(e) => setSource(e.target.value as LogSource | "all")}>
              <option value="all">Tüm kaynaklar</option>
              {sourcesPresent.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]} ({summary.bySource[s]})
                </option>
              ))}
            </select>
          </label>

          <label className="dbg-field">
            <span>Zaman aralığı</span>
            <select className="form-input" value={rangeIndex} onChange={(e) => setRangeIndex(Number(e.target.value))}>
              {RANGES.map((r, i) => (
                <option key={r.label} value={i}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <label className="dbg-field dbg-field-grow">
            <span>Ara</span>
            <input
              className="form-input"
              type="search"
              placeholder="Mesaj veya ayrıntıda ara, örn. Missing Permission"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <label className="dbg-live">
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
            Canlı akış
          </label>
        </section>

        <div className="dbg-views" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view === "stream"}
            className="dbg-view"
            onClick={() => setView("stream")}
          >
            Akış <span>{visible.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "groups"}
            className="dbg-view"
            onClick={() => setView("groups")}
          >
            Hata grupları <span>{groups.length}</span>
          </button>
          {pendingCount > 0 && (
            <button type="button" className="dbg-pending" onClick={() => { setExpanded(null); setScrolled(false); listRef.current?.scrollTo({ top: 0 }); setShown(all); }}>
              {pendingCount} yeni kayıt, göster
            </button>
          )}
        </div>

        <div className="dbg-list" ref={listRef} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 40)}>
          {!loaded ? (
            <p className="dbg-empty">Kayıtlar yükleniyor…</p>
          ) : view === "stream" ? (
            visible.length === 0 ? (
              <p className="dbg-empty">
                {all.length === 0
                  ? "Henüz kayıt yok. Telegram botuna bir mesaj gönderin ya da panelden bir işlem yapın; kayıtlar burada görünecek."
                  : "Bu süzgeçlerle eşleşen kayıt yok. Süzgeçleri gevşetmeyi deneyin."}
              </p>
            ) : (
              visible.map((log) => {
                const open = expanded === log.id;
                return (
                  <div key={log.id} className={`dbg-row dbg-row-${log.level}`}>
                    <button
                      type="button"
                      className="dbg-row-main"
                      aria-expanded={open}
                      onClick={() => setExpanded(open ? null : log.id)}
                    >
                      <span className="dbg-time">{stamp(log.timestamp, now)}</span>
                      <span className="dbg-level-tag">{LEVEL_LABEL[log.level]}</span>
                      <span className="dbg-source">{SOURCE_LABEL[log.source]}</span>
                      <span className="dbg-message">{log.message}</span>
                      <span className="dbg-duration">{log.durationMs !== undefined ? `${log.durationMs} ms` : ""}</span>
                    </button>
                    {open && <EntryDetail log={log} />}
                  </div>
                );
              })
            )
          ) : groups.length === 0 ? (
            <p className="dbg-empty">Bu süzgeçlerle eşleşen hata yok.</p>
          ) : (
            groups.map((g) => {
              const open = expanded === g.signature;
              return (
                <div key={g.signature} className="dbg-row dbg-row-error">
                  <button
                    type="button"
                    className="dbg-row-main dbg-group-main"
                    aria-expanded={open}
                    onClick={() => setExpanded(open ? null : g.signature)}
                  >
                    <span className="dbg-count">{g.count}×</span>
                    <span className="dbg-message">{g.sample.message}</span>
                    <span className="dbg-source">{g.sources.map((s) => SOURCE_LABEL[s]).join(", ")}</span>
                    <span className="dbg-duration">son {formatAgo(g.lastSeen, now)}</span>
                  </button>
                  {open && (
                    <div className="dbg-group-detail">
                      <p className="dbg-detail-label">
                        İlk görülme {new Date(g.firstSeen).toLocaleString("tr-TR")} · son görülme{" "}
                        {new Date(g.lastSeen).toLocaleString("tr-TR")}
                      </p>
                      <EntryDetail log={g.sample} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
