import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { API_URL, authHeaders } from "../api";
import SiteNav from "../components/SiteNav";
import { clearAuth, getToken } from "../utils/auth";
import {
  formatDate,
  formatMoney,
  formatMonth,
  formatStatus,
  todayInputValue,
} from "../utils/format";

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = getToken();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [scores, setScores] = useState([]);
  const [charities, setCharities] = useState([]);
  const [entries, setEntries] = useState([]);
  const [openDraws, setOpenDraws] = useState([]);
  const [winnings, setWinnings] = useState([]);
  const [totalWon, setTotalWon] = useState(0);
  const [donations, setDonations] = useState([]);
  const [plans, setPlans] = useState([]);

  const [fullName, setFullName] = useState("");
  const [scoreDate, setScoreDate] = useState(todayInputValue);
  const [stablefordScore, setStablefordScore] = useState("");
  const [editingScoreId, setEditingScoreId] = useState("");
  const [selectedCharityId, setSelectedCharityId] = useState("");
  const [contributionPercent, setContributionPercent] = useState(10);
  const [picked, setPicked] = useState([]);
  const [selectedDrawId, setSelectedDrawId] = useState("");
  const [donationAmount, setDonationAmount] = useState("25");

  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      setNotice("Payment received. Your membership updates as soon as Stripe confirms it.");
    } else if (searchParams.get("checkout") === "cancelled") {
      setNotice("Checkout was cancelled. Your membership is unchanged.");
    } else if (searchParams.get("donation") === "success") {
      setNotice("Thank you. The donation is confirmed once Stripe reports it.");
    } else if (searchParams.get("donation") === "cancelled") {
      setNotice("The donation was cancelled.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    let cancelled = false;

    async function load() {
      const headers = authHeaders(token);

      try {
        const [
          profileResponse,
          subscriptionResponse,
          scoresResponse,
          entriesResponse,
          winningsResponse,
          donationsResponse,
          charitiesResponse,
          drawsResponse,
          plansResponse,
        ] = await Promise.all([
          fetch(`${API_URL}/users/me`, { headers }),
          fetch(`${API_URL}/subscriptions/me`, { headers }),
          fetch(`${API_URL}/scores`, { headers }),
          fetch(`${API_URL}/draw-entries/me`, { headers }),
          fetch(`${API_URL}/winnings/me`, { headers }),
          fetch(`${API_URL}/donations/me`, { headers }),
          fetch(`${API_URL}/charities`),
          fetch(`${API_URL}/draws`),
          fetch(`${API_URL}/subscriptions/plans`),
        ]);

        if (profileResponse.status === 401) {
          clearAuth();
          navigate("/login", { replace: true });
          return;
        }

        const profile = await profileResponse.json();
        const subscriptionResult = await subscriptionResponse.json();
        const scoresResult = await scoresResponse.json();
        const entriesResult = await entriesResponse.json();
        const winningsResult = await winningsResponse.json();
        const donationsResult = await donationsResponse.json();
        const charitiesResult = await charitiesResponse.json();
        const drawsResult = await drawsResponse.json();
        const plansResult = await plansResponse.json();

        if (!profileResponse.ok) {
          throw new Error(profile.message || "Unable to load your profile.");
        }

        if (cancelled) return;

        localStorage.setItem("dh_user", JSON.stringify(profile.user));
        setUser(profile.user);
        setFullName(profile.user.full_name || "");
        setSelectedCharityId(profile.user.selected_charity_id || "");
        setContributionPercent(Number(profile.user.charity_contribution_percent ?? 10));
        setSubscription(subscriptionResponse.ok ? subscriptionResult.subscription : null);
        setScores(scoresResponse.ok ? scoresResult.scores || [] : []);
        setEntries(entriesResponse.ok ? entriesResult.entries || [] : []);
        setWinnings(winningsResponse.ok ? winningsResult.winnings || [] : []);
        setTotalWon(winningsResponse.ok ? winningsResult.totalWon || 0 : 0);
        setDonations(donationsResponse.ok ? donationsResult.donations || [] : []);
        setCharities(charitiesResult.charities || []);
        setOpenDraws(drawsResult.open || []);
        setPlans(plansResult.plans || []);
        setSelectedDrawId(drawsResult.open?.[0]?.id || "");
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load the dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [navigate, token]);

  function subscriptionActive() {
    if (!subscription || subscription.status !== "active") return false;
    if (!subscription.current_period_end) return false;
    return new Date(subscription.current_period_end).getTime() > Date.now();
  }

  async function send(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: authHeaders(token, Boolean(options.body)),
    });
    const result = await response.json();

    if (response.status === 401) {
      clearAuth();
      navigate("/login", { replace: true });
      throw new Error("Your session expired.");
    }

    if (!response.ok) {
      throw new Error(result.message || "Request failed.");
    }

    return result;
  }

  async function saveProfile(event) {
    event.preventDefault();
    setFormError("");
    setBusy("profile");

    try {
      const result = await send("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ fullName }),
      });
      setUser(result.user);
      localStorage.setItem("dh_user", JSON.stringify(result.user));
      setNotice("Profile saved.");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function saveScore(event) {
    event.preventDefault();
    setFormError("");

    const score = Number(stablefordScore);

    if (!Number.isInteger(score) || score < 1 || score > 45) {
      setFormError("Enter a whole Stableford score from 1 to 45.");
      return;
    }

    setBusy("score");

    try {
      const result = await send(editingScoreId ? `/scores/${editingScoreId}` : "/scores", {
        method: editingScoreId ? "PATCH" : "POST",
        body: JSON.stringify({ scoreDate, stablefordScore: score }),
      });
      setScores(result.scores || []);
      setStablefordScore("");
      setEditingScoreId("");
      setScoreDate(todayInputValue());
      setNotice(result.message);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function deleteScore(id) {
    setFormError("");
    setBusy(`delete-${id}`);

    try {
      const result = await send(`/scores/${id}`, { method: "DELETE" });
      setScores(result.scores || []);
      if (editingScoreId === id) setEditingScoreId("");
      setNotice("Score deleted.");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function saveCharity(event) {
    event.preventDefault();
    setFormError("");
    setBusy("charity");

    try {
      const result = await send("/charities/selection", {
        method: "PATCH",
        body: JSON.stringify({
          charityId: selectedCharityId,
          contributionPercent: Number(contributionPercent),
        }),
      });
      setUser((current) => ({ ...current, ...result.user }));
      setNotice(result.message);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function checkout(plan) {
    setFormError("");
    setBusy(plan);

    try {
      const result = await send("/checkout/create-session", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      window.location.href = result.checkoutUrl;
    } catch (err) {
      setFormError(err.message);
      setBusy("");
    }
  }

  async function cancelMembership() {
    setFormError("");
    setBusy("cancel");

    try {
      const result = await send("/subscriptions/cancel", { method: "POST" });
      setSubscription((current) =>
        current ? { ...current, cancel_at_period_end: true } : current
      );
      setNotice(result.message);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy("");
    }
  }

  function toggleNumber(number) {
    setPicked((current) => {
      if (current.includes(number)) return current.filter((item) => item !== number);
      if (current.length >= 5) return current;
      return [...current, number].sort((a, b) => a - b);
    });
  }

  async function enterDraw(event) {
    event.preventDefault();
    setFormError("");

    if (picked.length !== 5) {
      setFormError("Choose exactly five numbers.");
      return;
    }

    setBusy("draw");

    try {
      const result = await send("/draw-entries", {
        method: "POST",
        body: JSON.stringify({
          drawId: selectedDrawId,
          selectedNumbers: picked,
        }),
      });
      const draw = openDraws.find((item) => item.id === selectedDrawId);
      setEntries((current) => [
        {
          ...result.entry,
          draws: {
            draw_month: draw?.draw_month,
            status: "draft",
            drawn_numbers: null,
          },
        },
        ...current,
      ]);
      setPicked([]);
      setNotice(result.message);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function donate(event) {
    event.preventDefault();
    setFormError("");
    setBusy("donate");

    try {
      const result = await send("/donations", {
        method: "POST",
        body: JSON.stringify({
          charityId: selectedCharityId,
          amount: Number(donationAmount),
        }),
      });
      window.location.href = result.checkoutUrl;
    } catch (err) {
      setFormError(err.message);
      setBusy("");
    }
  }

  async function submitProof(winningId, proofUrl) {
    setFormError("");
    setBusy(`proof-${winningId}`);

    try {
      const result = await send(`/winnings/${winningId}/proof`, {
        method: "POST",
        body: JSON.stringify({ proofUrl }),
      });
      setWinnings((current) =>
        current.map((item) =>
          item.id === winningId ? { ...item, ...result.winning } : item
        )
      );
      setNotice(result.message);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return (
      <>
        <SiteNav />
        <main className="page">Loading your dashboard...</main>
      </>
    );
  }

  if (error || !user) {
    return (
      <>
        <SiteNav />
        <main className="page">
          <h1>Dashboard unavailable</h1>
          <p>{error || "Sign in again to continue."}</p>
        </main>
      </>
    );
  }

  const active = subscriptionActive();

  return (
    <>
      <SiteNav />
      <main className="page">
        <p className="eyebrow">Your membership</p>
        <h1>{user.full_name}</h1>
        <p className="lede">{user.email}</p>

        {notice && <p className="form-success">{notice}</p>}
        {formError && <p className="form-error">{formError}</p>}

        <section className="dashboard-grid">
          <article className="panel">
            <h2>Subscription</h2>
            {subscription ? (
              <>
                <p>Plan: {formatStatus(subscription.plan)}</p>
                <p>
                  Status: <strong>{formatStatus(subscription.status)}</strong>
                </p>
                <p>
                  {subscription.cancel_at_period_end ? "Access until " : "Renews "}
                  {formatDate(subscription.current_period_end)}
                </p>
                {subscription.amount != null && (
                  <p>{formatMoney(subscription.amount, subscription.currency)}</p>
                )}
                {active && !subscription.cancel_at_period_end && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy === "cancel"}
                    onClick={cancelMembership}
                  >
                    Cancel at period end
                  </button>
                )}
              </>
            ) : (
              <p>You don’t have a membership yet. Scoring and draw entry stay locked until you do.</p>
            )}

            {!active && (
              <div className="stack">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className="btn btn-primary"
                    disabled={busy === plan.id}
                    onClick={() => checkout(plan.id)}
                  >
                    {plan.name}
                    {plan.amount != null
                      ? ` · ${formatMoney(plan.amount, plan.currency)}`
                      : ""}
                  </button>
                ))}
              </div>
            )}
          </article>

          <article className="panel">
            <h2>Profile</h2>
            <form onSubmit={saveProfile} className="stack">
              <label htmlFor="fullName">
                Name
                <input
                  id="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  minLength={2}
                  maxLength={100}
                  required
                />
              </label>
              <button className="btn btn-primary" disabled={busy === "profile"}>
                Save name
              </button>
            </form>
          </article>

          <article className="panel panel-wide">
            <h2>Scores</h2>
            <p>
              One Stableford score per date, from 1 to 45. A new date replaces
              the oldest once you pass five rounds. An existing date can only
              be edited or deleted.
            </p>
            {!active && (
              <p className="hint">
                An active membership is required to add or change scores.{" "}
                <Link to="/subscribe">Subscribe</Link>
              </p>
            )}
            <form onSubmit={saveScore} className="inline-form">
              <label htmlFor="scoreDate">
                Date
                <input
                  id="scoreDate"
                  type="date"
                  max={todayInputValue()}
                  value={scoreDate}
                  onChange={(event) => setScoreDate(event.target.value)}
                  required
                />
              </label>
              <label htmlFor="stablefordScore">
                Score
                <input
                  id="stablefordScore"
                  type="number"
                  min="1"
                  max="45"
                  step="1"
                  value={stablefordScore}
                  onChange={(event) => setStablefordScore(event.target.value)}
                  required
                />
              </label>
              <button className="btn btn-primary" disabled={busy === "score" || !active}>
                {editingScoreId ? "Update score" : "Save score"}
              </button>
              {editingScoreId && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setEditingScoreId("");
                    setStablefordScore("");
                  }}
                >
                  Cancel edit
                </button>
              )}
            </form>
            {scores.length === 0 ? (
              <p>No scores yet.</p>
            ) : (
              <ul className="clean-list">
                {scores.map((score) => (
                  <li key={score.id}>
                    <strong>{score.stableford_score}</strong>
                    <span> · {formatDate(score.score_date)}</span>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setEditingScoreId(score.id);
                        setScoreDate(score.score_date);
                        setStablefordScore(String(score.stableford_score));
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy === `delete-${score.id}`}
                      onClick={() => deleteScore(score.id)}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="panel">
            <h2>Charity</h2>
            <form onSubmit={saveCharity} className="stack">
              <label htmlFor="charitySelect">
                Cause
                <select
                  id="charitySelect"
                  value={selectedCharityId}
                  onChange={(event) => setSelectedCharityId(event.target.value)}
                  required
                >
                  <option value="">Select a charity</option>
                  {charities.map((charity) => (
                    <option key={charity.id} value={charity.id}>
                      {charity.name}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="contributionPercent">
                Share of your membership ({contributionPercent}%)
                <input
                  id="contributionPercent"
                  type="range"
                  min="10"
                  max="100"
                  value={contributionPercent}
                  onChange={(event) => setContributionPercent(event.target.value)}
                />
              </label>
              <button className="btn btn-primary" disabled={busy === "charity"}>
                Save charity
              </button>
            </form>
            <form onSubmit={donate} className="stack" style={{ marginTop: 18 }}>
              <h3>Independent donation</h3>
              <label htmlFor="donationAmount">
                Amount in USD, not tied to the draw
                <input
                  id="donationAmount"
                  type="number"
                  min="1"
                  step="1"
                  value={donationAmount}
                  onChange={(event) => setDonationAmount(event.target.value)}
                />
              </label>
              <button className="btn btn-ghost" disabled={busy === "donate" || !selectedCharityId}>
                Donate
              </button>
            </form>
            {donations.length > 0 && (
              <ul className="clean-list">
                {donations.map((donation) => (
                  <li key={donation.id}>
                    {formatMoney(donation.amount, donation.currency)} ·{" "}
                    {donation.charities?.name || "Charity"} ·{" "}
                    {formatStatus(donation.payment_status)}
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="panel">
            <h2>This month’s draw</h2>
            <p>
              You have entered {entries.length}{" "}
              {entries.length === 1 ? "draw" : "draws"}.
            </p>
            {openDraws.length === 0 ? (
              <p>No draw is open for entries right now.</p>
            ) : (
              <form onSubmit={enterDraw} className="stack">
                <label htmlFor="drawSelect">
                  Open draw
                  <select
                    id="drawSelect"
                    value={selectedDrawId}
                    onChange={(event) => setSelectedDrawId(event.target.value)}
                  >
                    {openDraws.map((draw) => (
                      <option key={draw.id} value={draw.id}>
                        {formatMonth(draw.draw_month)} · {formatStatus(draw.draw_method)}
                      </option>
                    ))}
                  </select>
                </label>
                <p>{picked.length} of 5 selected</p>
                <div className="number-grid">
                  {Array.from({ length: 45 }, (_, index) => index + 1).map((number) => (
                    <button
                      key={number}
                      type="button"
                      className={picked.includes(number) ? "num selected" : "num"}
                      onClick={() => toggleNumber(number)}
                    >
                      {number}
                    </button>
                  ))}
                </div>
                <button className="btn btn-primary" disabled={busy === "draw" || !active}>
                  Enter draw
                </button>
                {!active && <p className="hint">An active membership is required to enter.</p>}
              </form>
            )}
            {entries.map((entry) => {
              const drawn = entry.draws?.drawn_numbers;
              const selected = entry.selected_numbers || [];
              const matches = Array.isArray(drawn)
                ? selected.filter((number) => drawn.includes(number)).length
                : null;

              return (
                <div key={entry.id} className="entry-row">
                  <strong>{formatMonth(entry.draws?.draw_month)}</strong>
                  <p>Your numbers: {selected.join(", ")}</p>
                  <p>Status: {formatStatus(entry.draws?.status)}</p>
                  {matches === null ? (
                    <p>Results are not published yet.</p>
                  ) : (
                    <p>
                      Drawn: {drawn.join(", ")} · Matches: {matches}
                    </p>
                  )}
                </div>
              );
            })}
          </article>

          <article className="panel panel-wide">
            <h2>Winnings</h2>
            <p>
              Total awarded: <strong>{formatMoney(totalWon)}</strong>
            </p>
            {winnings.length === 0 ? (
              <p>No prizes yet. They appear here after a draw is published.</p>
            ) : (
              winnings.map((winning) => (
                <WinningRow
                  key={winning.id}
                  winning={winning}
                  busy={busy === `proof-${winning.id}`}
                  onSubmit={submitProof}
                />
              ))
            )}
          </article>
        </section>
      </main>
    </>
  );
}

function WinningRow({ winning, busy, onSubmit }) {
  const [proofUrl, setProofUrl] = useState(winning.proof_url || "");
  const canUpload =
    winning.payout_status !== "paid" && winning.verification_status !== "approved";

  return (
    <div className="entry-row">
      <strong>
        {formatMonth(winning.draws?.draw_month)} · {winning.match_tier}-number match
      </strong>
      <p>
        Prize {formatMoney(winning.prize_amount)} · Verification{" "}
        {formatStatus(winning.verification_status)} · Payment{" "}
        {formatStatus(winning.payout_status)}
      </p>
      {canUpload ? (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(winning.id, proofUrl);
          }}
        >
          <label>
            Screenshot URL
            <input
              type="url"
              value={proofUrl}
              placeholder="https://..."
              onChange={(event) => setProofUrl(event.target.value)}
              required
            />
          </label>
          <button className="btn btn-ghost" disabled={busy}>
            {winning.proof_url ? "Replace proof" : "Submit proof"}
          </button>
        </form>
      ) : (
        winning.proof_url && (
          <a href={winning.proof_url} target="_blank" rel="noreferrer">
            View submitted proof
          </a>
        )
      )}
    </div>
  );
}
