import { Navigate, useLocation } from 'react-router-dom';
import { Bus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Gates the authenticated operator pages. While Firebase resolves the current
 * session we show a splash; unauthenticated users are bounced to /login.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f4f6fa] text-slate-400">
        <Bus className="w-10 h-10 animate-bounce mb-2 text-blue-500" />
        <p className="text-sm font-semibold">Checking your session…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
