// lib/api/with_log.ts
// API rotalarını sarar: istek sonucunu (yöntem, yol, durum kodu, süre) ve fırlatılan hataları
// debug günlüğüne yazar. İstek gövdesi ve sorgu parametreleri token/parola içerebileceği için
// kasıtlı olarak kaydedilmez.
import { logEvent, captureError } from "../storage/logger";

type Handler<R extends Request, A extends unknown[]> = (req: R, ...rest: A) => Promise<Response> | Response;

export function withApiLog<R extends Request, A extends unknown[]>(
  name: string,
  handler: Handler<R, A>
): (req: R, ...rest: A) => Promise<Response> {
  return async (req: R, ...rest: A) => {
    const startedAt = Date.now();
    const method = req.method;
    const { pathname } = new URL(req.url);
    const label = `${method} ${pathname}`;

    try {
      const res = await handler(req, ...rest);
      const durationMs = Date.now() - startedAt;
      const message = `${label} → ${res.status}`;

      if (res.status >= 500) {
        logEvent("error", "api", message, { route: name }, { durationMs });
      } else if (res.status >= 400) {
        logEvent("warn", "api", message, { route: name }, { durationMs });
      } else if (method !== "GET") {
        // Başarılı GET'ler (liste/yenileme çağrıları) günlüğü doldurmasın diye atlanır
        logEvent("info", "api", message, { route: name }, { durationMs });
      }
      return res;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      captureError("api", `${label} → 500 (işlenemeyen hata)`, err, { route: name });
      return Response.json({ success: false, error: reason }, { status: 500 });
    }
  };
}
