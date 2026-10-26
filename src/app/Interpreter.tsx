"use client";

import { useMemo, useState } from "react";
import { extractFacts } from "@/core/facts";
import { analyzeTurn, compareWithLabel, languageMismatch } from "@/core/compare";
import { teachBackQuestion } from "@/core/question";
import type { Fact, Flag, Language } from "@/core/types";

/**
 * The interpreter's screen. One patient turn at a time: the English rendering with every
 * critical fact marked, the flags a human must confirm, and the teach-back question to ask.
 *
 * Text mode: both listeners' renderings are pasted in. The audio path (Omnilingual ASR as the
 * first listener, Muse Spark as the second) plugs into the same core on Day 2 of the build.
 */

const SAMPLE_A = "The doctor told me to take two tablets of 500 milligrams three times a day after meals. I am not allergic to penicillin. The fever started on Tikimt 3. The pain is in my left knee.";
const SAMPLE_B = "The doctor told me to take two tablets of 50 milligrams three times a day after meals. I am allergic to penicillin. The fever started on Tikimt 13. The pain is in my left knee.";
const SAMPLE_LABEL = "";

const LANG_NAME: Record<Language, string> = { am: "Amharic", om: "Afaan Oromo" };
const TYPE_NAME: Record<Fact["type"], string> = { dose: "dose", frequency: "frequency", drug: "drug", negation: "negation", body_part: "body part", date: "date", duration: "duration" };

type Decision = { state: "open" | "confirmed" | "corrected"; correction?: string };

