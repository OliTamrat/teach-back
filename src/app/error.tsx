"use client";

/** The screen's own failure page: says what to do, never a stack trace to a clinic. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="wrap" style={{ paddingTop: 40 }}>
      <section className="panel" style={{ maxWidth: 560 }}>
        <h2>Something went wrong on this screen</h2>
        <p className="hint">Nothing was sent to a patient and nothing in the session log was changed. Reload, or go back to the last turn.</p>
        <div className="row"><button className="btn primary" onClick={reset}>Try again</button></div>
      </section>
    </main>
  );
}
