"use client";

import { useEffect, useState } from "react";

type Health = {
  ready: boolean;
  metaModelApi: { key: string; sparkModel: string; sparkAudioModel: string; samModel: string; voiceModel: string };
  asr: { service: string; token: string; probe?: { reachable: boolean; ready: boolean; model?: string; detail?: string } };
  guard: { accessCode: string; voiceFallback: string; dayCount: number; perDay: number; perMinute: number };
};

export default function Status() {
  const [h, setH] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try { const r = await fetch("/api/health?probe=asr", { cache: "no-store" }); setH(await r.json()); setAt(new Date().toLocaleTimeString()); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  useEffect(() => { void Promise.resolve().then(load); const t = setInterval(() => void load(), 60_000); return () => clearInterval(t); }, []);

  const space = !h ? null : h.asr.service !== "set" ? { state: "crit", text: "Not configured. ASR_SERVICE_URL is missing; the Voice Transcribe fallback carries the first listener, and its Amharic is poor." }
    : !h.asr.probe?.reachable ? { state: "crit", text: `The Space did not answer: ${h.asr.probe?.detail ?? "unreachable"}.` }
    : h.asr.probe.ready ? { state: "good", text: `Awake and loaded (${h.asr.probe.model ?? "model"}). Omnilingual ASR is the first listener.` }
    : { state: "warn", text: `Reachable but still loading the model. A cold start takes 15 to 25 minutes; this page checks every minute. ${h.asr.probe.detail ?? ""}` };
  const meta = !h ? null : h.metaModelApi.key === "set" ? { state: "good", text: `Key set. Second listener ${h.metaModelApi.sparkAudioModel}, renderer and label reader on Spark, labels found by ${h.metaModelApi.samModel}.` } : { state: "crit", text: "META_MODEL_API_KEY is missing. No second listener, no rendering, no label reading." };
  const guard = !h ? null : { state: h.guard.accessCode === "set" ? "good" : "warn", text: `${h.guard.accessCode === "set" ? "Access code set." : "No access code: the model routes are open to anyone with the link."} ${h.guard.dayCount} of ${h.guard.perDay} model calls used today on this instance; ${h.guard.perMinute} per caller per minute.` };

  const Row = ({ label, s }: { label: string; s: { state: string; text: string } | null }) => (
    <div className="flag" data-sev={s?.state === "crit" ? "crit" : s?.state === "warn" ? "warn" : undefined} data-state={s?.state === "good" ? "confirmed" : undefined}>
      <div className="head"><span className="kind">{label}</span><span className="eyebrow">{s ? (s.state === "good" ? "ready" : s.state === "warn" ? "wait" : "fix this") : "checking"}</span></div>
      <div className="msg">{s?.text ?? "…"}</div>
    </div>
  );

  return (
    <>
      <header className="wrap top">
        <div className="brand"><h1>Teach-Back</h1><span>status</span><a className="btn small quiet" href="/">Back to the screen</a></div>
        <span className="hint">{at ? `checked ${at}` : ""}</span>
      </header>
      <main className="wrap">
        <div className="notice">Before a session or a demo: all three rows green. The Space sleeps when idle and takes 15 to 25 minutes to wake; opening this page wakes it. Nothing here prints a secret.</div>
        <section className="panel">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>{h ? (h.ready && space?.state === "good" ? "Ready" : "Not ready yet") : "Checking"}</h2>
            <button className="btn small" onClick={() => void load()} disabled={busy}>{busy ? "Checking…" : "Check again now"}</button>
          </div>
          {error && <div className="flag" data-sev="crit"><div className="msg">Could not reach the server: {error}</div></div>}
          <div className="flags">
            <Row label="Omnilingual ASR Space (first listener)" s={space} />
            <Row label="Meta Model API (second listener, rendering, labels)" s={meta} />
            <Row label="Guard on model spending" s={guard} />
          </div>
          <p className="hint">If the Space row stays on wait for more than 25 minutes, open the Space on Hugging Face and check its logs. If the Meta row is red, the variable is missing on this deployment; set it and redeploy.</p>
        </section>
      </main>
      <footer className="wrap">Teach-Back is a hackathon prototype. It is not a medical device, does not give medical advice, and does not replace a qualified interpreter.</footer>
    </>
  );
}
