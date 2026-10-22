import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAgo, formatClock } from "../lib/ui/time";

const NOW = Date.parse("2026-10-22T12:00:00.000Z");
const ago = (sec: number) => new Date(NOW - sec * 1000).toISOString();

test("10 saniyeden kısa süre 'az önce' olur", () => {
  assert.equal(formatAgo(ago(4), NOW), "az önce");
});

test("saniye, dakika, saat ve gün birimleri", () => {
  assert.equal(formatAgo(ago(42), NOW), "42 sn önce");
  assert.equal(formatAgo(ago(5 * 60), NOW), "5 dk önce");
  assert.equal(formatAgo(ago(3 * 3600), NOW), "3 sa önce");
  assert.equal(formatAgo(ago(2 * 86400), NOW), "2 gün önce");
});

test("gelecekteki zaman (saat farkı) negatif yazılmaz", () => {
  assert.equal(formatAgo(ago(-30), NOW), "az önce");
});

test("geçersiz tarih tire döner", () => {
  assert.equal(formatAgo("bozuk", NOW), "—");
  assert.equal(formatAgo(null, NOW), "—");
});

test("formatClock: SS:DD:ss biçiminde 24 saat", () => {
  assert.match(formatClock("2026-10-22T12:03:09.000Z", "UTC"), /^12:03:09$/);
});
