"use client";

import { useMemo, useState } from "react";
import { QUESTION_TEMPLATES_EN } from "@/core/question";
import { FACT_TYPES } from "@/core/review";

type Lang = "am" | "om";
type Item = { id: string; spoken: Lang; english: string; text: string; factType: string; reviewed: boolean; reviewer?: string };
type Templates = Record<Lang, { reviewed: boolean; reviewer?: string } & Record<string, string | boolean | undefined>>;
type State = { state: "approved" | "changed"; text?: string; note?: string };
const LANG: Record<Lang, string> = { am: "Amharic", om: "Afaan Oromo" };
const TYPE_LABEL: Record<string, string> = { dose: "dose", frequency: "frequency", drug: "drug name", negation: "negation", body_part: "body part", date: "date", duration: "duration" };
const EXAMPLE: Record<string, string> = { dose: "two tablets", frequency: "three times a day", drug: "metformin", negation: "I am not allergic to penicillin", body_part: "left knee", date: "Tikimt 3", duration: "three weeks" };

export default function Review({ items, templates }: { items: Item[]; templates: Templates }) {
  const [lang, setLang] = useState<Lang>("am");
  const [reviewer, setReviewer] = useState("");
  const [sent, setSent] = useState<Record<string, State>>({});
  const [tpl, setTpl] = useState<Record<string, State>>({});
  const list = useMemo(() => items.filter(i => i.spoken === lang), [items, lang]);
  const decided = list.filter(i => sent[i.id]).length;
  const tdecided = FACT_TYPES.filter(t => tpl[t]).length;

  function setS(id: string, s: State | null) { setSent(prev => { const n = { ...prev }; if (s) n[id] = s; else delete n[id]; return n; }); }
  function setT(id: string, s: State | null) { setTpl(prev => { const n = { ...prev }; if (s) n[id] = s; else delete n[id]; return n; }); }
  function switchLang(l: Lang) { setLang(l); setSent({}); setTpl({}); }
  function download() {
    const out = {
      reviewer: reviewer.trim(), language: lang, on: new Date().toISOString().slice(0, 10),
      sentences: Object.entries(sent).map(([id, s]) => ({ id, ...s })),
      templates: Object.entries(tpl).map(([id, s]) => ({ id, ...s })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `review-${lang}-${out.on}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <header className="wrap top">
        <div className="brand"><h1>Teach-Back</h1><span>native review</span></div>
        <div className="session">
          <label>Language
            <select value={lang} onChange={e => switchLang(e.target.value as Lang)} aria-label="Language under review">
              <option value="am">Amharic</option><option value="om">Afaan Oromo</option>
            </select>
          </label>
          <label>Reviewer <input type="text" value={reviewer} onChange={e => setReviewer(e.target.value)} placeholder="Your name" aria-label="Reviewer name" /></label>
        </div>
      </header>
      <main className="wrap">
        <div className="notice">
          These are drafts written for a native speaker to correct. For each line: if you would say it this way, approve it; if not, write it the way you would say it to an older patient, politely, and we use your words. The English is the meaning to keep. Your name goes on the file, not on the website.
        </div>

        <section className="panel">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Questions the interpreter asks <span className="hint">{tdecided} of {FACT_TYPES.length} decided{templates[lang].reviewed ? `, already reviewed by ${templates[lang].reviewer}` : ""}</span></h2>
          </div>
          <p className="hint">{"{source}"} stands for the patient's own words, for example "{EXAMPLE.negation}". Keep it where you would quote the patient.</p>
          <ol className="reviewlist">
            {FACT_TYPES.map(t => (
              <ReviewRow key={t} id={t} label={TYPE_LABEL[t]} lang={lang} english={englishQuestion(t)} draft={String(templates[lang][t] ?? "")} state={tpl[t]} onChange={s => setT(t, s)} />
            ))}
          </ol>
        </section>

        <section className="panel">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Sentences the volunteers read <span className="hint">{decided} of {list.length} decided</span></h2>
          </div>
          <ol className="reviewlist">
            {list.map(it => (
              <ReviewRow key={it.id} id={it.id} label={`${it.id} · ${TYPE_LABEL[it.factType] || it.factType}${it.reviewed ? ` · reviewed by ${it.reviewer}` : ""}`} lang={lang} english={it.english} draft={it.text} state={sent[it.id]} onChange={s => setS(it.id, s)} />
            ))}
          </ol>
        </section>

        <section className="panel">
          <div className="row">
            <button className="btn primary" onClick={download} disabled={!reviewer.trim() || (decided + tdecided) === 0}>Download review file</button>
            <span className="hint">{!reviewer.trim() ? "Add your name first." : `${decided + tdecided} decision${decided + tdecided === 1 ? "" : "s"} will be in the file.`} Send the file to Oli; it is applied with <span className="mono">npm run review:apply</span>.</span>
          </div>
        </section>
      </main>
      <footer className="wrap">Teach-Back is a hackathon prototype. Nothing on this page is uploaded; the review file is saved on this device.</footer>
    </>
  );
}

function englishQuestion(t: string): string { return QUESTION_TEMPLATES_EN[t as keyof typeof QUESTION_TEMPLATES_EN] || ""; }

function ReviewRow({ id, label, lang, english, draft, state, onChange }: { id: string; label: string; lang: Lang; english: string; draft: string; state?: State; onChange: (s: State | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draft);
  const [note, setNote] = useState("");
  return (
    <li className="reviewrow" data-state={state?.state} id={`r-${id}`}>
      <span className="eyebrow">{label}</span>
      <p className="draft" lang={lang}>{state?.state === "changed" ? state.text : draft}</p>
      <p className="hint">English: {english}</p>
      {!editing && (
        <div className="row">
          {state?.state !== "approved" && <button className="btn small" onClick={() => onChange({ state: "approved", ...(note ? { note } : {}) })}>I would say it this way</button>}
          <button className="btn small quiet" onClick={() => { setText(state?.text || draft); setEditing(true); }}>{state?.state === "changed" ? "Edit my version" : "I would say it differently"}</button>
          {state && <button className="btn small quiet" onClick={() => onChange(null)}>Undo</button>}
          {state?.state === "approved" && <span className="eyebrow" style={{ color: "var(--good)" }}>approved</span>}
          {state?.state === "changed" && <span className="eyebrow" style={{ color: "var(--accent)" }}>your wording</span>}
        </div>
      )}
      {editing && (
        <div className="field">
          <textarea value={text} onChange={e => setText(e.target.value)} lang={lang} aria-label={`Your wording for ${id}`} />
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Why, in a few words (optional)" aria-label="Note" className="notein" />
          <div className="row">
            <button className="btn small primary" disabled={!text.trim()} onClick={() => { onChange({ state: "changed", text: text.trim(), ...(note ? { note } : {}) }); setEditing(false); }}>Use my wording</button>
            <button className="btn small quiet" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}
    </li>
  );
}
