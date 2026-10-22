"use client";

import { useEffect } from "react";

function report(payload: { level?: "error" | "warn"; message: string; details?: string; stack?: string }) {
  try {
    // keepalive: sayfa kapanırken bile istek gönderilebilsin
    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "client", ...payload }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // raporlama hiçbir zaman uygulamayı bozmamalı
  }
}

/**
 * Tarayıcıda oluşan yakalanmamış hataları ve başarısız API çağrılarını debug günlüğüne iletir.
 * Ekranda hiçbir şey göstermez.
 */
export default function ClientErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      report({
        message: e.message || "Bilinmeyen tarayıcı hatası",
        details: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined,
        stack: e.error?.stack,
      });
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      report({
        message: `Yakalanmamış Promise hatası: ${reason?.message ?? String(reason)}`,
        stack: reason?.stack,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    // Başarısız /api çağrılarını yakala (log uç noktasının kendisi hariç; sonsuz döngüyü önler)
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const isApi = url.includes("/api/") && !url.includes("/api/logs");
      try {
        const res = await originalFetch(input, init);
        if (isApi && !res.ok && res.status >= 500) {
          report({ level: "error", message: `Panel isteği başarısız: ${init?.method ?? "GET"} ${new URL(url, location.href).pathname} → ${res.status}` });
        }
        return res;
      } catch (err) {
        if (isApi) {
          report({
            level: "error",
            message: `Panel isteği sunucuya ulaşamadı: ${init?.method ?? "GET"} ${new URL(url, location.href).pathname}`,
            details: err instanceof Error ? err.message : String(err),
          });
        }
        throw err;
      }
    };

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
