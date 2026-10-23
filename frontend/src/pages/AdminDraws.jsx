import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "../api";
import { getToken } from "../utils/auth";
import { formatMoney, formatMonth, formatStatus } from "../utils/format";

export default function AdminDraws() {
  const token = getToken();
  const [draws, setDraws] = useState([]);
  const [drawMonth, setDrawMonth] = useState("");
  const [drawMethod, setDrawMethod] = useState("random");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const response = await fetch(`${API_URL}/admin/draws`, {
      headers: authHeaders(token),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Unable to load draws.");
    setDraws(result.draws || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [token]);

  async function createDraw(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy("create");

    try {
      const response = await fetch(`${API_URL}/admin/draws`, {
        method: "POST",
        headers: authHeaders(token, true),
        body: JSON.stringify({ drawMonth, drawMethod }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setMessage(result.message);
      setDrawMonth("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function act(id, action) {
    setError("");
    setMessage("");
    setBusy(`${action}-${id}`);

    try {
      const response = await fetch(`${API_URL}/admin/draws/${id}/${action}`, {
        method: "POST",
        headers: authHeaders(token),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setMessage(result.message);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section>
      <h1>Draws</h1>
      <p className="lede">
        Open a month, simulate the five numbers, then publish. Publishing is
        what creates winners.
      </p>
      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-success">{message}</p>}

      <form className="inline-form panel" onSubmit={createDraw}>
        <label>
          Month
          <input
            type="month"
            value={drawMonth}
            onChange={(event) => setDrawMonth(event.target.value)}
            required
          />
        </label>
        <label>
          Method
          <select value={drawMethod} onChange={(event) => setDrawMethod(event.target.value)}>
            <option value="random">Random</option>
            <option value="weighted">Weighted by score frequency</option>
          </select>
        </label>
        <button className="btn btn-primary" disabled={busy === "create"}>
          Create draft
        </button>
      </form>

      <div className="stack" style={{ marginTop: 20 }}>
        {draws.map((draw) => (
          <article key={draw.id} className="panel">
            <h2>
              {formatMonth(draw.draw_month)} · {formatStatus(draw.draw_method)}
            </h2>
            <p>
              Status: <strong>{formatStatus(draw.status)}</strong>
              {" · "}
              Eligible subscribers: {draw.eligible_subscriber_count}
              {" · "}
              Pool: {formatMoney(draw.total_prize_pool)}
            </p>
            <p>
              Rollover in {formatMoney(draw.jackpot_rollover_in)} · out{" "}
              {formatMoney(draw.jackpot_rollover_out)}
            </p>
            {Array.isArray(draw.drawn_numbers) && draw.drawn_numbers.length > 0 && (
              <p>Numbers: {draw.drawn_numbers.join(", ")}</p>
            )}
            <div className="hero-actions">
              {["draft", "simulated"].includes(draw.status) && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy === `simulate-${draw.id}`}
                  onClick={() => act(draw.id, "simulate")}
                >
                  Simulate
                </button>
              )}
              {draw.status === "simulated" && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy === `publish-${draw.id}`}
                  onClick={() => act(draw.id, "publish")}
                >
                  Publish
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
