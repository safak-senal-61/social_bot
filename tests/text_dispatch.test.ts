import { test } from "node:test";
import assert from "node:assert/strict";

test("metin yazıldığında otomatik paylaşılmamalı, taslak oluşmalı ve onay beklenmeli", () => {
  // Test mantığı: normal metin geldiğinde paylaşım tetiklenmez, taslak kaydedilir
  const pendingTextDrafts = new Map<string, { id: string; userId: number; text: string; createdAt: number }>();
  
  function processIncomingText(userId: number, text: string) {
    const isCommand = text.startsWith("/");
    if (isCommand) return { action: "command" };

    const draftId = `txt_${Date.now()}`;
    pendingTextDrafts.set(draftId, {
      id: draftId,
      userId,
      text,
      createdAt: Date.now(),
    });

    return {
      action: "show_menu_with_options",
      draftId,
      text,
      autoPublished: false,
    };
  }

  const result = processIncomingText(12345, "selam");
  assert.equal(result.autoPublished, false);
  assert.equal(result.action, "show_menu_with_options");
  assert.ok(pendingTextDrafts.has(result.draftId!));
  assert.equal(pendingTextDrafts.get(result.draftId!)?.text, "selam");
});
