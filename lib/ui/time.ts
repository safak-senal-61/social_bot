// lib/ui/time.ts
// Debug sayfası ve menü için küçük zaman biçimlendiricileri.

export function formatAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 10) return "az önce";
  if (sec < 60) return `${sec} sn önce`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} sa önce`;
  return `${Math.floor(hour / 24)} gün önce`;
}

/** 24 saatlik SS:DD:ss. timeZone verilmezse tarayıcının/sunucunun yerel saati kullanılır. */
export function formatClock(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
  });
}
