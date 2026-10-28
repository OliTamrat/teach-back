import "server-only";

/**
 * SAM 3.1 through the Meta Model API's Responses endpoint: a short text concept ("medication label")
 * and an image in, boxes out. Its job here is narrow and visible: find the label in a phone photo
 * so the reviewer can pick the right one when there are several, and so the reader gets a crop
 * instead of a whole counter top. The response shape is parsed tolerantly, because the preview
 * API's schema is confirmed by the first live call, not by memory: any array of four numbers
 * under a box-like key counts, in pixels or normalised to the image.
 */
export type Box = { x: number; y: number; w: number; h: number; score?: number; label?: string };

const BASE = () => (process.env.META_MODEL_BASE_URL || "https://api.meta.ai/v1").replace(/\/$/, "");
const KEY = () => process.env.META_MODEL_API_KEY?.trim() || "";
export const samModel = () => process.env.META_SAM_MODEL || "sam-3.1";

export async function findLabels(image: Buffer, mime: string, concept = "medication label"): Promise<{ boxes: Box[]; raw: unknown; ms: number }> {
  if (!KEY()) throw new Error("meta_not_configured");
  const t0 = Date.now();
  const res = await fetch(`${BASE()}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: samModel(),
      input: [{ role: "user", content: [
        { type: "input_text", text: concept },
        { type: "input_image", image_url: `data:${mime};base64,${image.toString("base64")}` },
      ] }],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`sam_http_${res.status}: ${(await res.text()).slice(0, 200)}`);
  const raw = await res.json();
  return { boxes: extractBoxes(raw), raw, ms: Date.now() - t0 };
}

/** Pull boxes out of whatever shape came back. Exported for tests. */
export function extractBoxes(raw: unknown): Box[] {
  const out: Box[] = [];
  const seen = new Set<unknown>();
  const walk = (v: unknown, parentScore?: number, parentLabel?: string) => {
    if (!v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) { v.forEach(x => walk(x, parentScore, parentLabel)); return; }
    const o = v as Record<string, unknown>;
    const score = typeof o.score === "number" ? o.score : typeof o.confidence === "number" ? o.confidence : parentScore;
    const label = typeof o.label === "string" ? o.label : typeof o.concept === "string" ? o.concept : parentLabel;
    for (const k of ["box", "bbox", "box_2d", "boundingBox", "bounding_box", "xyxy", "xywh"]) {
      const b = o[k];
      if (Array.isArray(b) && b.length === 4 && b.every(n => typeof n === "number")) {
        const [a, c, d, e] = b as number[];
        // xywh keys are width/height; everything else is treated as x1,y1,x2,y2 (SAM's usual form).
        const box: Box = k === "xywh" ? { x: a, y: c, w: d, h: e } : { x: a, y: c, w: d - a, h: e - c };
        if (box.w > 0 && box.h > 0) out.push({ ...box, score, label });
      } else if (b && typeof b === "object" && !Array.isArray(b)) {
        const q = b as Record<string, number>;
        if ([q.x, q.y, q.w ?? q.width, q.h ?? q.height].every(n => typeof n === "number")) out.push({ x: q.x, y: q.y, w: q.w ?? q.width, h: q.h ?? q.height, score, label });
        else if ([q.x1 ?? q.xmin, q.y1 ?? q.ymin, q.x2 ?? q.xmax, q.y2 ?? q.ymax].every(n => typeof n === "number")) { const x1 = q.x1 ?? q.xmin, y1 = q.y1 ?? q.ymin; out.push({ x: x1, y: y1, w: (q.x2 ?? q.xmax) - x1, h: (q.y2 ?? q.ymax) - y1, score, label }); }
      }
    }
    for (const k of Object.keys(o)) if (!["box", "bbox", "box_2d", "boundingBox", "bounding_box", "xyxy", "xywh"].includes(k)) walk(o[k], score, label);
  };
  walk(raw);
  return out.sort((p, q) => (q.score ?? 0) - (p.score ?? 0));
}

/**
 * The keys a response arrived with and the type of each leaf, nested a few deep. Never a value.
 *
 * A tolerant parser that finds nothing cannot tell you whether the model returned boxes under a
 * key it does not know, or returned no boxes at all — and that is the difference between a bug and
 * an answer. This says which keys were there. It must not carry what was printed on somebody's
 * medication, so it reports types and never content.
 */
export function shapeOf(v: unknown, depth = 3): string {
  if (v === null) return "null";
  if (Array.isArray(v)) {
    if (depth <= 0) return "[...]";
    return v.length ? `[${shapeOf(v[0], depth - 1)}${v.length > 1 ? `, x${v.length}` : ""}]` : "[]";
  }
  if (typeof v === "object") {
    if (depth <= 0) return "{...}";
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).map(k => `${k}:${shapeOf(o[k], depth - 1)}`).join(",")}}`;
  }
  return typeof v;
}

