import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import OperatorLogin from "./(operator)/OperatorLogin";
import Dashboard from "./(operator)/Dashboard";
import ManageConductors from "./(operator)/ManageConductors";
import ManageBus from "./(operator)/ManageBus";
import ManageRoute from "./(operator)/ManageRoute";
import PassengerFeedback from "./(operator)/PassengerFeedback";
import LostItemReports from "./(operator)/LostItemReports";
import EndOfTripReports from "./(operator)/EndOfTripReports";
import AccountSettings from "./(operator)/AccountSettings";

const protectedRoutes = [
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/manage-conductors", element: <ManageConductors /> },
  { path: "/manage-bus", element: <ManageBus /> },
  { path: "/manage-route", element: <ManageRoute /> },
  { path: "/feedback", element: <PassengerFeedback /> },
  { path: "/lost-items", element: <LostItemReports /> },
  { path: "/end-reports", element: <EndOfTripReports /> },
  { path: "/settings", element: <AccountSettings /> },
];

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<OperatorLogin />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          {protectedRoutes.map(({ path, element }) => (
            <Route
              key={path}
              path={path}
              element={<ProtectedRoute>{element}</ProtectedRoute>}
            />
          ))}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
