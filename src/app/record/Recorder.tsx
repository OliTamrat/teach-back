"use client";

import { useEffect, useRef, useState } from "react";
import { toWav } from "../audio";

type Item = { id: string; language: "am" | "om"; spoken: "am" | "om" | "en"; factType: string; english: string; text: string; reviewed: boolean; visit?: string; speaker?: string; planted?: boolean; answerKey?: string };
const LANG: Record<"am" | "om" | "en", string> = { am: "Amharic", om: "Afaan Oromo", en: "English" };

export default function Recorder({ items }: { items: Item[] }) {
  const [filter, setFilter] = useState<"am" | "om" | "en" | "visits" | "all">("all");
  const [i, setI] = useState(0);
  const [state, setState] = useState<"idle" | "recording">("idle");
  const [done, setDone] = useState<Record<string, number>>({});
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsed = useRef(0);
  const list = items.filter(it => filter === "all" ? true : filter === "visits" ? Boolean(it.visit) : it.spoken === filter);
  const item = list[Math.min(i, list.length - 1)];

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); rec.current?.stream.getTracks().forEach(t => t.stop()); }, []);

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(m => MediaRecorder.isTypeSupported(m)) || "";
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const recorded = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
        // Saved as 16 kHz mono WAV, the one container every listener accepts, so the clips feed the harness as they are.
        void toWav(recorded).then(({ blob, converted }) => {
          const ext = converted ? "wav" : (recorded.type.split("/")[1] || "webm").split(";")[0] === "mp4" ? "m4a" : "webm";
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url; a.download = `${item.id}.${ext}`; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          if (!converted) setError("This browser could not convert the clip to WAV; it was saved as recorded and will not reach Voice Transcribe.");
          setDone(d => ({ ...d, [item.id]: elapsed.current }));
        });
      };
      r.start(); rec.current = r; setSeconds(0); elapsed.current = 0;
      timer.current = setInterval(() => { elapsed.current += 1; setSeconds(elapsed.current); }, 1000);
      setState("recording");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  function stop() {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    rec.current?.stop(); setState("idle");
  }

  if (!item) return <main className="wrap"><p className="hint">No sentences.</p></main>;
  const n = list.indexOf(item);
  return (
    <>
      <header className="wrap top">
        <div className="brand"><h1>Teach-Back</h1><span>recording session</span></div>
        <div className="session">
          <label>Read in
            <select value={filter} onChange={e => { setFilter(e.target.value as "am" | "om" | "en" | "visits" | "all"); setI(0); }} aria-label="Language to record">
              <option value="all">everything, in script order</option><option value="am">Amharic lines</option><option value="om">Afaan Oromo lines</option><option value="en">English lines (provider, interpreter)</option><option value="visits">Visits only (two-way)</option>
            </select>
          </label>
          <span className="hint">{Object.keys(done).length} of {items.length} recorded</span>
        </div>
      </header>
      <main className="wrap">
        <div className="notice">
          Scripted sentences only. No real patient information. Each clip is saved to this device as the sentence's id and nothing is uploaded from this page. Read the sentence once, naturally, then press Stop.
        </div>
        <section className="panel script">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="eyebrow">{item.id} · {n + 1} of {list.length} · {LANG[item.spoken]} · {item.visit ? `visit ${item.visit}, you are the ${item.speaker}${item.planted ? ", reading it deliberately wrong" : ""}` : item.factType.replace("_", " ")}{!item.visit && item.spoken !== item.language ? ` · wrong-language item (session will expect ${LANG[item.language]})` : ""}</span>
            {done[item.id] !== undefined && <span className="eyebrow" style={{ color: "var(--good)" }}>recorded, {done[item.id]}s</span>}
          </div>
          <p className="read" lang={item.spoken}>{item.text}</p>
          <p className="hint">{item.spoken === "en" ? (item.answerKey || "") : `English source: ${item.english}`}{item.planted ? " This take is the interpreter getting it wrong on purpose: read exactly what is written." : item.reviewed ? "" : " Draft translation: if the wording is not what you would say, say it your way and tell us."}</p>
          <div className="row">
            <button className="btn quiet" onClick={() => setI(Math.max(0, n - 1))} disabled={n === 0 || state === "recording"}>Previous</button>
            {state === "idle" && <button className="btn primary" onClick={start}>{done[item.id] !== undefined ? "Record again" : "Record"}</button>}
            {state === "recording" && <button className="btn rec" onClick={stop}><span className="dot" aria-hidden="true" />Stop <span className="mono">{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span></button>}
            <button className="btn" onClick={() => setI(Math.min(list.length - 1, n + 1))} disabled={n === list.length - 1 || state === "recording"}>Next</button>
          </div>
          {error && <div className="flag" data-sev="crit"><div className="msg">{error}</div></div>}
        </section>
        <section className="panel">
          <h2>Progress</h2>
          <div className="facts">
            {list.map((it, k) => <button key={it.id} className="chip" data-done={done[it.id] !== undefined || undefined} onClick={() => setI(k)} disabled={state === "recording"} aria-current={k === n || undefined}>{it.id}</button>)}
          </div>
          <p className="hint">Move the downloaded files into <span className="mono">eval/audio/</span> and run <span className="mono">npm run eval</span> with the server up. Files from a volunteer who did not consent to release stay out of the repository.</p>
        </section>
      </main>
      <footer className="wrap">Teach-Back is a hackathon prototype. Recordings are of scripted sentences read by consenting volunteers, never real patients.</footer>
    </>
  );
}
