import { Link, NavLink, useNavigate } from "react-router-dom";
import { clearAuth, getStoredUser, getToken } from "../utils/auth";

export default function SiteNav() {
  const navigate = useNavigate();
  const token = getToken();
  const user = getStoredUser();

  function logout() {
    clearAuth();
    navigate("/");
  }

  return (
    <header className="site-nav">
      <Link to="/" className="wordmark">
        digital<span>.HEROES</span>
      </Link>

      <nav>
        <NavLink to="/how-it-works">The draw</NavLink>
        <NavLink to="/charities">Charities</NavLink>
        <NavLink to="/subscribe">Membership</NavLink>
        {user?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
      </nav>

      <div className="nav-actions">
        {token ? (
          <>
            <Link to="/dashboard" className="btn btn-ghost">
              Dashboard
            </Link>
            <button type="button" className="btn btn-primary" onClick={logout}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost">
              Log in
            </Link>
            <Link to="/subscribe" className="btn btn-primary">
              Subscribe
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>digital.HEROES</p>
      <p>Score the round. Fund the cause. Enter the month.</p>
    </footer>
  );
}
