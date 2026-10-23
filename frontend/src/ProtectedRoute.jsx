
import { Navigate, Outlet } from "react-router-dom";
import { getToken } from "./utils/auth";

function ProtectedRoute() {
  const token = getToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
