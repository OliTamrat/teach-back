/**
 * Browser-side fetch for the model-spending routes. Sends the access code this device was given,
 * if any, and turns a refusal into a plain message the screen can show.
 */
export const ACCESS_KEY = "teach-back-access";

export function getAccessCode(): string { try { return localStorage.getItem(ACCESS_KEY) || ""; } catch { return ""; } }
export function setAccessCode(code: string) { try { if (code) localStorage.setItem(ACCESS_KEY, code); else localStorage.removeItem(ACCESS_KEY); } catch { /* ignore */ } }

export async function apiPost(path: string, body: FormData): Promise<Response> {
  const code = getAccessCode();
  return fetch(path, { method: "POST", body, headers: code ? { "x-access": code } : undefined });
}

/** The user-facing reason a guarded route refused, or null when it did not. */
export function refusal(status: number, json: { error?: string; message?: string }): string | null {
  if (status === 401 && json.error === "access_required") return "access_required";
  if (status === 429) return json.message || "Too many requests. Wait a moment.";
  return null;
}
