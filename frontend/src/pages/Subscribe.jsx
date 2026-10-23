import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL, authHeaders } from "../api";
import SiteNav, { SiteFooter } from "../components/SiteNav";
import { getToken } from "../utils/auth";
import { formatMoney } from "../utils/format";

export default function Subscribe() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState("");
  const [pendingPlan, setPendingPlan] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/subscriptions/plans`)
      .then((response) => response.json())
      .then((result) => setPlans(result.plans || []))
      .catch(() => setError("Membership prices could not be loaded."));
  }, []);

  async function startCheckout(plan) {
    const token = getToken();

    if (!token) {
      navigate("/signup");
      return;
    }

    setError("");
    setPendingPlan(plan);

    try {
      const response = await fetch(`${API_URL}/checkout/create-session`, {
        method: "POST",
        headers: authHeaders(token, true),
        body: JSON.stringify({ plan }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to start checkout.");
      }

      window.location.href = result.checkoutUrl;
    } catch (err) {
      setError(err.message || "Unable to start checkout.");
      setPendingPlan("");
    }
  }

  return (
    <>
      <SiteNav />
      <main className="page">
        <p className="eyebrow">Subscribe</p>
        <h1>Join, then point your fee at a cause.</h1>
        <p className="lede">
          Checkout is handled by Stripe. You can cancel before the next
          renewal and keep access until the period you already paid for ends.
          At least 10% of the fee goes to the charity on your account.
        </p>

        {error && <p className="form-error">{error}</p>}

        <div className="plan-grid">
          {plans.map((plan) => (
            <article key={plan.id} className="plan-card">
              <h2>{plan.name}</h2>
              <p className="plan-price">
                {plan.amount != null
                  ? formatMoney(plan.amount, plan.currency)
                  : "See checkout"}
                {plan.interval ? <small> / {plan.interval}</small> : null}
              </p>
              <p>{plan.description}</p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={pendingPlan === plan.id}
                onClick={() => startCheckout(plan.id)}
              >
                {pendingPlan === plan.id ? "Opening checkout..." : `Choose ${plan.name}`}
              </button>
            </article>
          ))}
        </div>

        {!getToken() && (
          <p className="hint">
            New here? <Link to="/signup">Create an account</Link> first — you’ll
            choose a charity as you sign up. Already registered?{" "}
            <Link to="/login">Log in</Link>.
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
