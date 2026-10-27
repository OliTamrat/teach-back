import { NextResponse } from "next/server";
import { guardRequest, logCall } from "@/server/guard";
import { findLabels } from "@/server/sam";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** multipart: photo (image file). SAM 3.1 finds the medication label(s); the reviewer picks one on screen. */
export async function POST(req: Request) {
  const refused = guardRequest(req);
  if (refused) return refused;
  const form = await req.formData();
  const photo = form.get("photo");
  if (!(photo instanceof Blob) || photo.size === 0) return NextResponse.json({ error: "no_photo" }, { status: 400 });
  if (photo.size > 10 * 1024 * 1024) return NextResponse.json({ error: "photo_too_large" }, { status: 413 });
  if (!process.env.META_MODEL_API_KEY?.trim()) return NextResponse.json({ error: "meta_not_configured", boxes: [] }, { status: 503 });
  try {
    const { boxes, ms } = await findLabels(Buffer.from(await photo.arrayBuffer()), photo.type || "image/jpeg");
    logCall("label/find", { boxes: boxes.length, ms, bytes: photo.size });
    return NextResponse.json({ boxes, ms });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e), boxes: [] }, { status: 502 });
  }
}
