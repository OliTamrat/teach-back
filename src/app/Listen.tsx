"use client";

import { useEffect, useRef, useState } from "react";
import { conversationText, placeTurn, relabel, turnFlags, ROLE_LABEL, type ConversationTurn } from "@/core/conversation";
import { compareWithLabel } from "@/core/compare";
import { extractFacts } from "@/core/facts";
import { finalSummary, makeTurn, type Decision, type TurnRecord } from "@/core/session";
import type { Flag, Language, SpeechLanguage } from "@/core/types";
import { apiPost, refusal } from "./api-client";
import { startSegmenter, type Segmenter } from "./vad";

/**
 * Listening mode. One button. The microphone stays open, the audio is cut into turns at pauses,
 * each turn is queued and checked while the next is being spoken, and every change of language
 * is taken as the interpreter rendering the turn before it. The interpreter keeps interpreting;
 * the red lines arrive a few seconds behind, in order, for a person to settle.
 */
type Props = {
  language: Language; reference: string;
  /** Text read from a medication label, or typed. Checked against the latest patient turn. */
  label?: string;
  /** The label card, rendered by the parent, shown in the left rail. */
  labelSlot?: React.ReactNode;
  onAccessNeeded: () => void;
  onSessionTurns: (turns: TurnRecord[]) => void;
  renderFlag: (flag: Flag, decision: Decision, onDecide: (d: Decision) => void) => React.ReactNode;
};
type Pending = { id: string; seconds: number; state: "queued" | "listening" | "failed"; error?: string };
type TurnResponse = { language: SpeechLanguage; notes: string[]; transcript: string; primary: { english: string; facts: ConversationTurn["facts"] }; flags: Flag[]; timings: { asrMs: number | null; listenMs: number | null } };

const LANG: Record<SpeechLanguage, string> = { am: "Amharic", om: "Afaan Oromo", en: "English" };
/** How long a silence ends a turn. People pause mid-sentence; an elder more than a nurse. */
const PAUSES: Array<{ key: string; label: string; ms: number }> = [
  { key: "quick", label: "Quick (0.9 s)", ms: 900 }, { key: "normal", label: "Normal (1.5 s)", ms: 1500 }, { key: "patient", label: "Patient speaker (2.5 s)", ms: 2500 },
];

