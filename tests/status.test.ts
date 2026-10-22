import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStatus } from "../lib/ui/status";

test("✅ ile başlayan mesaj 'ok' tonudur ve işaret metinden çıkar", () => {
  assert.deepEqual(parseStatus("✅ Ayarlar kaydedildi"), { tone: "ok", text: "Ayarlar kaydedildi" });
});

test("❌ ile başlayan mesaj 'error' tonudur", () => {
  assert.deepEqual(parseStatus("❌ Hata: bağlantı yok"), { tone: "error", text: "Hata: bağlantı yok" });
});

test("⚠️ ile başlayan mesaj 'warn' tonudur", () => {
  assert.equal(parseStatus("⚠️ Dikkat").tone, "warn");
});

test("işaretsiz mesaj 'neutral' kalır ve metin değişmez", () => {
  assert.deepEqual(parseStatus("Kontrol ediliyor..."), { tone: "neutral", text: "Kontrol ediliyor..." });
});

test("başta boşluk olsa da işareti tanır", () => {
  assert.equal(parseStatus("  ✅ Tamam").tone, "ok");
});
