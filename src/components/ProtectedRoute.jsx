import { Navigate, useLocation } from 'react-router-dom';
import { Bus, ShieldAlert, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Gates the authenticated operator pages. While Firebase resolves the current
 * session we show a splash; unauthenticated users are bounced to /login, and
 * signed-in accounts that aren't operators (e.g. a saved commuter session, or
 * a role that was changed) get an access-denied screen with a sign-out button.
 */
export default function ProtectedRoute({ children }) {
  const { user, isOperator, profileFailed, loading, signOut } = useAuth();
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

  // The profile couldn't be read (offline, a rules problem) — that says
  // nothing about the account, so offer a retry instead of "no access".
  if (!isOperator && profileFailed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6fa] p-6">
        <div className="max-w-sm w-full bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <WifiOff className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-950">Couldn’t load your account</h1>
          <p className="text-sm text-slate-500 mt-1">
            Signed in as {user.email}, but your operator profile couldn’t be loaded. Check your
            internet connection and try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full text-xs font-semibold text-white px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/30 cursor-pointer"
          >
            Try again
          </button>
          <button
            onClick={() => signOut()}
            className="mt-2 w-full text-xs font-semibold text-slate-600 px-5 py-2.5 hover:bg-slate-50 rounded-xl cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (!isOperator) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6fa] p-6">
        <div className="max-w-sm w-full bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-950">No operator access</h1>
          <p className="text-sm text-slate-500 mt-1">
            This account can’t use the NEX Operator dashboard. Sign in with an operator account.
          </p>
          {/* which account was restored — e.g. a conductor saved by the bus simulator */}
          <p className="text-xs text-slate-400 mt-3 break-all">Signed in as {user.email}</p>
          <button
            onClick={() => signOut()}
            className="mt-6 w-full text-xs font-semibold text-white px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/30 cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return children;
}
