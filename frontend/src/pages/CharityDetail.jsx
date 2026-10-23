import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_URL, authHeaders } from "../api";
import SiteNav, { SiteFooter } from "../components/SiteNav";
import { getToken } from "../utils/auth";
import { formatDate } from "../utils/format";

export default function CharityDetail() {
  const { id } = useParams();
  const [charity, setCharity] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("25");
  const [donating, setDonating] = useState(false);
  const [donationError, setDonationError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`${API_URL}/charities/${id}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Charity not found.");
        }

        if (!cancelled) {
          setCharity(result.charity);
          setEvents(result.events || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function donate(event) {
    event.preventDefault();
    setDonationError("");

    const token = getToken();

    if (!token) {
      setDonationError("Log in to make a donation.");
      return;
    }

    const value = Number(amount);

    if (!Number.isFinite(value) || value < 1) {
      setDonationError("Enter a donation of at least 1.");
      return;
    }

    setDonating(true);

    try {
      const response = await fetch(`${API_URL}/donations`, {
        method: "POST",
        headers: authHeaders(token, true),
        body: JSON.stringify({ charityId: id, amount: value }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to start the donation.");
      }

      window.location.href = result.checkoutUrl;
    } catch (err) {
      setDonationError(err.message);
      setDonating(false);
    }
  }

  return (
    <>
      <SiteNav />
      <main className="page">
        <Link to="/charities" className="back-link">
          ← All charities
        </Link>

        {error && <p className="form-error">{error}</p>}

        {charity && (
          <>
            <p className="eyebrow">{charity.category || "Charity"}</p>
            <h1>{charity.name}</h1>
            {charity.image_url && (
              <img className="detail-image" src={charity.image_url} alt="" />
            )}
            <p className="lede">{charity.description}</p>
            {charity.website_url && (
              <p>
                <a href={charity.website_url} target="_blank" rel="noreferrer">
                  Visit their website
                </a>
              </p>
            )}

            <section className="panel">
              <h2>Give on your own</h2>
              <p>
                This donation is separate from your membership and from the
                draw. It goes only to {charity.name}.
              </p>
              <form className="inline-form" onSubmit={donate}>
                <label htmlFor="amount">
                  Amount (USD)
                  <input
                    id="amount"
                    type="number"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </label>
                <button className="btn btn-primary" type="submit" disabled={donating}>
                  {donating ? "Opening checkout..." : "Donate"}
                </button>
              </form>
              {donationError && <p className="form-error">{donationError}</p>}
            </section>

            <section>
              <h2>Upcoming events</h2>
              {events.length === 0 ? (
                <p>No events listed yet.</p>
              ) : (
                <div className="step-grid">
                  {events.map((item) => (
                    <article key={item.id} className="panel">
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                      <p>{item.event_date ? formatDate(item.event_date) : "Date to be announced"}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
