import Link from "next/link";
import latest from "../../../eval/latest.json";
import visitsFile from "../../../eval/visits.json";
import type { EvalSummary } from "@/core/eval";

export const metadata = { title: "Teach-Back results" };

/**
 * The measured results, inside the product, from eval/latest.json and nothing else. Until audio
 * cases have run through the live pipeline, the page says so in its first line; a judge never
 * sees a number here that a run did not produce. `npm run eval` writes the file; this page is
 * rebuilt with it.
 */
type Latest = { ranAt: string; files: string[]; summary: EvalSummary; visits: Array<{ id: string; take: string; mode: "text" | "audio"; rolesRight: number; rolesTotal: number; plantedCaught: number; plantedTotal: number; falseAlarms: number; skipped: string | null }> };
const visitCount = new Set((visitsFile as { visits: Array<{ id: string }> }).visits.map(v => v.id)).size;
const plantedKinds = [...new Set((visitsFile as { visits: Array<{ turns: Array<{ planted?: { errors: Array<{ type: string }> } }> }> }).visits.flatMap(v => v.turns.flatMap(t => (t.planted?.errors ?? []).map(e => e.type.replace("_", " ")))))];
const data = latest as unknown as Latest;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const LANG: Record<string, string> = { am: "Amharic", om: "Afaan Oromo" };

export default function ResultsPage() {
  const s = data.summary;
  const audio = s.byLanguage.filter(l => l.meanCer !== null);
  const audioRan = audio.length > 0;
  const visitsRan = (s.visits?.audio.takes ?? 0) > 0;
  const agg = visitsRan ? s.visits!.audio : s.visits?.text;
  return (
    <>
      <header className="wrap top">
        <div className="brand"><h1>Teach-Back</h1><span>measured results</span><Link className="btn small quiet" href="/">Back to the screen</Link></div>
        <span className="hint">Run {data.ranAt.slice(0, 16).replace("T", " ")} UTC · {data.files.join(", ")}</span>
      </header>
      <main className="wrap">
        <div className="notice">
          Every number on this page comes from one run of <span className="mono">npm run eval</span> over the files in <span className="mono">eval/</span>, which anyone can repeat. Nothing here is typed in.
        </div>

        <section className="panel">
          <h2>{audioRan ? "Real recordings through the live pipeline" : "No recordings have run yet"}</h2>
          {!audioRan && <p className="hint">The {s.skipped} audio cases are skipped until the Oct 31 recordings exist and a server with the services configured is up. The table below is the deterministic core on {s.cases} text cases: it tests the code, and says nothing about the models.</p>}
          <table className="results">
            <thead><tr><th>Measure</th>{audioRan ? <><th>Amharic</th><th>Afaan Oromo</th></> : <th>Value</th>}</tr></thead>
            <tbody>
              {audioRan ? (
                <>
                  <tr><td>Clips</td>{(["am", "om"] as const).map(l => <td key={l}>{audio.find(x => x.language === l)?.cases ?? 0}</td>)}</tr>
                  <tr><td>Transcript character error rate (Omnilingual ASR)</td>{(["am", "om"] as const).map(l => { const x = audio.find(y => y.language === l); return <td key={l}>{x ? pct(x.meanCer as number) : "n/a"}</td>; })}</tr>
                  <tr><td>Critical facts that survived to the English</td>{(["am", "om"] as const).map(l => { const x = audio.find(y => y.language === l); return <td key={l}>{x ? pct(x.factRecall) : "n/a"}</td>; })}</tr>
                  <tr><td>Wrong-language items caught</td>{(["am", "om"] as const).map(l => { const x = audio.find(y => y.language === l); return <td key={l}>{x ? `${x.expectedCaught} of ${x.expectedTotal}` : "n/a"}</td>; })}</tr>
                </>
              ) : (
                <>
                  <tr><td>Critical facts found in the English (recall)</td><td>{pct(s.factRecall)}</td></tr>
                  <tr><td>Extracted facts that were real (precision)</td><td>{pct(s.factPrecision)}</td></tr>
                  <tr><td>Planted errors flagged</td><td>{s.plantedCaught} of {s.plantedTotal}</td></tr>
                  <tr><td>False alarms</td><td>{s.falseAlarms}</td></tr>
                </>
              )}
            </tbody>
          </table>
          {s.speakers ? <p className="hint">{s.speakers} speakers, scripted sentences read by consenting volunteers. No patient was recorded.</p> : null}
        </section>

        <section className="panel">
          <h2>The interpreter checked both ways</h2>
          <p className="hint">{visitCount} scripted visit{visitCount === 1 ? "" : "s"}, each with a take in which the interpreter gets a {plantedKinds.join(", a ")} wrong on purpose. {visitsRan ? "The figures are the audio takes, clips through the live pipeline." : "The figures are the text takes: the core on the script's own English, not the models. The audio takes are listed as skipped."}</p>
          {agg && (
            <div className="status">
              <span>roles right <b>{agg.rolesRight} of {agg.rolesTotal}</b></span>
              <span>planted interpreter errors flagged <b>{agg.plantedCaught} of {agg.plantedTotal}</b></span>
              <span>false alarms on faithful lines <b>{agg.falseAlarms}</b></span>
            </div>
          )}
          <table className="results">
            <thead><tr><th>Visit</th><th>Take</th><th>Mode</th><th>Roles</th><th>Planted</th><th>False alarms</th><th>Note</th></tr></thead>
            <tbody>
              {data.visits.map((v, i) => (
                <tr key={i} data-skipped={v.skipped ? "" : undefined}>
                  <td>{v.id}</td><td>{v.take}</td><td>{v.mode}</td>
                  {v.skipped ? <td colSpan={4} className="hint">{v.skipped}</td> : <><td>{v.rolesRight}/{v.rolesTotal}</td><td>{v.plantedCaught}/{v.plantedTotal}</td><td>{v.falseAlarms}</td><td /></>}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>What these numbers are not</h2>
          <p className="hint">They are not a claim that machine interpreting is safe. They say how often this checker caught the errors it was built to catch, on scripted sentences read by volunteers, with a person deciding every flag. The full report, case by case, is <span className="mono">eval/latest.md</span> in the repository.</p>
        </section>
      </main>
      <footer className="wrap">Teach-Back is a hackathon prototype. It is not a medical device, does not give medical advice, and does not replace a qualified interpreter.</footer>
    </>
  );
}
