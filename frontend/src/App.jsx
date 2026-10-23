import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import HowItWorks from "./pages/HowItWorks";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Subscribe from "./pages/Subscribe";
import Dashboard from "./pages/Dashboard";
import Charities from "./pages/Charities";
import CharityDetail from "./pages/CharityDetail";
import ProtectedRoute from "./ProtectedRoute";
import AdminRoute from "./components/AdminShell";
import AdminCharities from "./pages/AdminCharities";
import AdminUsers from "./pages/AdminUsers";
import AdminDraws from "./pages/AdminDraws";
import AdminWinners from "./pages/AdminWinners";
import AdminReports from "./pages/AdminReports";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/subscribe" element={<Subscribe />} />
        <Route path="/charities" element={<Charities />} />
        <Route path="/charities/:id" element={<CharityDetail />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<Navigate to="/admin/reports" replace />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/draws" element={<AdminDraws />} />
          <Route path="/admin/charities" element={<AdminCharities />} />
          <Route path="/admin/winners" element={<AdminWinners />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
