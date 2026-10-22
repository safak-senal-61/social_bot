// lib/telegram/describe_update.ts
// Telegram güncellemesini debug günlüğü için okunabilir ve kısa bir özete çevirir.
import type { Update } from "telegraf/types";

export interface UpdateSummary {
  kind: "komut" | "metin" | "fotoğraf" | "video" | "buton" | "diğer";
  preview?: string;
  userId?: number;
}

const PREVIEW_MAX = 120;

function clip(text: string): string {
  return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX)}…` : text;
}

export function describeUpdate(update: Update): UpdateSummary {
  const u = update as any;

  if (u.callback_query) {
    return { kind: "buton", preview: clip(String(u.callback_query.data ?? "")), userId: u.callback_query.from?.id };
  }

  const msg = u.message;
  if (!msg) return { kind: "diğer" };

  const userId: number | undefined = msg.from?.id;
  if (typeof msg.text === "string") {
    return { kind: msg.text.startsWith("/") ? "komut" : "metin", preview: clip(msg.text), userId };
  }
  if (msg.photo) return { kind: "fotoğraf", preview: msg.caption ? clip(msg.caption) : undefined, userId };
  if (msg.video) return { kind: "video", preview: msg.caption ? clip(msg.caption) : undefined, userId };
  return { kind: "diğer", userId };
}
