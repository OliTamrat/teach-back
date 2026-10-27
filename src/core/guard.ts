/**
 * Who may spend the model budget. Pure: the server passes in the clock and the configured code,
 * so every rule is testable. Three layers, each independent:
 *  - an optional access code (TEACH_BACK_ACCESS_CODE); unset means open, which health reports;
 *  - a per-caller limit, so one browser cannot loop on the record button;
 *  - a daily cap on model-spending calls, so a public URL cannot drain the $150 credit overnight.
 * The counters live in memory, so on serverless hosting they are per instance: a floor, not a
 * guarantee. The access code is the guarantee; the caps are what stop an accident.
 */
export type GuardConfig = { accessCode?: string; perMinute?: number; perDay?: number };
export type GuardVerdict = { ok: true } | { ok: false; status: 401 | 429; error: string; message: string };

export function createGuard(cfg: GuardConfig, now: () => number = Date.now) {
  const perMinute = cfg.perMinute ?? 12;
  const perDay = cfg.perDay ?? 400;
  const minute = new Map<string, number[]>();
  let dayStart = startOfDay(now());
  let dayCount = 0;

  function check(caller: string, presented: string | null): GuardVerdict {
    const code = cfg.accessCode?.trim();
    if (code && !timingSafeEqual(code, (presented || "").trim())) {
      return { ok: false, status: 401, error: "access_required", message: "This deployment asks for an access code before it spends model calls." };
    }
    const t = now();
    if (startOfDay(t) !== dayStart) { dayStart = startOfDay(t); dayCount = 0; }
    if (dayCount >= perDay) return { ok: false, status: 429, error: "daily_cap", message: "This deployment has reached its daily limit of model calls. Paste text still works." };
    const hits = (minute.get(caller) || []).filter(x => t - x < 60_000);
    if (hits.length >= perMinute) { minute.set(caller, hits); return { ok: false, status: 429, error: "too_many", message: "Too many turns in a minute from this device. Wait a moment." }; }
    hits.push(t); minute.set(caller, hits);
    dayCount++;
    if (minute.size > 5000) for (const [k, v] of minute) if (!v.some(x => t - x < 60_000)) minute.delete(k);
    return { ok: true };
  }
  function stats() { return { dayCount, perDay, perMinute, callers: minute.size }; }
  return { check, stats };
}

function startOfDay(t: number) { return Math.floor(t / 86_400_000); }

/** Constant-time compare, so the code cannot be guessed a character at a time from response timing. */
export function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
