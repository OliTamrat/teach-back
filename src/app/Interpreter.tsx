"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { extractFacts } from "@/core/facts";
import { analyzeTurn, compareListeners, compareWithLabel, compareWithSource, languageMismatch } from "@/core/compare";
import { SETTINGS, teachBackQuestion, type Setting } from "@/core/question";
import { localizedQuestion } from "@/core/question-i18n";
import LabelPhoto from "./LabelPhoto";
import Listen from "./Listen";
import { apiPost, getAccessCode, refusal, setAccessCode } from "./api-client";
import { toWav } from "./audio";
import { allDecided, finalSummary, makeTurn, sessionNotes, type Decision, type TurnRecord } from "@/core/session";
import type { Fact, Flag, Language, Role, SpeechLanguage } from "@/core/types";

/**
 * The interpreter's screen. One patient turn at a time: the English rendering with every
 * critical fact marked, the flags a human must confirm, and the teach-back question to ask.
 *
 * Two ways in. Record: the browser records one patient turn and POSTs it to /api/turn, where
 * Omnilingual ASR is the first listener and Muse Spark the second; the server returns both
 * renderings and the same core marks them up here. Paste: both renderings are typed in, which is
 * how the screen is demonstrated without keys and how a reviewer re-checks a saved turn.
 */

const SAMPLE_A = "I have a sharp pain in my lower right back for three weeks. I am not allergic to penicillin. It started on Tikimt 3. I take lisinopril for my blood pressure.";
const SAMPLE_B = "I have pain in my lower left back for three weeks. I am allergic to penicillin. It started on Tikimt 13. I take lisinopril for my blood pressure.";
const SAMPLE_PROVIDER = "Take one tablet of 500 milligrams amoxicillin three times a day for ten days. Do not take it with milk. Come back on Hidar 5 if the fever does not go down.";
const SAMPLE_INTERPRETED = "Take one tablet of 50 milligrams amoxicillin three times a day for ten days. Take it with milk. Come back on Hidar 5 if the fever does not go down.";
const SAMPLE_LABEL = "";
const TOUR_KEY = "teach-back-toured";

/**
 * The guided first visit: a judge on a laptop in a quiet room, no microphone, under a minute to the
 * dropped "not". Each step loads a real failure pattern into Paste text and checks it; the screen
 * does the rest exactly as it would for a recorded turn.
 */
type TourStep = { title: string; body: string; role?: Role; a?: string; b?: string; provider?: string; label?: string; language?: Language; action?: "record" };
const TOUR: TourStep[] = [
  { title: "The patient says what is wrong", body: "A first visit starts with the patient, in their own language: where it hurts, since when, what they take, what they are allergic to. Two Meta models heard this Amharic turn independently and code compared every fact. The second listener dropped the \"not\" before \"allergic\" and moved the pain to the other side. Red is what a person must settle before it is written down.", role: "patient", a: SAMPLE_A, b: SAMPLE_B, language: "am" },
  { title: "A person decides every flag", body: "Nothing is final until the interpreter confirms or corrects each red line with the patient. Try it: press Confirmed with patient on one flag, or Correct it and type what the patient actually said. The line turns green only when none are open." },
  { title: "The provider answers, and the interpreter is checked the other way", body: "Now the provider speaks English: a dose, a frequency, a prohibition, a follow-up date. The interpreter renders it into Amharic for the patient. Teach-Back hears the interpreter's Amharic through the same two listeners, brings it back to English, and compares it with what the provider said. Here the interpreter said 50 instead of 500 and dropped \"do not\". Those two lines decide whether the patient goes home safe.", role: "provider", provider: SAMPLE_PROVIDER, a: SAMPLE_INTERPRETED, language: "am" },
  { title: "The bottle from the bag", body: "Elders bring their medicines to show. A phone photo goes to SAM 3.1, which finds the label; Spark reads what is printed; code compares it with what the patient said they take. Here the label is typed in so you can see the comparison without a camera.", role: "patient", a: "I take two tablets of metformin twice a day for my sugar.", b: "I take two tablets of metformin twice a day for my sugar.", label: "Metformin 500 mg. Take one tablet twice a day with food.", language: "am" },
  { title: "Now with a microphone, and no buttons", body: "Press Start listening once. Everyone just talks. The audio is cut into turns at pauses and each is checked while the next is spoken; every change of language is the interpreter, so patient, interpreter and provider are all checked without anyone touching the phone. The interpreter keeps interpreting; the red lines arrive a few seconds behind. Teach-Back never advises anyone and never speaks to a patient.", action: "record" },
];
const LANG_NAME: Record<SpeechLanguage, string> = { am: "Amharic", om: "Afaan Oromo", en: "English" };
const SESSION_KEY = "teach-back-session";
const TYPE_NAME: Record<Fact["type"], string> = { dose: "dose", frequency: "frequency", drug: "drug", negation: "negation", body_part: "body part", date: "date", duration: "duration", number: "number", symptom: "symptom" };

