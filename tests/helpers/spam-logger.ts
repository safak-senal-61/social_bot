// Test yardımcısı: ayrı bir süreç olarak çalışıp logger'a art arda olay yazar.
// Kullanım: node --import tsx spam-logger.ts <etiket> <adet>
import { logEvent } from "../../lib/storage/logger";

const tag = process.argv[2] ?? "p";
const count = Number(process.argv[3] ?? 20);

for (let i = 0; i < count; i++) {
  logEvent("info", "api", `${tag}-${i}`);
}
