import { Link } from "react-router-dom";
import SiteNav, { SiteFooter } from "../components/SiteNav";

export default function HowItWorks() {
  return (
    <>
      <SiteNav />
      <main className="page">
        <p className="eyebrow">Draw mechanics</p>
        <h1>Five numbers. Three ways to land in the money.</h1>
        <p className="lede">
          Once a month, Digital Heroes draws five numbers between 1 and 45.
          You enter by choosing five of your own while the draw is still a
          draft. After an admin simulates and publishes it, the numbers are
          public and entries are closed.
        </p>

        <section className="prose-grid">
          <article className="panel">
            <h2>Random</h2>
            <p>
              Every number from 1 to 45 has an equal chance. This is the
              standard lottery-style draw.
            </p>
          </article>
          <article className="panel">
            <h2>Weighted by scores</h2>
            <p>
              Numbers that show up more often as Stableford scores are more
              likely to be drawn. A number nobody has scored still keeps a
              small chance, so it is never impossible.
            </p>
          </article>
          <article className="panel">
            <h2>Before it is real</h2>
            <p>
              Admins run a simulation first. Publishing is a separate step.
              Nothing is official, and no winner is created, until the draw
              is published.
            </p>
          </article>
        </section>

        <section className="panel" style={{ marginTop: 28 }}>
          <h2>What a match means</h2>
          <ul className="clean-list">
            <li>Match all 5 of your numbers — 40% of that month’s pool. If nobody does, this share rolls forward as the jackpot.</li>
            <li>Match 4 — 35% of the pool, split across everyone in that tier.</li>
            <li>Match 3 — the remaining 25%.</li>
            <li>Fewer than 3 matches pays nothing.</li>
          </ul>
          <p>
            Winners upload a screenshot of their scores. An admin approves or
            rejects it, then marks the prize paid. Payment moves from pending
            to paid — it does not happen automatically.
          </p>
          <Link to="/subscribe" className="btn btn-primary">
            Get a number in the next draw
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
