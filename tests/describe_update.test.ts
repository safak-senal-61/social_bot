import { test } from "node:test";
import assert from "node:assert/strict";
import { describeUpdate } from "../lib/telegram/describe_update";

test("metin mesajı: tür ve kısaltılmış metin", () => {
  const d = describeUpdate({ message: { text: "Kapadokya gün batımı", from: { id: 5 } } } as any);
  assert.equal(d.kind, "metin");
  assert.equal(d.preview, "Kapadokya gün batımı");
  assert.equal(d.userId, 5);
});

test("komut mesajı 'komut' olarak ayrılır", () => {
  const d = describeUpdate({ message: { text: "/ai deniz manzarası", from: { id: 5 } } } as any);
  assert.equal(d.kind, "komut");
});

test("uzun metin 120 karaktere kısaltılır", () => {
  const d = describeUpdate({ message: { text: "a".repeat(500), from: { id: 1 } } } as any);
  assert.ok(d.preview!.length <= 121);
});

test("fotoğraf ve video türleri tanınır", () => {
  assert.equal(describeUpdate({ message: { photo: [{}], from: { id: 1 } } } as any).kind, "fotoğraf");
  assert.equal(describeUpdate({ message: { video: {}, from: { id: 1 } } } as any).kind, "video");
});

test("buton tıklaması callback verisini taşır", () => {
  const d = describeUpdate({ callback_query: { data: "publish:abc", from: { id: 9 } } } as any);
  assert.equal(d.kind, "buton");
  assert.equal(d.preview, "publish:abc");
  assert.equal(d.userId, 9);
});

test("bilinmeyen güncelleme 'diğer' olur ve çökmez", () => {
  assert.equal(describeUpdate({} as any).kind, "diğer");
});
