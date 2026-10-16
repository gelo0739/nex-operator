import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bus,
  Users,
  Route as RouteIcon,
  MessageSquare,
  FileText,
  BarChart3,
  Settings,
  Map,
  LogOut,
  Loader2,
  BellRing,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const navItems = [
  { id: 'dashboard', label: 'Fleet Overview', icon: Map, path: '/dashboard' },
  { id: 'conductors', label: 'Manage Conductors', icon: Users, path: '/manage-conductors' },
  { id: 'bus', label: 'Manage Bus', icon: Bus, path: '/manage-bus' },
  { id: 'route', label: 'Manage Route', icon: RouteIcon, path: '/manage-route' },
  { id: 'feedback', label: 'Passenger Feedback', icon: MessageSquare, path: '/feedback' },
  { id: 'lost-items', label: 'Lost Item Reports', icon: FileText, path: '/lost-items' },
  { id: 'end-reports', label: 'End of Trip Reports', icon: BarChart3, path: '/end-reports' },
];

// Web push needs a VAPID key (Firebase console → Cloud Messaging → Web Push
// certificates) and a browser with service workers + notifications.
const PUSH_CONFIGURED =
  Boolean(import.meta.env.VITE_PUBLIC_FIREBASE_VAPID_KEY) &&
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'Notification' in window;

const navLinkClass =({ isActive }) => `
  w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all
  ${isActive
    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
  }
`;

/**
 * The persistent app shell for every operator page: sidebar, top header (with
 * the notification bell) and the scrollable page canvas. It's a layout route
 * (see App.jsx), so it stays mounted while you navigate — only the page inside
 * <Outlet/> changes. Pages render their title + body through <MainLayout>.
 */
export default function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mainRef = useRef(null);

  // The canvas is shared between pages: start each page at the top.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // Web push ("bus marked inoperable"). Already allowed → register quietly;
  // not decided yet → offer an "Enable alerts" button (browsers only allow the
  // permission prompt from a click). pushServices is loaded on demand.
  const uid = user?.uid;
  const [showEnableAlerts, setShowEnableAlerts] = useState(false);
  useEffect(() => {
    if (!uid || !PUSH_CONFIGURED) return undefined;
    let cancelled = false;
    const permission = Notification.permission;
    if (permission === 'granted') {
      import('../utils/pushServices')
        .then(({ enableWebPush }) => enableWebPush(uid))
        .catch((error) => console.warn('Push registration failed:', error));
    } else if (permission === 'default') {
      Promise.resolve().then(() => !cancelled && setShowEnableAlerts(true));
    }
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const handleEnableAlerts = async () => {
    try {
      const { enableWebPush } = await import('../utils/pushServices');
      const result = await enableWebPush(uid, { prompt: true });
      if (result !== 'default') setShowEnableAlerts(false);
    } catch (error) {
      console.warn('Push registration failed:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const email = user?.email || '';
  const displayName =
    user?.displayName ||
    (email ? email.split('@')[0].replace(/[._-]/g, ' ') : 'Operator');

  return (
    <div className="flex h-screen bg-[#f4f6fa] text-slate-800 font-sans overflow-hidden">

      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-[#edf1f7] border-r border-slate-200/70 p-5 flex flex-col justify-between select-none">
        <div>
          {/* Brand Logo Header */}
          <h1 className="text-xl font-bold text-blue-900 tracking-tight px-3 py-2 mb-6">
            NEX Dashboard
          </h1>

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            {navItems.map((item) => (
              <NavLink key={item.id} to={item.path} className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <item.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Footer Links */}
        <div className="space-y-1.5">
          <NavLink to="/settings" className={navLinkClass}>
            {({ isActive }) => (
              <>
                <Settings className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                Account Settings
              </>
            )}
          </NavLink>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT CANVAS */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* TOP HEADER */}
        <header className="h-16 px-8 flex items-center justify-end gap-5 bg-[#f4f6fa] relative z-20">

          {/* Push alerts for buses marked inoperable — until allowed or blocked */}
          {showEnableAlerts && (
            <button
              type="button"
              onClick={handleEnableAlerts}
              title="Get a browser notification when a conductor marks a bus inoperable"
              className="flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5" />
              Enable alerts
            </button>
          )}

          {/* Notification Bell — live count of new passenger feedback */}
          <NotificationBell />

          {/* User Profile */}
          <div className="flex items-center gap-3 pl-3 border-l border-slate-300/60">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-900 leading-tight capitalize">{displayName}</p>
              <p className="text-[10px] text-slate-500 font-medium">{email || 'Operations Manager'}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold border border-slate-200 shadow-sm uppercase">
              {(displayName[0] || 'O')}
            </div>
          </div>
        </header>

        {/* PAGE CONTENT — pages are lazy-loaded, so show a spinner while one loads */}
        <main ref={mainRef} className="flex-1 p-8 pt-6 flex flex-col gap-6 overflow-y-auto">
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
