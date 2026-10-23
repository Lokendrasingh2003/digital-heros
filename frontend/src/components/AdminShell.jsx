import { NavLink, Navigate, Outlet } from "react-router-dom";
import { getStoredUser, getToken } from "../utils/auth";
import SiteNav from "./SiteNav";

export default function AdminRoute() {
  const token = getToken();
  const user = getStoredUser();

  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;

  return (
    <>
      <SiteNav />
      <div className="admin-shell">
        <aside className="admin-side">
          <p className="eyebrow">Control room</p>
          <NavLink to="/admin/reports">Reports</NavLink>
          <NavLink to="/admin/users">Users</NavLink>
          <NavLink to="/admin/draws">Draws</NavLink>
          <NavLink to="/admin/charities">Charities</NavLink>
          <NavLink to="/admin/winners">Winners</NavLink>
        </aside>
        <div className="admin-main">
          <Outlet />
        </div>
      </div>
    </>
  );
}
