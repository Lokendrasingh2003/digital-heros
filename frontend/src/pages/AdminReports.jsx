import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "../api";
import { getToken } from "../utils/auth";
import { formatMoney } from "../utils/format";

export default function AdminReports() {
  const token = getToken();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/admin/reports`, { headers: authHeaders(token) })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Unable to load reports.");
        setReport(result.report);
      })
      .catch((err) => setError(err.message));
  }, [token]);

  if (error) return <p className="form-error">{error}</p>;
  if (!report) return <p>Loading reports...</p>;

  return (
    <section>
      <h1>Reports</h1>
      <p className="lede">Live counts from members, draws, and charity gifts.</p>
      <div className="stat-grid">
        <article className="panel">
          <span>Members</span>
          <strong>{report.totalUsers}</strong>
        </article>
        <article className="panel">
          <span>Active subscriptions</span>
          <strong>{report.activeSubscriptions}</strong>
          <p>
            {report.plans.monthly} monthly · {report.plans.yearly} yearly
          </p>
        </article>
        <article className="panel">
          <span>Published prize pools</span>
          <strong>{formatMoney(report.totalPrizePool)}</strong>
        </article>
        <article className="panel">
          <span>Charity total</span>
          <strong>{formatMoney(report.charityTotal)}</strong>
        </article>
      </div>

      <div className="stat-grid" style={{ marginTop: 16 }}>
        <article className="panel">
          <span>Draws</span>
          <p>
            {report.draws.draft} draft · {report.draws.simulated} simulated ·{" "}
            {report.draws.published} published
          </p>
        </article>
        <article className="panel">
          <span>Winners</span>
          <p>
            {report.winners.total} total · {report.winners.pending} pending ·{" "}
            {report.winners.approved} approved · {report.winners.paid} paid
          </p>
        </article>
      </div>

      <h2>Charity contributions</h2>
      {report.charityContributions.length === 0 ? (
        <p>No charity money recorded yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Charity</th>
              <th>From memberships</th>
              <th>From donations</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {report.charityContributions.map((row) => (
              <tr key={row.charityId}>
                <td>{row.name}</td>
                <td>{formatMoney(row.fromSubscriptions)}</td>
                <td>{formatMoney(row.fromDonations)}</td>
                <td>{formatMoney(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