export default function Listen({ language, reference, label, labelSlot, onAccessNeeded, onSessionTurns, renderFlag }: Props) {
  const [state, setState] = useState<"idle" | "listening" | "stopping">("idle");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const [timings, setTimings] = useState<number[]>([]);
  const [pause, setPause] = useState("normal");
  const [copied, setCopied] = useState(false);
  const seg = useRef<Segmenter | null>(null);
  const queue = useRef<Array<{ id: string; wav: Blob; seconds: number }>>([]);
  const busy = useRef(false);
  const failed = useRef<Set<string>>(new Set());
  function retry(id: string) { failed.current.delete(id); setPending(p => p.map(x => x.id === id ? { ...x, state: "queued", error: undefined } : x)); void drain(); }
  function skip(id: string) { failed.current.delete(id); queue.current = queue.current.filter(x => x.id !== id); setPending(p => p.filter(x => x.id !== id)); void drain(); }
  const turnsRef = useRef<ConversationTurn[]>([]);
  const meter = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => { turnsRef.current = turns; }, [turns]);
  useEffect(() => () => { seg.current?.stop(); if (meter.current) clearInterval(meter.current); }, []);

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      seg.current = startSegmenter(stream, (wav, seconds) => {
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        queue.current.push({ id, wav, seconds });
        setPending(p => [...p, { id, seconds, state: "queued" }]);
        void drain();
      }, { silenceMs: PAUSES.find(p => p.key === pause)?.ms ?? 1500 });
      meter.current = setInterval(() => setLevel(seg.current?.level() ?? 0), 120);
      setState("listening");
    } catch (e) {
      setError(e instanceof Error && e.name === "NotAllowedError" ? "Microphone access was refused. Allow it in the browser and try again." : `Could not start: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  function stop() {
    setState("stopping");
    seg.current?.stop(); seg.current = null;
    if (meter.current) { clearInterval(meter.current); meter.current = null; }
    setLevel(0);
    setState("idle");
  }

  /** Turns are checked one at a time, in the order they were spoken, so the alternation rule holds; recording never waits. */
  async function drain() {
    if (busy.current) return;
    busy.current = true;
    try {
      while (queue.current.length) {
        const item = queue.current[0];
        if (failed.current.has(item.id)) break; // a failed turn waits for Retry or Skip; later turns wait behind it, because order is the meaning
        setPending(p => p.map(x => x.id === item.id ? { ...x, state: "listening" } : x));
        const t0 = Date.now();
        try {
          const form = new FormData();
          form.append("audio", item.wav, "turn.wav"); form.append("language", "auto"); form.append("session", language); form.append("reference", reference);
          const res = await apiPost("/api/turn", form);
          const json = await res.json();
          const why = refusal(res.status, json);
          if (why === "access_required") { onAccessNeeded(); throw new Error("This deployment asks for an access code first."); }
          if (why) throw new Error(why);
          if (!res.ok) throw new Error(json.error === "no_listener" ? `No listener heard this turn. ${(json.notes || []).join(" ")}` : json.error || `HTTP ${res.status}`);
          const t = json as TurnResponse;
          const placed = placeTurn(turnsRef.current, {
            id: item.id, at: new Date().toISOString(), language: t.language, english: t.primary.english, transcript: t.transcript, facts: t.primary.facts, listenerFlags: t.flags,
          }, language);
          turnsRef.current = [...turnsRef.current, placed];
          setTurns(turnsRef.current);
          setTimings(x => [...x, Date.now() - t0]);
          queue.current.shift();
          setPending(p => p.filter(x => x.id !== item.id));
        } catch (e) {
          failed.current.add(item.id);
          setPending(p => p.map(x => x.id === item.id ? { ...x, state: "failed", error: e instanceof Error ? e.message : String(e) } : x));
          break;
        }
      }
    } finally { busy.current = false; }
  }

  /** The label is checked against what the patient most recently said they take; the flags sit on that turn. */
  const labelTarget = [...turns].reverse().find(t => t.role === "patient");
  const labelFlags: Flag[] = label?.trim() && labelTarget
    ? compareWithLabel(labelTarget.facts, extractFacts(label, { reference: refOf(reference), language }))
    : [];
  const flagsFor = (t: ConversationTurn): Flag[] => t.id === labelTarget?.id ? [...turnFlags(t), ...labelFlags] : turnFlags(t);
  /** A decision's key. Label flags come and go as the label text changes, so theirs is by content, never by position. */
  const keyFor = (t: ConversationTurn, f: Flag, i: number) => f.kind === "label_conflict" ? `${t.id}:label:${f.type}:${f.a}:${f.b}` : `${t.id}:${i}`;
  function decide(key: string, d: Decision) { setDecisions(prev => ({ ...prev, [key]: d })); }
  /** The rule got a role wrong: a person sets it, and every later pairing is recomputed. Decisions on that turn and after are cleared, because the flags changed. */
  function setRole(turnId: string, role: ConversationTurn["role"]) {
    const next = relabel(turnsRef.current, turnId, { role }, language);
    turnsRef.current = next; setTurns(next);
    const idx = next.findIndex(t => t.id === turnId);
    setDecisions(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => next.findIndex(t => k.startsWith(t.id + ":")) < idx)));
  }
  const rendersLabel = (t: ConversationTurn) => {
    if (!t.rendersId) return "";
    const nums = t.rendersId.split("+").map(id => turns.findIndex(x => x.id === id) + 1).filter(n => n > 0);
    return nums.length > 1 ? ` · renders turns ${nums[0]}–${nums[nums.length - 1]}` : nums.length === 1 ? ` · renders turn ${nums[0]}` : "";
  };
  const openCount = turns.reduce((n, t) => n + flagsFor(t).filter((f, i) => (decisions[keyFor(t, f, i)]?.state ?? "open") === "open").length, 0);
  const avg = timings.length ? timings.reduce((a, b) => a + b, 0) / timings.length / 1000 : null;

  /** The record after review: each turn with the reviewer's corrections written in. */
  const reviewedText = () => turns.map((t, i) => {
    const flags = flagsFor(t);
    const d = flags.map((f, k) => decisions[keyFor(t, f, k)] ?? { state: "open" as const });
    return `${i + 1}. ${ROLE_LABEL[t.role]}: ${finalSummary(t.english, t.facts, flags, d)}`;
  }).join("\n");
  async function copyRecord() { try { await navigator.clipboard.writeText(reviewedText()); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* shown on screen anyway */ } }
  function endSession() {
    const records = turns.map(t => {
      const flags = flagsFor(t);
      return makeTurn({ language, reference, role: t.language === "en" ? "provider" : "patient", speaker: ROLE_LABEL[t.role], transcript: t.transcript, english: t.english, facts: t.facts, flags, decisions: flags.map((f, i) => decisions[keyFor(t, f, i)] ?? { state: "confirmed" as const }) });
    });
    onSessionTurns(records);
    setTurns([]); setDecisions({}); setPending([]); setTimings([]); turnsRef.current = [];
  }

  return (
    <div className="listen zones">
      <div className="rail">
      <div className="row">
        {state !== "listening" && <button className="btn primary" onClick={start}>Start listening</button>}
        {state === "listening" && <button className="btn rec" onClick={stop}><span className="dot" aria-hidden="true" />Stop listening</button>}
        {state === "listening" && <button className="btn small quiet" onClick={() => seg.current?.cut()} title="End the current turn now, if the room is too loud for pauses to be heard">Cut turn</button>}
        {state === "listening" && <span className="meter" aria-hidden="true"><span style={{ width: `${Math.min(100, level * 900)}%` }} /></span>}
        {state !== "listening" && (
          <label className="hint">Pause that ends a turn
            <select value={pause} onChange={e => setPause(e.target.value)} aria-label="Pause that ends a turn" style={{ marginLeft: 8 }}>
              {PAUSES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
        )}
        <span className="hint">{state === "listening" ? "Everyone just talks. Turns are cut at pauses and checked in order; a change of language is the interpreter. If a role is wrong, set it on the turn." : `${LANG[language]} session. One button; the interpreter keeps interpreting.`}</span>
      </div>
      {error && <div className="flag" data-sev="crit"><div className="msg">{error}</div></div>}
      {(turns.length > 0 || pending.length > 0) && (
        <div className="status">
          <span><b>{turns.length}</b> turns</span>
          <span><b>{openCount}</b> flags open</span>
          {pending.length > 0 && <span><b>{pending.length}</b> being checked</span>}
          {avg !== null && <span>about <b className="mono">{avg.toFixed(1)}s</b> per turn</span>}
        </div>
      )}
      {turns.length > 0 && openCount > 0 && <p className="hint">Keys: <kbd>C</kbd> confirms the first open flag, <kbd>E</kbd> corrects it.</p>}
      {labelSlot && <div className="field labelcheck"><span className="eyebrow">The bottle from the bag</span>{labelSlot}{label?.trim() && !labelTarget && <p className="hint">The label is checked against the patient&apos;s latest turn once there is one.</p>}</div>}
      </div>
      <div className="convo-wrap">
      {turns.length === 0 && pending.length === 0 && <p className="hint">{state === "listening" ? "Listening. The first turn appears here after the first pause." : "The conversation appears here, turn by turn, with the flags on the turn they belong to."}</p>}
      <ol className="convo">
        {turns.map((t, n) => {
          const flags = flagsFor(t);
          return (
            <li key={t.id} className="turn" data-role={t.role} data-crit={flags.some((f, i) => f.severity === "crit" && (decisions[keyFor(t, f, i)]?.state ?? "open") === "open") ? "" : undefined}>
              <div className="head">
                <span className="eyebrow">{n + 1}. {ROLE_LABEL[t.role]} · {LANG[t.language]}{rendersLabel(t)}{t.forcedRole ? " · set by hand" : ""}</span>
                <label className="eyebrow">who
                  <select className="who" value={t.role} onChange={e => setRole(t.id, e.target.value as ConversationTurn["role"])} aria-label={`Who spoke turn ${n + 1}`}>
                    <option value="patient">Patient</option><option value="provider">Provider</option>
                    <option value="interpreter_to_provider">Interpreter, to the provider</option><option value="interpreter_to_patient">Interpreter, to the patient</option>
                  </select>
                </label>
              </div>
              <p className="line">{t.english}</p>
              {t.language !== "en" && t.transcript && <p className="hint" lang={t.language}>{t.transcript}</p>}
              {flags.length > 0 && <div className="flags">{flags.map((f, i) => <div key={keyFor(t, f, i)}>{renderFlag(f, decisions[keyFor(t, f, i)] ?? { state: "open" }, d => decide(keyFor(t, f, i), d))}</div>)}</div>}
            </li>
          );
        })}
        {pending.map(p => (
          <li key={p.id} className="turn pending" data-state={p.state}>
            <span className="eyebrow">{p.state === "failed" ? "could not be checked; later turns wait behind it" : p.state === "listening" ? "listening twice…" : "waiting"} · {p.seconds.toFixed(0)}s of speech</span>
            {p.error && <p className="hint">{p.error}</p>}
            {p.state === "failed" && <div className="row"><button className="btn small primary" onClick={() => retry(p.id)}>Retry</button><button className="btn small quiet" onClick={() => skip(p.id)}>Skip this turn</button></div>}
          </li>
        ))}
      </ol>
      </div>
      <aside className="rail record-box" aria-label="The record">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="eyebrow">The record</span>
          {turns.length > 0 && <span className="lock" data-open={openCount === 0 ? "true" : "false"} aria-live="polite">{openCount === 0 ? "Unlocked" : <><span className="n">{openCount}</span> unconfirmed, locked</>}</span>}
        </div>
        {turns.length === 0 && <p className="hint">Locked until every flag on every turn is confirmed or corrected by a person. Then it can be copied into the notes.</p>}
        {turns.length > 0 && openCount === 0 && <>
          <span className="eyebrow">After review</span>
          <p className="text">{reviewedText()}</p>
        </>}
        {turns.length > 0 && (
          <>
            <span className="eyebrow">As it arrived, before review{openCount === 0 ? "" : ". What would go through unchecked"}</span>
            <p className="text arrived">{conversationText(turns)}</p>
          </>
        )}
        {turns.length > 0 && (
          <div className="row">
            <button className="btn small primary" onClick={() => void copyRecord()} disabled={openCount > 0} title={openCount > 0 ? "Decide every flag first" : undefined}>{copied ? "Copied" : "Copy the verified record"}</button>
            {state !== "listening" && <button className="btn small" onClick={endSession} disabled={openCount > 0}>Add to the session</button>}
          </div>
        )}
      </aside>
    </div>
  );
}

function refOf(iso: string) { const [y, m, d] = iso.split("-").map(Number); return { year: y, month: m, day: d }; }
