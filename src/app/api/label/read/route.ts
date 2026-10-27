import { NextResponse } from "next/server";
import { labelAsText } from "@/core/prompts";
import { readLabel } from "@/server/meta";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/** multipart: image (the crop the reviewer chose, or the whole photo). Spark reads what is printed. */
export async function POST(req: Request) {
  const form = await req.formData();
  const image = form.get("image");
  if (!(image instanceof Blob) || image.size === 0) return NextResponse.json({ error: "no_image" }, { status: 400 });
  if (image.size > 10 * 1024 * 1024) return NextResponse.json({ error: "image_too_large" }, { status: 413 });
  if (!process.env.META_MODEL_API_KEY?.trim()) return NextResponse.json({ error: "meta_not_configured" }, { status: 503 });
  try {
    const { reply, raw, ms } = await readLabel(Buffer.from(await image.arrayBuffer()), image.type || "image/jpeg");
    if (!reply) return NextResponse.json({ error: "unreadable_reply", raw: raw.slice(0, 300) }, { status: 502 });
    return NextResponse.json({ label: reply, text: labelAsText(reply), ms });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