export default function Interpreter() {
  const [language, setLanguage] = useState<Language>("am");
  const [spokenLanguage, setSpokenLanguage] = useState<Language | "">("");
  const [reference, setReference] = useState(() => new Date().toISOString().slice(0, 10));
  const [a, setA] = useState(SAMPLE_A);
  const [b, setB] = useState(SAMPLE_B);
  const [label, setLabel] = useState(SAMPLE_LABEL);
  const [checked, setChecked] = useState<{ a: string; b: string; label: string; language: Language; spoken: Language | ""; reference: string } | null>(null);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});

  const analysis = useMemo(() => {
    if (!checked) return null;
    const [y, m, d] = checked.reference.split("-").map(Number);
    const opts = { reference: { year: y, month: m, day: d }, language: checked.language };
    const primary = { name: "Listener A", english: checked.a, facts: extractFacts(checked.a, opts) };
    const secondary = checked.b.trim() ? { name: "Listener B", english: checked.b, facts: extractFacts(checked.b, opts) } : undefined;
    const extra: Flag[] = [];
    const mismatch = languageMismatch(checked.language, checked.spoken || null);
    if (mismatch) extra.push(mismatch);
    if (checked.label.trim()) extra.push(...compareWithLabel(primary.facts, extractFacts(checked.label, opts)));
    const turn = analyzeTurn(primary, secondary, extra);
    return { ...turn, question: teachBackQuestion(primary.facts) };
  }, [checked]);

  const open = analysis ? analysis.flags.filter((_, i) => (decisions[i]?.state ?? "open") === "open").length : 0;
  const crit = analysis ? analysis.flags.filter(f => f.severity === "crit").length : 0;

  function check() {
    setChecked({ a, b, label, language, spoken: spokenLanguage, reference });
    setDecisions({});
  }
  function decide(i: number, d: Decision) { setDecisions(prev => ({ ...prev, [i]: d })); }

  return (
    <>
      <header className="wrap top">
        <div className="brand"><h1>Teach-Back</h1><span>interpreting safety check</span></div>
        <div className="session">
          <label>Session language
            <select value={language} onChange={e => setLanguage(e.target.value as Language)} aria-label="Session language">
              <option value="am">Amharic</option><option value="om">Afaan Oromo</option>
            </select>
          </label>
          <label>Date spoken
            <input type="date" value={reference} onChange={e => setReference(e.target.value)} aria-label="Date the words were spoken" />
          </label>
        </div>
      </header>

      <main className="wrap">
        <div className="notice">
          Text mode. Paste what each listener rendered in English; the audio path connects next. Nothing here advises a patient: it marks what a qualified interpreter must confirm.
        </div>

        <div className="grid">
          <section className="panel" aria-labelledby="turn-h">
            <h2 id="turn-h">This turn</h2>
            <div className="field">
              <label htmlFor="in-a">Listener A rendering (Omnilingual ASR path)</label>
              <textarea id="in-a" value={a} onChange={e => setA(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="in-b">Listener B rendering (second listener), optional</label>
              <textarea id="in-b" value={b} onChange={e => setB(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="in-label">Medication label text, optional (SAM 3.1 and Spark read this from a photo on Day 5)</label>
              <textarea id="in-label" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Metformin 500 mg. Take one tablet twice a day with food." style={{ minHeight: 56 }} />
            </div>
            <div className="row">
              <label className="hint">Detected spoken language
                <select value={spokenLanguage} onChange={e => setSpokenLanguage(e.target.value as Language | "")} aria-label="Detected spoken language" style={{ marginLeft: 8 }}>
                  <option value="">not detected</option><option value="am">Amharic</option><option value="om">Afaan Oromo</option>
                </select>
              </label>
              <span style={{ flex: 1 }} />
              <button className="btn primary" onClick={check}>Check this turn</button>
            </div>
          </section>

          <section className="panel" aria-labelledby="flags-h" aria-live="polite">
            <h2 id="flags-h">What a human must confirm</h2>
            {!analysis && <p className="hint">Press Check this turn. The sample is a real failure pattern: the two listeners disagree on a dose, a date, and whether the patient said "not".</p>}
            {analysis && (
              <>
                <div className="status">
                  <span><b>{analysis.primary.facts.length}</b> critical facts</span>
                  <span><b>{crit}</b> critical flags</span>
                  <span><b>{open}</b> still open</span>
                </div>
                <Rendering facts={analysis.primary.facts} text={analysis.primary.english} flags={analysis.flags} decisions={decisions} />
                <div className="facts">
                  {analysis.primary.facts.map((f, i) => <span className="chip" key={i}>{TYPE_NAME[f.type]} <b>{f.value}</b></span>)}
                </div>
                {analysis.flags.length === 0 && <div className="final">No disagreements. Confirm the facts above with the patient as usual.</div>}
                <div className="flags">
                  {analysis.flags.map((f, i) => <FlagCard key={i} flag={f} decision={decisions[i] ?? { state: "open" }} onDecide={d => decide(i, d)} />)}
                </div>
                {analysis.question && (
                  <div className="question">
                    <span className="eyebrow">Teach-back question for the interpreter to ask</span>
                    <span className="q">{analysis.question.question}</span>
                    <span className="hint">About the {TYPE_NAME[analysis.question.about.type]}: "{analysis.question.about.source}". {LANG_NAME[language]} wording arrives after native review.</span>
                  </div>
                )}
                {analysis.flags.length > 0 && open === 0 && (
                  <div className="final">Every flag has been reviewed by a person. The English summary can now be written down.</div>
                )}
                {analysis.flags.length > 0 && open > 0 && (
                  <p className="hint">The summary stays provisional until each flag is confirmed or corrected.</p>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      <footer className="wrap">
        Teach-Back is a hackathon prototype built Oct 26 to Nov 4, 2026 for the Meta Global AI Developer Hackathon. It is not a medical device, does not give medical advice, and does not replace a qualified interpreter. Dates are converted by code, never by a model.
      </footer>
    </>
  );
}

function Rendering({ text, facts, flags, decisions }: { text: string; facts: Fact[]; flags: Flag[]; decisions: Record<number, Decision> }) {
  const stateOf = (factIndex: number): "crit" | "warn" | "ok" | "none" => {
    const related = flags.map((f, i) => ({ f, i })).filter(x => x.f.factIndex === factIndex);
    if (!related.length) return "none";
    if (related.every(x => (decisions[x.i]?.state ?? "open") !== "open")) return "ok";
    return related.some(x => x.f.severity === "crit") ? "crit" : "warn";
  };
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  facts.forEach((f, i) => {
    if (f.start < cursor) return;
    parts.push(text.slice(cursor, f.start));
    const st = stateOf(i);
    parts.push(<mark key={i} data-flag={st === "none" ? undefined : st} title={`${TYPE_NAME[f.type]}: ${f.value}${f.note ? " — " + f.note : ""}`}>{text.slice(f.start, f.end)}</mark>);
    cursor = f.end;
  });
  parts.push(text.slice(cursor));
  return <p className="render">{parts}</p>;
}

function FlagCard({ flag, decision, onDecide }: { flag: Flag; decision: Decision; onDecide: (d: Decision) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const done = decision.state !== "open";
  const kindLabel: Record<Flag["kind"], string> = {
    listener_disagreement: "listeners disagree", single_listener: "only one listener heard this", language_mismatch: "wrong language",
    label_conflict: "label contradicts speech", invalid_date: "date does not exist", ambiguous_calendar: "which calendar?",
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
          <div><small>Listener A</small>{flag.a}</div>
          <div><small>{flag.kind === "label_conflict" ? "Label" : "Listener B"}</small>{flag.b}</div>
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
          <input type="text" value={value} onChange={e => setValue(e.target.value)} placeholder="What the patient actually said" aria-label="Correction" />
          <button className="btn small primary" disabled={!value.trim()} onClick={() => onDecide({ state: "corrected", correction: value.trim() })}>Save correction</button>
          <button className="btn small quiet" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      )}
      {done && <div className="row"><button className="btn small quiet" onClick={() => onDecide({ state: "open" })}>Reopen</button></div>}
    </div>
  );
}