type Mode = "listen" | "record" | "paste";
type Health = { ready: boolean; metaModelApi: { key: string }; asr: { service: string } };
type TurnResponse = {
  firstListener: string | null; transcript: string; secondTranscript: string; notes: string[];
  detected: { language: SpeechLanguage | null; confidence: number; by: string };
  timings: { asrMs: number | null; listenMs: number | null };
  primary: { english: string }; secondary: { english: string } | null;
};
type AudioMeta = Omit<TurnResponse, "primary" | "secondary">;

export default function Interpreter() {
  const [language, setLanguage] = useState<Language>("am");
  const [role, setRole] = useState<Role>("patient");
  const [provider, setProvider] = useState(SAMPLE_PROVIDER);
  /** The provider's recorded turn, waiting for the interpreter's rendering to be recorded. */
  const [providerTurn, setProviderTurn] = useState<{ english: string; transcript: string; firstListener: string | null } | null>(null);
  const [setting, setSetting] = useState<Setting>("clinic");
  const [spokenLanguage, setSpokenLanguage] = useState<Language | "">("");
  const [reference, setReference] = useState(() => new Date().toISOString().slice(0, 10));
  const [a, setA] = useState(SAMPLE_A);
  const [b, setB] = useState(SAMPLE_B);
  const [label, setLabel] = useState(SAMPLE_LABEL);
  const [checked, setChecked] = useState<{ role: Role; provider: string; a: string; b: string; label: string; language: Language; spoken: Language | ""; reference: string; setting: Setting } | null>(null);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [mode, setMode] = useState<Mode>("listen");
  const [health, setHealth] = useState<Health | null>(null);
  const [audio, setAudio] = useState<AudioMeta | null>(null);
  const [turns, setTurns] = useState<TurnRecord[]>([]);
  const [copied, setCopied] = useState<"summary" | "notes" | null>(null);
  const [needAccess, setNeedAccess] = useState(false);
  const [tour, setTour] = useState<number | null>(null);
  const flagsHeading = useRef<HTMLHeadingElement | null>(null);

  // First visit: open the walkthrough, once per device.
  useEffect(() => {
    void Promise.resolve().then(() => {
      try { if (!localStorage.getItem(TOUR_KEY) && !new URLSearchParams(location.search).has("notour")) startTour(0); } catch { /* ignore */ }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function startTour(step: number) {
    const st = TOUR[step]; if (!st) return;
    setTour(step);
    if (st.action === "record") { setMode("listen"); setChecked(null); setDecisions({}); return; }
    if (st.a !== undefined) {
      setMode("paste");
      if (st.language) setLanguage(st.language);
      const r: Role = st.role ?? "patient";
      setRole(r); if (st.provider) setProvider(st.provider);
      setA(st.a); setB(st.b ?? ""); setLabel(st.label ?? ""); setSpokenLanguage("");
      setChecked({ role: r, provider: st.provider ?? provider, a: st.a, b: st.b ?? "", label: st.label ?? "", language: st.language ?? language, spoken: "", reference, setting });
      setDecisions({});
    }
  }
  function endTour() { setTour(null); try { localStorage.setItem(TOUR_KEY, "1"); } catch { /* ignore */ } }

  // The session log lives on this device only; it is the interpreter's own notes, never sent anywhere.
  useEffect(() => {
    void Promise.resolve().then(() => {
      try { const raw = localStorage.getItem(SESSION_KEY); if (raw) setTurns(JSON.parse(raw) as TurnRecord[]); } catch { /* storage unavailable: the log is per page load */ }
    });
  }, []);
  function saveTurns(next: TurnRecord[]) {
    setTurns(next);
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    void fetch("/api/health", { signal: ctrl.signal }).then(r => r.json()).then((h: Health) => setHealth(h)).catch(() => setHealth({ ready: false, metaModelApi: { key: "missing" }, asr: { service: "missing" } }));
    return () => ctrl.abort();
  }, []);

  const analysis = useMemo(() => {
    if (!checked) return null;
    const [y, m, d] = checked.reference.split("-").map(Number);
    const opts = { reference: { year: y, month: m, day: d }, language: checked.language };
    const order = SETTINGS[checked.setting].order;
    if (checked.role === "provider") {
      // What the provider said is the source; the interpreter's rendering, heard back through the
      // listeners, is checked against it. The listeners' own disagreement about the rendering is kept
      // too, without pointing into the provider's text.
      const source = { name: "Provider", english: checked.provider, facts: extractFacts(checked.provider, { ...opts, language: "am" as const }) };
      const rendered = { name: "Interpreter, heard back", english: checked.a, facts: extractFacts(checked.a, opts) };
      const second = checked.b.trim() ? { name: "Listener B", english: checked.b, facts: extractFacts(checked.b, opts) } : undefined;
      const listenerFlags = compareListeners(rendered, second).map(f => ({ ...f, factIndex: undefined }));
      const flags = [...compareWithSource(source.facts, rendered.facts), ...listenerFlags].sort((x, y) => (x.severity === y.severity ? 0 : x.severity === "crit" ? -1 : 1));
      return { primary: source, secondary: undefined, rendered, flags, question: teachBackQuestion(source.facts, order) };
    }
    const primary = { name: "Listener A", english: checked.a, facts: extractFacts(checked.a, opts) };
    const secondary = checked.b.trim() ? { name: "Listener B", english: checked.b, facts: extractFacts(checked.b, opts) } : undefined;
    const extra: Flag[] = [];
    const mismatch = languageMismatch(checked.language, checked.spoken || null);
    if (mismatch) extra.push(mismatch);
    if (checked.label.trim()) extra.push(...compareWithLabel(primary.facts, extractFacts(checked.label, opts)));
    const turn = analyzeTurn(primary, secondary, extra);
    return { ...turn, rendered: undefined as { name: string; english: string; facts: Fact[] } | undefined, question: teachBackQuestion(primary.facts, order) };
  }, [checked]);

  const open = analysis ? analysis.flags.filter((_, i) => (decisions[i]?.state ?? "open") === "open").length : 0;
  const crit = analysis ? analysis.flags.filter(f => f.severity === "crit").length : 0;
  const isFinal = Boolean(analysis) && allDecided(analysis!.flags, decisions);
  const summary = analysis && isFinal ? finalSummary(analysis.primary.english, analysis.primary.facts, analysis.flags, decisions) : "";

  function addToSession() {
    if (!analysis || !checked || !isFinal) return;
    const rec = makeTurn({
      language: checked.language, reference: checked.reference, transcript: audio?.transcript || undefined, role: checked.role,
      english: analysis.primary.english, facts: analysis.primary.facts, flags: analysis.flags,
      decisions: analysis.flags.map((_, i) => decisions[i] ?? { state: "confirmed" as const }),
    });
    saveTurns([...turns, rec]);
    nextTurn();
  }
  function nextTurn() { setChecked(null); setDecisions({}); setAudio(null); setProviderTurn(null); if (mode === "paste") { setA(""); setB(""); setLabel(""); if (role === "provider") setProvider(""); } }
  async function copy(text: string, what: "summary" | "notes") {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(null), 1500); } catch { /* clipboard blocked: the text is on screen */ }
  }
  function downloadSession() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), turns }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a"); el.href = url; el.download = `teach-back-session-${new Date().toISOString().slice(0, 10)}.json`; el.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function check(next?: Partial<{ a: string; b: string; spoken: Language | ""; provider: string; role: Role }>) {
    setChecked({ role: next?.role ?? role, provider: next?.provider ?? provider, a: next?.a ?? a, b: next?.b ?? b, label, language, spoken: next?.spoken ?? spokenLanguage, reference, setting });
    setDecisions({});
    // Move keyboard and screen-reader focus to the result, which is where the work now is.
    setTimeout(() => flagsHeading.current?.focus(), 50);
  }
  function onTurn(t: TurnResponse) {
    const bText = t.secondary?.english ?? "";
    const spoken = t.detected.language && t.detected.language !== "en" && t.detected.confidence >= 0.6 ? t.detected.language : "";
    setA(t.primary.english); setB(bText); setSpokenLanguage(spoken);
    setAudio({ firstListener: t.firstListener, transcript: t.transcript, secondTranscript: t.secondTranscript, notes: t.notes, detected: t.detected, timings: t.timings });
    if (role === "provider" && providerTurn) check({ role: "provider", provider: providerTurn.english, a: t.primary.english, b: bText, spoken });
    else check({ role: "patient", a: t.primary.english, b: bText, spoken });
  }
  /** Step one of a provider turn: the provider's English is kept as the source until the interpreter has been recorded. */
  function onProviderTurn(t: TurnResponse) {
    setProviderTurn({ english: t.primary.english, transcript: t.transcript, firstListener: t.firstListener });
    setProvider(t.primary.english);
    setChecked(null); setDecisions({});
    setAudio({ firstListener: t.firstListener, transcript: t.transcript, secondTranscript: t.secondTranscript, notes: t.notes, detected: t.detected, timings: t.timings });
  }
  function decide(i: number, d: Decision) { setDecisions(prev => ({ ...prev, [i]: d })); }

  return (
    <>
      <a className="skip" href="#flags-h">Skip to the flags</a>
      <header className="wrap top">
        <div className="brand"><h1>Teach-Back</h1><span>interpreting safety check</span><button className="btn small quiet" onClick={() => startTour(0)}>How it works</button></div>
        <div className="session">
          <label>Session language
            <select value={language} onChange={e => setLanguage(e.target.value as Language)} aria-label="Session language">
              <option value="am">Amharic</option><option value="om">Afaan Oromo</option>
            </select>
          </label>
          <label>Setting
            <select value={setting} onChange={e => setSetting(e.target.value as Setting)} aria-label="Setting">
              {(Object.keys(SETTINGS) as Setting[]).map(k => <option key={k} value={k}>{SETTINGS[k].label}</option>)}
            </select>
          </label>
          <label>Date spoken
            <input type="date" value={reference} onChange={e => setReference(e.target.value)} aria-label="Date the words were spoken" />
          </label>
        </div>
      </header>

      <main className="wrap">
        <div className="notice">
          {setting === "clinic" ? "Nothing here advises a patient: it marks what a qualified interpreter must confirm, and a person decides every flag." : "Nothing here advises anyone or decides a case: it marks what a qualified interpreter must confirm, and a person decides every flag."}
        </div>
        {needAccess && <AccessPrompt onDone={() => setNeedAccess(false)} />}
        {tour !== null && (
          <section className="tour" aria-label="Guided walkthrough" aria-live="polite">
            <span className="eyebrow">Walkthrough {tour + 1} of {TOUR.length}</span>
            <h2 className="serif">{TOUR[tour].title}</h2>
            <p>{TOUR[tour].body}</p>
            {tour === 1 && analysis && <p className="hint">{open === 0 ? "Every flag is decided. The final line is on the right." : `${open} flag${open === 1 ? "" : "s"} still open.`}</p>}
            <div className="row">
              {tour > 0 && <button className="btn small quiet" onClick={() => startTour(tour - 1)}>Back</button>}
              {tour < TOUR.length - 1 && <button className="btn small primary" onClick={() => startTour(tour + 1)}>{tour === 0 ? "Next: decide a flag" : "Next"}</button>}
              {tour === TOUR.length - 1 && <button className="btn small primary" onClick={endTour}>Done, try it myself</button>}
              <button className="btn small quiet" onClick={endTour}>Skip</button>
            </div>
          </section>
        )}

        <div className={mode === "listen" ? "grid one" : "grid"}>
          <section className="panel" aria-labelledby="turn-h">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 id="turn-h">{mode === "listen" ? "This conversation" : "This turn"}</h2>
              <div className="tabs" role="tablist" aria-label="How the turn comes in">
                <button role="tab" aria-selected={mode === "listen"} className="tab" onClick={() => setMode("listen")}>Listen</button>
                <button role="tab" aria-selected={mode === "record"} className="tab" onClick={() => setMode("record")}>Record a turn</button>
                <button role="tab" aria-selected={mode === "paste"} className="tab" onClick={() => setMode("paste")}>Paste text</button>
              </div>
            </div>
            {mode === "listen" && (
              <Listen language={language} reference={reference} onAccessNeeded={() => setNeedAccess(true)}
                onSessionTurns={recs => saveTurns([...turns, ...recs])}
                renderFlag={(flag, decision, onDecide) => <FlagCard flag={flag} decision={decision} onDecide={onDecide} />} />
            )}
            {mode !== "listen" && <div className="tabs who" role="radiogroup" aria-label="Who is speaking">
              <button role="radio" aria-checked={role === "patient"} className="tab" onClick={() => { setRole("patient"); setProviderTurn(null); setChecked(null); }}>Patient speaks {LANG_NAME[language]}</button>
              <button role="radio" aria-checked={role === "provider"} className="tab" onClick={() => { setRole("provider"); setChecked(null); }}>Provider speaks English</button>
            </div>}
            {mode === "record" && role === "patient" && (
              <Recorder language={language} reference={reference} health={health} onTurn={onTurn} onAccessNeeded={() => setNeedAccess(true)} />
            )}
            {mode === "record" && role === "provider" && (
              <div className="steps">
                <div className="step" data-done={providerTurn ? "" : undefined}>
                  <span className="eyebrow">1. The provider, in English</span>
                  {!providerTurn && <Recorder language="en" reference={reference} health={health} onTurn={onProviderTurn} onAccessNeeded={() => setNeedAccess(true)} label="Record the provider" />}
                  {providerTurn && <>
                    <p className="render small">{providerTurn.english}</p>
                    <div className="row"><span className="hint">Heard by {providerTurn.firstListener ?? "the second listener"}.</span><button className="btn small quiet" onClick={() => setProviderTurn(null)}>Record again</button></div>
                  </>}
                </div>
                <div className="step" data-off={providerTurn ? undefined : ""}>
                  <span className="eyebrow">2. The interpreter, in {LANG_NAME[language]}</span>
                  {providerTurn
                    ? <Recorder language={language} reference={reference} health={health} onTurn={onTurn} onAccessNeeded={() => setNeedAccess(true)} label="Record the interpreter" />
                    : <p className="hint">Record the provider first. Then record the interpreter saying it to the patient, and the two are compared.</p>}
                </div>
              </div>
            )}
            {mode === "record" && audio && <TurnMeta meta={audio} language={language} />}
            {mode !== "listen" && <div className="field labelcheck">
              <label htmlFor="in-label">{setting === "clinic" ? "Medication label, optional. Photograph it, or type what it says; a contradiction with what was spoken is a flag." : "Document or label, optional. Photograph a medication label, or type the figures from a letter or form; a contradiction with what was spoken is a flag."}</label>
              <LabelPhoto onText={(t) => setLabel(t)} onAccessNeeded={() => setNeedAccess(true)} />
              <textarea id="in-label" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Metformin 500 mg. Take one tablet twice a day with food." style={{ minHeight: 56 }} />
              {mode === "record" && checked && <button className="btn small" onClick={() => check()}>Re-check this turn with the label</button>}
            </div>}
            {mode === "paste" && <>
            {role === "provider" && (
              <div className="field">
                <label htmlFor="in-provider">What the provider said (English)</label>
                <textarea id="in-provider" value={provider} onChange={e => setProvider(e.target.value)} />
              </div>
            )}
            <div className="field">
              <label htmlFor="in-a">{role === "provider" ? `The interpreter's ${LANG_NAME[language]}, heard back in English (Listener A)` : "Listener A rendering (Omnilingual ASR path)"}</label>
              <textarea id="in-a" value={a} onChange={e => setA(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="in-b">{role === "provider" ? "The same, from the second listener, optional" : "Listener B rendering (second listener), optional"}</label>
              <textarea id="in-b" value={b} onChange={e => setB(e.target.value)} />
            </div>
            <div className="row">
              <label className="hint">Detected spoken language
                <select value={spokenLanguage} onChange={e => setSpokenLanguage(e.target.value as Language | "")} aria-label="Detected spoken language" style={{ marginLeft: 8 }}>
                  <option value="">not detected</option><option value="am">Amharic</option><option value="om">Afaan Oromo</option>
                </select>
              </label>
              <span style={{ flex: 1 }} />
              <button className="btn primary" onClick={() => check()}>Check this turn</button>
            </div>
            </>}
          </section>

          {mode !== "listen" && <section className="panel" aria-labelledby="flags-h" aria-live="polite">
            <h2 id="flags-h" ref={flagsHeading} tabIndex={-1}>What a human must confirm</h2>
            {!analysis && mode === "record" && role === "patient" && <p className="hint">Record one patient turn. Both listeners render it in English, the critical facts are marked, and anything they disagree on appears here for a person to settle.</p>}
            {!analysis && mode === "record" && role === "provider" && <p className="hint">Record the provider, then the interpreter. What the interpreter said is brought back to English and compared, fact by fact, with what the provider said.</p>}
            {!analysis && mode === "paste" && role === "patient" && <p className="hint">Press Check this turn. The sample is a real failure pattern: the two listeners disagree on a side, a date, and whether the patient said "not".</p>}
            {!analysis && mode === "paste" && role === "provider" && <p className="hint">Press Check this turn. The sample is the failure that hurts most: the interpreter said 50 instead of 500 and dropped a "do not".</p>}
            {analysis && (
              <>
                <div className="status">
                  <span><b>{analysis.primary.facts.length}</b> critical facts</span>
                  <span><b>{crit}</b> critical flags</span>
                  <span><b>{open}</b> still open</span>
                </div>
                {checked?.role === "provider" && <span className="eyebrow">What the provider said</span>}
                <Rendering facts={analysis.primary.facts} text={analysis.primary.english} flags={analysis.flags} decisions={decisions} />
                {analysis.rendered && <>
                  <span className="eyebrow">What the interpreter said, heard back in English</span>
                  <p className="render small">{analysis.rendered.english}</p>
                </>}
                <div className="facts">
                  {analysis.primary.facts.map((f, i) => <span className="chip" key={i}>{TYPE_NAME[f.type]} <b>{f.value}</b></span>)}
                </div>
                <div className="flags">
                  {analysis.flags.map((f, i) => <FlagCard key={i} flag={f} decision={decisions[i] ?? { state: "open" }} onDecide={d => decide(i, d)} />)}
                </div>
                {analysis.question && (
                  <div className="question">
                    <span className="eyebrow">Teach-back question for the interpreter to ask</span>
                    <span className="q">{analysis.question.question}</span>
                    {(() => { const lq = localizedQuestion(analysis.question.about, language); return (
                      <span className={lq.reviewed ? "q" : "q draft"} lang={language}>{lq.text}</span>
                    ); })()}
                    <span className="hint">About the {TYPE_NAME[analysis.question.about.type]}: "{analysis.question.about.source}". {localizedQuestion(analysis.question.about, language).reviewed ? `${LANG_NAME[language]} wording reviewed by a native speaker.` : `${LANG_NAME[language]} wording is a draft awaiting native review; read it only if you agree with it.`}</span>
                  </div>
                )}
                {isFinal && (
                  <div className="final">
                    <span className="eyebrow">{analysis.flags.length ? "Final line, every flag reviewed by a person" : checked?.role === "provider" ? "Final line, the interpreter carried every fact through" : "Final line, two listeners agreed on every fact"}</span>
                    <p className="summary">{summary}</p>
                    <div className="row">
                      <button className="btn small primary" onClick={addToSession}>Add to session and next turn</button>
                      <button className="btn small" onClick={() => void copy(summary, "summary")}>{copied === "summary" ? "Copied" : "Copy line"}</button>
                      <button className="btn small quiet" onClick={nextTurn}>Discard turn</button>
                    </div>
                  </div>
                )}
                {!isFinal && (
                  <p className="hint">The line stays provisional until each flag is confirmed or corrected.</p>
                )}
              </>
            )}
          </section>}
        </div>

        <section className="panel" aria-labelledby="session-h">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 id="session-h">Session <span className="hint">{turns.length} turn{turns.length === 1 ? "" : "s"}, kept on this device only</span></h2>
            {turns.length > 0 && (
              <div className="row">
                <button className="btn small" onClick={() => void copy(sessionNotes(turns), "notes")}>{copied === "notes" ? "Copied" : "Copy notes"}</button>
                <button className="btn small" onClick={downloadSession}>Download JSON</button>
                <ClearButton onClear={() => saveTurns([])} />
              </div>
            )}
          </div>
          {turns.length === 0 && <p className="hint">Finished turns collect here, each with what was confirmed or corrected, ready to copy into the interpreter's notes.</p>}
          {turns.length > 0 && (
            <ol className="turns">
              {turns.map((t, n) => (
                <li key={t.id}>
                  <span className="mono when">{n + 1}. {t.at.slice(11, 16)}</span>
                  <div>
                    <p className="line">{t.summary}</p>
                    <p className="hint">
                      {LANG_NAME[t.language]}. {t.flags.length === 0 ? "No flags." : t.flags.map((f, i) => `${t.decisions[i]?.state === "corrected" ? "corrected" : "confirmed"} ${f.type ? TYPE_NAME[f.type] : f.kind.replace("_", " ")}`).join(", ") + "."}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>

      <footer className="wrap">
        Teach-Back is a hackathon prototype built Oct 26 to Nov 4, 2026 for the Meta Global AI Developer Hackathon. It is not a medical device, does not give medical advice, and does not replace a qualified interpreter. Dates are converted by code, never by a model.
      </footer>
    </>
  );
}

/**
 * One turn, one recording. MediaRecorder in the browser, the whole clip to /api/turn when it stops.
 * No streaming: a clinic turn is seconds long and the two listeners need the whole utterance.
 */
function Recorder({ language, reference, health, onTurn, onAccessNeeded, label }: { language: SpeechLanguage; reference: string; health: Health | null; onTurn: (t: TurnResponse) => void; onAccessNeeded: () => void; label?: string }) {
  const [state, setState] = useState<"idle" | "recording" | "sending" | "error">("idle");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Decided after mount, not during render: the server cannot know, and a guess there breaks hydration.
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    void Promise.resolve().then(() => setSupported(typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia)));
    return () => { if (timer.current) clearInterval(timer.current); rec.current?.stream.getTracks().forEach(t => t.stop()); };
  }, []);

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find(m => MediaRecorder.isTypeSupported(m)) || "";
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => { stream.getTracks().forEach(t => t.stop()); void send(new Blob(chunks.current, { type: r.mimeType || mime || "audio/webm" })); };
      r.start();
      rec.current = r;
      setSeconds(0);
      timer.current = setInterval(() => setSeconds(s => s + 1), 1000);
      setState("recording");
    } catch (e) {
      setState("error"); setError(e instanceof Error && e.name === "NotAllowedError" ? "Microphone access was refused. Allow it in the browser and try again." : `Could not start recording: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  function stop() {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    rec.current?.stop();
    setState("sending");
  }
  async function send(recorded: Blob) {
    // Every listener gets 16 kHz mono WAV: Voice Transcribe takes nothing else, and Spark's audio input was confirmed on it.
    const { blob, converted } = await toWav(recorded);
    const form = new FormData();
    form.append("audio", blob, converted ? "turn.wav" : `turn.${(recorded.type.split("/")[1] || "webm").split(";")[0]}`);
    if (!converted) form.append("note", "The browser could not decode its own recording; the clip was sent as recorded.");
    form.append("language", language);
    form.append("reference", reference);
    try {
      const res = await apiPost("/api/turn", form);
      const json = await res.json();
      const why = refusal(res.status, json);
      if (why === "access_required") { setState("idle"); onAccessNeeded(); return; }
      if (why) throw new Error(why);
      if (!res.ok) throw new Error(json.error === "no_listener" ? `Neither listener produced a rendering. ${(json.notes || []).join(" ")}` : json.error || `HTTP ${res.status}`);
      onTurn(json as TurnResponse);
      setState("idle");
    } catch (e) {
      setState("error"); setError(e instanceof Error ? e.message : String(e));
    }
  }

  const ready = health?.ready ?? false;
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0"), ss = String(seconds % 60).padStart(2, "0");
  return (
    <div className="recorder" data-state={state}>
      <div className="row">
        {state !== "recording" && <button className="btn primary" onClick={start} disabled={!supported || state === "sending"}>{state === "sending" ? "Listening twice…" : (label ?? "Record a turn")}</button>}
        {state === "recording" && <button className="btn rec" onClick={stop}><span className="dot" aria-hidden="true" />Stop and check <span className="mono">{mm}:{ss}</span></button>}
        <span className="hint">{language === "en" ? "English. One instruction or question, a few seconds to a minute." : `${LANG_NAME[language]} session. One turn, a few seconds to a minute.`}</span>
      </div>
      {!supported && <p className="hint">This browser cannot record audio. Use Paste text, or open the page in Chrome, Edge, Safari or Firefox.</p>}
      {health && !ready && (
        <p className="hint">
          Server not fully configured: Meta Model API key {health.metaModelApi.key}, ASR service {health.asr.service}. Recording still works with whichever listener is present; Paste text needs neither.
        </p>
      )}
      {state === "error" && <div className="flag" data-sev="crit"><div className="msg">{error}</div></div>}
    </div>
  );
}

/** Shown once when this deployment asks for an access code before spending model calls. */
function AccessPrompt({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState(() => getAccessCode());
  return (
    <div className="flag" data-sev="warn">
      <div className="head"><span className="kind">access code needed</span></div>
      <div className="msg">This deployment spends a shared model budget, so it asks for an access code once per device. Paste text works without one.</div>
      <div className="row">
        <input type="password" value={code} onChange={e => setCode(e.target.value)} placeholder="Access code" aria-label="Access code" autoComplete="off" />
        <button className="btn small primary" disabled={!code.trim()} onClick={() => { setAccessCode(code.trim()); onDone(); }}>Save on this device</button>
        <button className="btn small quiet" onClick={onDone}>Not now</button>
      </div>
    </div>
  );
}

function ClearButton({ onClear }: { onClear: () => void }) {
  const [arm, setArm] = useState(false);
  useEffect(() => { if (!arm) return; const t = setTimeout(() => setArm(false), 4000); return () => clearTimeout(t); }, [arm]);
  return arm
    ? <button className="btn small" style={{ borderColor: "var(--crit)", color: "var(--crit)" }} onClick={() => { onClear(); setArm(false); }}>Tap again to clear the session</button>
    : <button className="btn small quiet" onClick={() => setArm(true)}>Clear</button>;
}

/** "Listener A (Omnilingual ASR)" reads as "Omnilingual ASR" once "Heard" has said the rest. */
function shortListener(name: string | null) {
  if (!name) return "first listener";
  return (name.match(/\(([^)]+)\)/)?.[1] ?? name).replace(/,\s*fallback$/, " fallback");
}

function TurnMeta({ meta, language }: { meta: AudioMeta; language: Language }) {
  const lang = meta.detected.language ?? language;
  return (
    <div className="turnmeta">
      {meta.transcript && (
        <div className="field">
          <span className="eyebrow">Heard ({shortListener(meta.firstListener)}, {LANG_NAME[language]})</span>
          <p className="transcript" lang={lang}>{meta.transcript}</p>
        </div>
      )}
      {meta.secondTranscript && meta.secondTranscript !== meta.transcript && (
        <div className="field">
          <span className="eyebrow">Heard (Muse Spark)</span>
          <p className="transcript" lang={lang}>{meta.secondTranscript}</p>
        </div>
      )}
      <div className="status">
        <span>language <b>{meta.detected.language ? `${LANG_NAME[meta.detected.language]} (${Math.round(meta.detected.confidence * 100)}%, ${meta.detected.by})` : "not detected"}</b></span>
        {meta.timings.asrMs !== null && <span>ASR <b className="mono">{(meta.timings.asrMs / 1000).toFixed(1)}s</b></span>}
        {meta.timings.listenMs !== null && <span>Spark <b className="mono">{(meta.timings.listenMs / 1000).toFixed(1)}s</b></span>}
      </div>
      {meta.notes.length > 0 && <ul className="notes">{meta.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
    </div>
  );
}

function Rendering({ text, facts, flags, decisions }: { text: string; facts: Fact[]; flags: Flag[]; decisions: Record<number, Decision> }) {
  const correctionOf = (factIndex: number): string | undefined => {
    const i = flags.findIndex(f => f.factIndex === factIndex && decisions[flags.indexOf(f)]?.state === "corrected");
    return i >= 0 ? decisions[i]?.correction : undefined;
  };
  const stateOf = (factIndex: number): "crit" | "warn" | "ok" | "none" => {
    const related = flags.map((f, i) => ({ f, i })).filter(x => x.f.factIndex === factIndex);
    if (!related.length) return "none";
    if (related.every(x => (decisions[x.i]?.state ?? "open") !== "open")) return "ok";
    return related.some(x => x.f.severity === "crit") ? "crit" : "warn";
  };
  // Spans nest (a negation contains the drug inside it), so marks are rendered recursively: a fact
  // whose span sits inside another is drawn inside that mark, not dropped.
  const order = facts.map((f, i) => i).sort((p, q) => facts[p].start - facts[q].start || facts[q].end - facts[p].end);
  const render = (from: number, to: number, pool: number[]): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    let cursor = from;
    for (let k = 0; k < pool.length; k++) {
      const i = pool[k]; const f = facts[i];
      if (f.start < cursor || f.end > to) continue; // partial overlap: skip, the first mark wins
      out.push(text.slice(cursor, f.start));
      const inner: number[] = [];
      while (k + 1 < pool.length && facts[pool[k + 1]].start >= f.start && facts[pool[k + 1]].end <= f.end) { inner.push(pool[k + 1]); k++; }
      const st = stateOf(i);
      const fix = correctionOf(i);
      out.push(
        <mark key={i} data-flag={st === "none" ? undefined : st} title={`${TYPE_NAME[f.type]}: ${f.value}${f.note ? ". " + f.note : ""}`}>
          {fix ? <><s>{text.slice(f.start, f.end)}</s> {fix}</> : render(f.start, f.end, inner)}
        </mark>,
      );
      cursor = f.end;
    }
    out.push(text.slice(cursor, to));
    return out;
  };
  const parts = render(0, text.length, order);
  return <p className="render">{parts}</p>;
}

function FlagCard({ flag, decision, onDecide }: { flag: Flag; decision: Decision; onDecide: (d: Decision) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const done = decision.state !== "open";
  const kindLabel: Record<Flag["kind"], string> = {
    listener_disagreement: "listeners disagree", single_listener: "only one listener heard this", language_mismatch: "wrong language",
    label_conflict: "label contradicts speech", invalid_date: "date does not exist", ambiguous_calendar: "which calendar?",
    unverified: "one listener only, nothing cross-checked",
    interpreter_changed: "interpreter changed this", interpreter_dropped: "interpreter dropped this", interpreter_added: "interpreter added this",
  };
  return (
    <div className="flag" data-sev={flag.severity} data-state={done ? "confirmed" : undefined}>
      <div className="head">
        <span className="kind">{done ? (decision.state === "corrected" ? "corrected by reviewer" : "confirmed by reviewer") : kindLabel[flag.kind]}</span>
        {flag.type && <span className="eyebrow">{TYPE_NAME[flag.type]}</span>}
      </div>
      <div className="msg">{decision.state === "corrected" ? <>Reviewer wrote: <b>{decision.correction}</b></> : flag.message}</div>
      {flag.a && flag.b && !done && (
        <div className="vs">
          <div><small>{flag.kind.startsWith("interpreter_") ? "Provider said" : "Listener A"}</small>{flag.a}</div>
          <div><small>{flag.kind === "label_conflict" ? "Label" : flag.kind.startsWith("interpreter_") ? "Interpreter said" : "Listener B"}</small>{flag.b}</div>
        </div>
      )}
      {!done && !editing && (
        <div className="row">
          <button className="btn small" onClick={() => onDecide({ state: "confirmed" })}>Confirmed with patient</button>
          <button className="btn small quiet" onClick={() => setEditing(true)}>Correct it</button>
        </div>
      )}
      {!done && editing && (
        <div className="row">
          <input type="text" value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && value.trim()) onDecide({ state: "corrected", correction: value.trim() }); if (e.key === "Escape") setEditing(false); }} placeholder="What the patient actually said" aria-label="Correction" autoFocus />
          <button className="btn small primary" disabled={!value.trim()} onClick={() => onDecide({ state: "corrected", correction: value.trim() })}>Save correction</button>
          <button className="btn small quiet" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      )}
      {done && <div className="row"><button className="btn small quiet" onClick={() => onDecide({ state: "open" })}>Reopen</button></div>}
    </div>
  );
}
