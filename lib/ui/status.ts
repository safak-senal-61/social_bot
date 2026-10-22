// lib/ui/status.ts
// Eski durum mesajları "✅ ..." / "❌ ..." önekiyle üretiliyor. Önek ekranda gösterilmez;
// yalnızca mesajın tonunu (renk ve vurgu) belirlemek için okunur.
export type StatusTone = "ok" | "error" | "warn" | "neutral";

export function parseStatus(raw: string): { tone: StatusTone; text: string } {
  const trimmed = raw.trim();
  const markers: Array<[string, StatusTone]> = [
    ["✅", "ok"],
    ["❌", "error"],
    ["⚠", "warn"],
  ];
  for (const [marker, tone] of markers) {
    if (trimmed.startsWith(marker)) {
      return { tone, text: trimmed.slice(marker.length).replace(/^\uFE0F?\s*/, "") };
    }
  }
  return { tone: "neutral", text: trimmed };
}
