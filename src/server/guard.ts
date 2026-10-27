import "server-only";
import { NextResponse } from "next/server";
import { createGuard } from "@/core/guard";

/** One guard per server instance, configured from the environment. */
const guard = createGuard({
  accessCode: process.env.TEACH_BACK_ACCESS_CODE,
  perMinute: num(process.env.TEACH_BACK_PER_MINUTE, 12),
  perDay: num(process.env.TEACH_BACK_PER_DAY, 400),
});
function num(v: string | undefined, d: number) { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; }

export function accessCodeConfigured(): boolean { return Boolean(process.env.TEACH_BACK_ACCESS_CODE?.trim()); }
export function guardStats() { return guard.stats(); }

/** Returns a response to send instead of doing the work, or null to proceed. */
export function guardRequest(req: Request): NextResponse | null {
  const caller = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  const v = guard.check(caller, req.headers.get("x-access"));
  if (v.ok) return null;
  return NextResponse.json({ error: v.error, message: v.message }, { status: v.status });
}

/** One line per model-spending call, with timings and counts and never the content. */
export function logCall(route: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ at: new Date().toISOString(), route, ...fields }));
}
