import { lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/AppShell";
import OperatorLogin from "./(operator)/OperatorLogin";

// Pages are code-split: each loads (with its own dependencies — Google Maps,
// drag-and-drop, …) only when first opened. <AppShell> shows a spinner meanwhile.
const Dashboard = lazy(() => import("./(operator)/Dashboard"));
const ManageConductors = lazy(() => import("./(operator)/ManageConductors"));
const ManageBus = lazy(() => import("./(operator)/ManageBus"));
const ManageRoute = lazy(() => import("./(operator)/ManageRoute"));
const ConfigureRoute = lazy(() => import("./(operator)/ConfigureRoute"));
const PassengerFeedback = lazy(() => import("./(operator)/PassengerFeedback"));
const LostItemReports = lazy(() => import("./(operator)/LostItemReports"));
const EndOfTripReports = lazy(() => import("./(operator)/EndOfTripReports"));
const AccountSettings = lazy(() => import("./(operator)/AccountSettings"));

const protectedRoutes = [
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/manage-conductors", element: <ManageConductors /> },
  { path: "/manage-bus", element: <ManageBus /> },
  { path: "/manage-route", element: <ManageRoute /> },
  // Not in the sidebar; opened from Manage Route (Add New Route / pencil).
  { path: "/manage-route/new", element: <ConfigureRoute /> },
  { path: "/manage-route/:routeId/edit", element: <ConfigureRoute /> },
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
          {/* Every operator page shares one persistent shell (sidebar + header). */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            {protectedRoutes.map(({ path, element }) => (
              <Route key={path} path={path} element={element} />
            ))}
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
