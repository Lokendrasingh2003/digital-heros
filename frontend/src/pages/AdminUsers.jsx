import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "../api";
import { getToken } from "../utils/auth";
import { formatDate, formatMoney, formatStatus, todayInputValue } from "../utils/format";

export default function AdminUsers() {
  const token = getToken();
  const [users, setUsers] = useState([]);
  const [charities, setCharities] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [scores, setScores] = useState([]);
  const [form, setForm] = useState(null);
  const [scoreDate, setScoreDate] = useState(todayInputValue);
  const [stablefordScore, setStablefordScore] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selected = users.find((user) => user.id === selectedId) || null;

  async function loadUsers() {
    const response = await fetch(`${API_URL}/admin/users`, {
      headers: authHeaders(token),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Unable to load users.");
    setUsers(result.users || []);
    return result.users || [];
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [userList, charityResponse] = await Promise.all([
          loadUsers(),
          fetch(`${API_URL}/admin/charities`, { headers: authHeaders(token) }),
        ]);
        const charityResult = await charityResponse.json();
        if (cancelled) return;
        setCharities(charityResult.charities || []);
        if (userList[0]) setSelectedId(userList[0].id);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!selected) return;

    setForm({
      fullName: selected.full_name,
      role: selected.role,
      selectedCharityId: selected.selected_charity_id || "",
      charityContributionPercent: Number(selected.charity_contribution_percent ?? 10),
    });

    fetch(`${API_URL}/admin/users/${selected.id}/scores`, {
      headers: authHeaders(token),
    })
      .then((response) => response.json())
      .then((result) => setScores(result.scores || []))
      .catch(() => setScores([]));
  }, [selectedId, token]);

  async function saveProfile(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/admin/users/${selectedId}`, {
        method: "PATCH",
        headers: authHeaders(token, true),
        body: JSON.stringify({
          fullName: form.fullName,
          role: form.role,
          selectedCharityId: form.selectedCharityId || null,
          charityContributionPercent: Number(form.charityContributionPercent),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setMessage("User updated.");
      await loadUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveScore(event) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch(`${API_URL}/admin/users/${selectedId}/scores`, {
        method: "POST",
        headers: authHeaders(token, true),
        body: JSON.stringify({
          scoreDate,
          stablefordScore: Number(stablefordScore),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setScores(result.scores || []);
      setStablefordScore("");
      setMessage("Score saved.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteScore(scoreId) {
    const response = await fetch(
      `${API_URL}/admin/users/${selectedId}/scores/${scoreId}`,
      { method: "DELETE", headers: authHeaders(token) }
    );
    const result = await response.json();
    if (!response.ok) {
      setError(result.message);
      return;
    }
    setScores(result.scores || []);
  }

  async function cancelSubscription() {
    const response = await fetch(
      `${API_URL}/admin/users/${selectedId}/cancel-subscription`,
      { method: "POST", headers: authHeaders(token) }
    );
    const result = await response.json();
    if (!response.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message);
    await loadUsers();
  }

  return (
    <section>
      <h1>Users</h1>
      <p className="lede">Profiles, scores, and subscription renewal.</p>
      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-success">{message}</p>}

      <div className="admin-split">
        <ul className="user-list">
          {users.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className={user.id === selectedId ? "selected" : ""}
                onClick={() => setSelectedId(user.id)}
              >
                <strong>{user.full_name}</strong>
                <span>{user.email}</span>
                <span>
                  {formatStatus(user.subscription?.status || "no subscription")}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {selected && form && (
          <div className="panel">
            <form onSubmit={saveProfile} className="stack">
              <label>
                Name
                <input
                  value={form.fullName}
                  onChange={(event) =>
                    setForm({ ...form, fullName: event.target.value })
                  }
                />
              </label>
              <label>
                Role
                <select
                  value={form.role}
                  onChange={(event) => setForm({ ...form, role: event.target.value })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label>
                Charity
                <select
                  value={form.selectedCharityId}
                  onChange={(event) =>
                    setForm({ ...form, selectedCharityId: event.target.value })
                  }
                >
                  <option value="">None</option>
                  {charities.map((charity) => (
                    <option key={charity.id} value={charity.id}>
                      {charity.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Charity percent
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={form.charityContributionPercent}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      charityContributionPercent: event.target.value,
                    })
                  }
                />
              </label>
              <button className="btn btn-primary" type="submit">
                Save profile
              </button>
            </form>

            <div className="entry-row">
              <h3>Subscription</h3>
              {selected.subscription ? (
                <>
                  <p>
                    {formatStatus(selected.subscription.plan)} ·{" "}
                    {formatStatus(selected.subscription.status)} ·{" "}
                    {formatMoney(
                      selected.subscription.amount,
                      selected.subscription.currency
                    )}
                  </p>
                  <p>
                    Period ends {formatDate(selected.subscription.current_period_end)}
                    {selected.subscription.cancel_at_period_end
                      ? " · cancellation scheduled"
                      : ""}
                  </p>
                  {!selected.subscription.cancel_at_period_end && (
                    <button type="button" className="btn btn-ghost" onClick={cancelSubscription}>
                      Cancel at period end
                    </button>
                  )}
                </>
              ) : (
                <p>No subscription on file.</p>
              )}
            </div>

            <h3>Scores</h3>
            <form onSubmit={saveScore} className="inline-form">
              <input
                type="date"
                value={scoreDate}
                max={todayInputValue()}
                onChange={(event) => setScoreDate(event.target.value)}
                required
              />
              <input
                type="number"
                min="1"
                max="45"
                value={stablefordScore}
                onChange={(event) => setStablefordScore(event.target.value)}
                placeholder="1–45"
                required
              />
              <button className="btn btn-primary" type="submit">
                Save score
              </button>
            </form>
            <ul className="clean-list">
              {scores.map((score) => (
                <li key={score.id}>
                  {score.stableford_score} · {formatDate(score.score_date)}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => deleteScore(score.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
