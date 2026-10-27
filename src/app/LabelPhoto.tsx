"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The label check. A phone photo of the medication label goes to SAM 3.1, which finds the label(s)
 * in it; the reviewer picks the right one when there are several (or uses the whole photo when
 * SAM finds none); the crop goes to Muse Spark, which reports what is printed; and the result lands
 * in the label text field, where the deterministic comparison against what was spoken already
 * lives. Cropping happens here in the browser, so the server never needs an image library and the
 * reviewer sees exactly what the reader was shown.
 */
type Box = { x: number; y: number; w: number; h: number; score?: number; label?: string };
type Read = { legible: boolean; drug: string; strength: string; instructions: string; text: string };

export default function LabelPhoto({ onText }: { onText: (text: string, read: Read | null) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [img, setImg] = useState<{ w: number; h: number } | null>(null);
  const [boxes, setBoxes] = useState<Box[] | null>(null);
  const [pick, setPick] = useState<number | "whole">("whole");
  const [busy, setBusy] = useState<"" | "find" | "read">("");
  const [note, setNote] = useState("");
  const [read, setRead] = useState<Read | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => { if (!file) return; const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);

  function choose(f: File | null) { setFile(f); setImg(null); setBoxes(null); setPick("whole"); setRead(null); setNote(""); }

  async function find() {
    if (!file) return;
    setBusy("find"); setNote("");
    try {
      const form = new FormData(); form.append("photo", file, file.name || "label.jpg");
      const res = await fetch("/api/label/find", { method: "POST", body: form });
      const j = await res.json() as { boxes?: Box[]; error?: string; ms?: number };
      const found = normalise(j.boxes || []);
      setBoxes(found);
      if (!res.ok) setNote(j.error === "meta_not_configured" ? "SAM 3.1 needs the Meta Model API key. You can still read the whole photo." : `SAM 3.1 did not answer: ${j.error}. You can still read the whole photo.`);
      else if (found.length === 0) setNote("SAM 3.1 found no label in this photo. Read the whole photo, or retake it closer.");
      else { setPick(0); setNote(`SAM 3.1 found ${found.length} label${found.length === 1 ? "" : "s"} in ${((j.ms || 0) / 1000).toFixed(1)}s.${found.length > 1 ? " Tap the right one." : ""}`); }
    } catch (e) { setNote(`SAM 3.1 did not answer: ${e instanceof Error ? e.message : String(e)}`); setBoxes([]); }
    finally { setBusy(""); }
  }

  /** Crop the chosen box out of the full-resolution image in the browser; whole photo when none is chosen. */
  async function cropBlob(): Promise<Blob> {
    const el = imgRef.current;
    if (!el || !img || pick === "whole" || !boxes) return file!;
    const b = boxes[pick];
    const sx = b.x <= 1 && b.w <= 1 ? img.w : 1, sy = b.y <= 1 && b.h <= 1 ? img.h : 1; // normalised or pixel coordinates
    const pad = 0.04;
    const x = Math.max(0, (b.x - b.w * pad) * sx), y = Math.max(0, (b.y - b.h * pad) * sy);
    const w = Math.min(img.w - x, b.w * (1 + 2 * pad) * sx), h = Math.min(img.h - y, b.h * (1 + 2 * pad) * sy);
    const c = document.createElement("canvas"); c.width = Math.round(w); c.height = Math.round(h);
    c.getContext("2d")!.drawImage(el, x, y, w, h, 0, 0, c.width, c.height);
    return new Promise(res => c.toBlob(bl => res(bl || file!), "image/jpeg", 0.92));
  }

  async function readIt() {
    if (!file) return;
    setBusy("read"); setNote("");
    try {
      const blob = await cropBlob();
      const form = new FormData(); form.append("image", blob, "label.jpg");
      const res = await fetch("/api/label/read", { method: "POST", body: form });
      const j = await res.json() as { label?: Read; text?: string; error?: string; ms?: number };
      if (!res.ok || !j.label) { setNote(j.error === "meta_not_configured" ? "Reading a label needs the Meta Model API key. Type the label text instead." : `The reader did not answer: ${j.error}`); return; }
      setRead(j.label);
      if (!j.label.legible) { setNote("The reader could not make out the label. Retake the photo closer and in better light, or type the text."); return; }
      onText(j.text || "", j.label);
      setNote(`Read in ${((j.ms || 0) / 1000).toFixed(1)}s from ${pick === "whole" ? "the whole photo" : "the label SAM 3.1 found"}. Check it against the label with your own eyes.`);
    } catch (e) { setNote(`The reader did not answer: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(""); }
  }

  return (
    <div className="labelphoto">
      <div className="row">
        <label className="btn small" style={{ cursor: "pointer" }}>
          {file ? "Change photo" : "Photo of the label"}
          <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => choose(e.target.files?.[0] || null)} />
        </label>
        {file && <button className="btn small" onClick={find} disabled={busy !== ""}>{busy === "find" ? "Finding…" : "Find label (SAM 3.1)"}</button>}
        {file && <button className="btn small primary" onClick={readIt} disabled={busy !== ""}>{busy === "read" ? "Reading…" : pick === "whole" ? "Read whole photo" : "Read this label"}</button>}
        {file && <button className="btn small quiet" onClick={() => choose(null)}>Remove</button>}
      </div>
      {url && (
        <div className="photo" style={img ? { aspectRatio: `${img.w} / ${img.h}` } : undefined}>
          <img ref={imgRef} src={url} alt="Medication label photo" onLoad={e => setImg({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
          {img && boxes?.map((b, i) => {
            const n = b.x <= 1 && b.w <= 1; // normalised coordinates
            const l = n ? b.x * 100 : (b.x / img.w) * 100, t = n ? b.y * 100 : (b.y / img.h) * 100, w = n ? b.w * 100 : (b.w / img.w) * 100, h = n ? b.h * 100 : (b.h / img.h) * 100;
            return <button key={i} className="box" aria-pressed={pick === i} aria-label={`Label ${i + 1}${b.score ? `, confidence ${Math.round(b.score * 100)}%` : ""}`} style={{ left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%` }} onClick={() => setPick(pick === i ? "whole" : i)}><span>{i + 1}</span></button>;
          })}
        </div>
      )}
      {note && <p className="hint">{note}</p>}
      {read && read.legible && (
        <div className="facts">
          {read.drug && <span className="chip">drug <b>{read.drug}</b></span>}
          {read.strength && <span className="chip">strength <b>{read.strength}</b></span>}
          {read.instructions && <span className="chip">directions <b>{read.instructions}</b></span>}
        </div>
      )}
    </div>
  );
}

function normalise(boxes: Box[]): Box[] {
  return boxes.filter(b => Number.isFinite(b.x) && Number.isFinite(b.y) && b.w > 0 && b.h > 0).slice(0, 8);
}
