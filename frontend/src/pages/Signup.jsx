
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL } from "../api";
import SiteNav from "../components/SiteNav";

function Signup() {
  const navigate = useNavigate();

  const [charities, setCharities] = useState([]);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    selectedCharityId: "",
  });

  const [loadingCharities, setLoadingCharities] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function fetchCharities() {
      try {
        const response = await fetch(`${API_URL}/auth/charities`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Could not load charities.");
        }

        setCharities(result.charities || []);
      } catch (err) {
        setError(err.message || "Could not connect to the server.");
      } finally {
        setLoadingCharities(false);
      }
    }

    fetchCharities();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          selectedCharityId: form.selectedCharityId || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.errors?.map((item) => item.message).join(", ") ||
          result.message ||
          "Signup failed."
        );
      }

      // Temporary local session; we'll add login and protected
      // routes in the next step.
      localStorage.setItem("dh_token", result.token);
      localStorage.setItem("dh_user", JSON.stringify(result.user));

      setMessage("Account created successfully!");
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.message || "Unable to create your account. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
    <SiteNav />
    <main className="auth-page">
      <div className="auth-card">
        <Link to="/" className="back-link">
          ← Back to home
        </Link>

        <h1>Become a Digital Hero</h1>
        <p>Join the community and support a cause you care about.</p>

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="form-success">
            {message}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <label htmlFor="fullName">Full name</label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            value={form.fullName}
            onChange={handleChange}
            placeholder="Your full name"
            minLength={2}
            maxLength={100}
            autoComplete="name"
            required
          />

          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="At least 8 characters"
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            required
          />

          <label htmlFor="selectedCharityId">Charity you want to support</label>
          <select
            id="selectedCharityId"
            name="selectedCharityId"
            value={form.selectedCharityId}
            onChange={handleChange}
            disabled={loadingCharities || charities.length === 0}
            required
          >
            <option value="">
              {loadingCharities
                ? "Loading charities..."
                : charities.length === 0
                  ? "No charities available yet"
                  : "Choose a charity"}
            </option>

            {charities.map((charity) => (
              <option key={charity.id} value={charity.id}>
                {charity.name}
                {charity.category ? ` — ${charity.category}` : ""}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="auth-button"
            disabled={submitting || loadingCharities}
          >
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="auth-footer">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </div>
    </main>
    </>
  );
}

export default Signup;
