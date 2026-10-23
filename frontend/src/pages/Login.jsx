
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL } from "../api";
import SiteNav from "../components/SiteNav";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Login failed.");
      }

      localStorage.setItem("dh_token", result.token);
      localStorage.setItem("dh_user", JSON.stringify(result.user));

      navigate(result.user?.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
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

        <h1>Welcome back</h1>
        <p>Log in to your Digital Heroes account.</p>

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          <button
            type="submit"
            className="auth-button"
            disabled={submitting}
          >
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </main>
    </>
  );
}

export default Login;
