"use client";

import { parseStatus, type StatusTone } from "@/lib/ui/status";

export default function StatusNote({ text, tone }: { text: string; tone?: StatusTone }) {
  const parsed = parseStatus(text);
  const resolved = tone ?? parsed.tone;
  return (
    <p className={`status-note status-${resolved}`} role={resolved === "error" ? "alert" : "status"}>
      {parsed.text}
    </p>
  );
}
