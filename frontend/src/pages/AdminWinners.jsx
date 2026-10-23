import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "../api";
import { getToken } from "../utils/auth";
import { formatMoney, formatMonth, formatStatus } from "../utils/format";

export default function AdminWinners() {
  const token = getToken();
  const [winners, setWinners] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch(`${API_URL}/admin/winners`, {
      headers: authHeaders(token),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Unable to load winners.");
    setWinners(result.winners || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [token]);

  async function review(id, body) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/admin/winners/${id}`, {
        method: "PATCH",
        headers: authHeaders(token, true),
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setMessage(result.message);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section>
      <h1>Winners</h1>
      <p className="lede">Approve the score screenshot, then mark the prize paid.</p>
      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-success">{message}</p>}

      {winners.length === 0 && <p>No winners yet. Publish a draw to create them.</p>}

      <div className="stack">
        {winners.map((winner) => (
          <article key={winner.id} className="panel">
            <h2>
              {winner.users?.full_name || "Member"} · {winner.match_tier}-number match
            </h2>
            <p>{winner.users?.email}</p>
            <p>
              {formatMonth(winner.draws?.draw_month)} · {formatMoney(winner.prize_amount)}
            </p>
            <p>
              Verification {formatStatus(winner.verification_status)} · Payment{" "}
              {formatStatus(winner.payout_status)}
            </p>
            {winner.proof_url ? (
              <p>
                <a href={winner.proof_url} target="_blank" rel="noreferrer">
                  Open proof
                </a>
              </p>
            ) : (
              <p>Waiting for a screenshot.</p>
            )}
            <div className="hero-actions">
              {winner.proof_url && winner.verification_status !== "approved" && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => review(winner.id, { verificationStatus: "approved" })}
                >
                  Approve
                </button>
              )}
              {winner.proof_url && winner.verification_status === "pending" && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => review(winner.id, { verificationStatus: "rejected" })}
                >
                  Reject
                </button>
              )}
              {winner.verification_status === "approved" &&
                winner.payout_status !== "paid" && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => review(winner.id, { payoutStatus: "paid" })}
                  >
                    Mark paid
                  </button>
                )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
