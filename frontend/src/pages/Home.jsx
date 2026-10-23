import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../api";
import SiteNav, { SiteFooter } from "../components/SiteNav";
import { formatMoney } from "../utils/format";

export default function Home() {
  const [charity, setCharity] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [charityResponse, planResponse] = await Promise.all([
          fetch(`${API_URL}/charities`),
          fetch(`${API_URL}/subscriptions/plans`),
        ]);
        const charityResult = await charityResponse.json();
        const planResult = await planResponse.json();

        if (cancelled) return;

        const featured = (charityResult.charities || []).find(
          (item) => item.is_featured
        );
        setCharity(featured || charityResult.charities?.[0] || null);
        setPlans(planResult.plans || []);
      } catch {
        if (!cancelled) setCharity(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <SiteNav />
      <main>
        <section className="hero">
          <p className="eyebrow">Membership · scores · a monthly draw</p>
          <h1>
            Your round can
            <em> carry someone else.</em>
          </h1>
          <p className="lede">
            Digital Heroes is a membership for people who keep a Stableford
            card. Part of every fee goes to a charity you choose. The rest
            fuels a monthly five-number draw — and a jackpot that waits if
            nobody hits it.
          </p>
          <div className="hero-actions">
            <Link to="/subscribe" className="btn btn-primary">
              Start a membership
            </Link>
            <Link to="/how-it-works" className="btn btn-ghost">
              See how the draw works
            </Link>
          </div>
        </section>

        <section className="band">
          <div className="section-heading">
            <p className="eyebrow">What you do</p>
            <h2>Four moves. Then the month takes care of the rest.</h2>
          </div>
          <div className="step-grid">
            <article>
              <span>01</span>
              <h3>Subscribe</h3>
              <p>
                Monthly, or yearly at a lower rate. Without an active
                membership, scoring and draw entry stay locked.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>Keep five scores</h3>
              <p>
                Enter a Stableford result from 1 to 45. One card per date.
                Only your latest five rounds stay on the record.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Name a cause</h3>
              <p>
                At least 10% of your fee is directed to a charity you pick.
                You can give more. You can also donate on the side.
              </p>
            </article>
            <article>
              <span>04</span>
              <h3>Pick five numbers</h3>
              <p>
                Each open month, choose five numbers from 1 to 45. Match
                three, four, or all five when the draw is published.
              </p>
            </article>
          </div>
        </section>

        <section className="band band-split">
          <div>
            <p className="eyebrow">How a prize is split</p>
            <h2>The pool is divided before anyone is named.</h2>
            <p className="lede">
              Half of each active membership feeds the prize pool, after your
              charity share is taken. That pool is then cut into three tiers.
              If several people land in the same tier, they split it evenly.
              An unclaimed five-number jackpot rolls into the next month.
            </p>
          </div>
          <div className="tier-list">
            <div>
              <strong>40%</strong>
              <span>Five numbers</span>
              <em>Rolls over if unclaimed</em>
            </div>
            <div>
              <strong>35%</strong>
              <span>Four numbers</span>
              <em>Paid out, or left unallocated</em>
            </div>
            <div>
              <strong>25%</strong>
              <span>Three numbers</span>
              <em>Paid out, or left unallocated</em>
            </div>
          </div>
        </section>

        <section className="band">
          <div className="section-heading">
            <p className="eyebrow">In the spotlight</p>
            <h2>The cause on the homepage this month.</h2>
          </div>
          {!loaded ? (
            <p>Loading the featured cause...</p>
          ) : charity ? (
            <article className="spotlight">
              {charity.image_url ? (
                <img src={charity.image_url} alt="" />
              ) : (
                <div className="spotlight-fallback" />
              )}
              <div>
                <p className="eyebrow">{charity.category || "Featured charity"}</p>
                <h3>{charity.name}</h3>
                <p>{charity.description}</p>
                <Link to={`/charities/${charity.id}`} className="btn btn-primary">
                  Read their story
                </Link>
              </div>
            </article>
          ) : (
            <p>Charity stories will appear here once the directory is live.</p>
          )}
        </section>

        <section className="band">
          <div className="section-heading">
            <p className="eyebrow">Membership</p>
            <h2>Pick a rhythm. The charity floor stays at 10%.</h2>
          </div>
          <div className="plan-grid">
            {plans.map((plan) => (
              <article key={plan.id} className="plan-card">
                <h3>{plan.name}</h3>
                <p className="plan-price">
                  {plan.amount != null
                    ? formatMoney(plan.amount, plan.currency)
                    : "Price set at checkout"}
                  {plan.interval ? <small> / {plan.interval}</small> : null}
                </p>
                <p>{plan.description}</p>
              </article>
            ))}
          </div>
          <Link to="/subscribe" className="btn btn-primary">
            Choose a plan
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
