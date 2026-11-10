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
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import nexLogo from '../../assets/nex-logo-blue.png';

const navItems = [
  { id: 'dashboard', label: 'Fleet Overview', icon: Map, path: '/dashboard' },
  { id: 'conductors', label: 'Manage Conductors', icon: Users, path: '/manage-conductors' },
  { id: 'bus', label: 'Manage Bus', icon: Bus, path: '/manage-bus' },
  { id: 'route', label: 'Manage Route', icon: RouteIcon, path: '/manage-route' },
  { id: 'feedback', label: 'Passenger Feedback', icon: MessageSquare, path: '/feedback' },
  { id: 'lost-items', label: 'Lost Item Reports', icon: FileText, path: '/lost-items' },
  { id: 'end-reports', label: 'End of Trip Reports', icon: BarChart3, path: '/end-reports' },
];

/**
 * Persistent app shell with mobile drawer & collapsible desktop sidebar.
 */
export default function AppShell() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile drawer state
  const [isCollapsed, setIsCollapsed] = useState(false);     // Desktop collapse state
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mainRef = useRef(null);

  // Scroll canvas to top and close mobile drawer on route change
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    setIsSidebarOpen(false);
  }, [pathname]);

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

      {/* MOBILE BACKDROP OVERLAY */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-[#edf1f7] border-r border-slate-200/70 p-4 flex flex-col justify-between select-none transition-all duration-300 ease-in-out md:static md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'md:w-20' : 'md:w-64'} w-64`}
      >
        <div>
          {/* Brand Logo Header & Collapse Toggle */}
          <div className={`flex items-center ${isCollapsed ? 'md:justify-center' : 'justify-between'} px-2 py-2 mb-6`}>
            {/* Full Logo (Visible when expanded) */}
            <div className={`items-center gap-2 ${isCollapsed ? 'md:hidden flex' : 'flex'}`}>
              <img
                src={nexLogo}
                alt="NEX Logo"
                className="h-9 w-auto object-contain"
              />
            </div>

            {/* Compact Logo Emblem (Visible only on Desktop when collapsed) */}
            {isCollapsed && (
              <div className="hidden md:flex w-9 h-9 rounded-xl bg-blue-600 text-white items-center justify-center font-black text-sm shadow-md shadow-blue-500/20 shrink-0">
                N
              </div>
            )}

            {/* Desktop Collapse Toggle Button */}
            <button
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="hidden md:flex p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors cursor-pointer"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label="Toggle sidebar collapse"
            >
              {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>

            {/* Mobile Close Button */}
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-200/60 md:hidden"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            {navItems.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                title={isCollapsed ? item.label : undefined}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) => `
                  w-full flex items-center gap-3 py-2.5 rounded-xl text-xs font-semibold transition-all
                  ${isCollapsed ? 'md:justify-center md:px-0 px-3.5' : 'px-3.5'}
                  ${isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }
                `}
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    <span className={`truncate ${isCollapsed ? 'md:hidden' : 'inline'}`}>
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Footer Links */}
        <div className="space-y-1.5">
          <NavLink
            to="/settings"
            title={isCollapsed ? 'Account Settings' : undefined}
            onClick={() => setIsSidebarOpen(false)}
            className={({ isActive }) => `
              w-full flex items-center gap-3 py-2.5 rounded-xl text-xs font-semibold transition-all
              ${isCollapsed ? 'md:justify-center md:px-0 px-3.5' : 'px-3.5'}
              ${isActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
              }
            `}
          >
            {({ isActive }) => (
              <>
                <Settings className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span className={`truncate ${isCollapsed ? 'md:hidden' : 'inline'}`}>
                  Account Settings
                </span>
              </>
            )}
          </NavLink>

          <button
            onClick={handleSignOut}
            title={isCollapsed ? 'Sign Out' : undefined}
            className={`w-full flex items-center gap-3 py-2.5 text-xs font-semibold text-slate-600 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors cursor-pointer ${
              isCollapsed ? 'md:justify-center md:px-0 px-3.5' : 'px-3.5'
            }`}
          >
            <LogOut className="w-4 h-4 text-slate-500 shrink-0" />
            <span className={`truncate ${isCollapsed ? 'md:hidden' : 'inline'}`}>
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT CANVAS */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* TOP HEADER */}
        <header className="h-16 px-4 md:px-8 flex items-center justify-between gap-5 bg-[#f4f6fa] relative z-20 border-b border-slate-200/50 md:border-b-0">
          
          {/* Hamburger Menu Toggle Button (Mobile only) */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-xl text-slate-600 hover:bg-slate-200/60 md:hidden flex items-center justify-center"
            aria-label="Open navigation menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Right Side Header Items */}
          <div className="flex items-center gap-5 ml-auto">
            <NotificationBell />

            <div className="flex items-center gap-3 pl-3 border-l border-slate-300/60">
              <div className="text-right">
                <p className="text-xs font-bold text-slate-900 leading-tight capitalize">{displayName}</p>
                <p className="text-[10px] text-slate-500 font-medium">{email || 'Operations Manager'}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold border border-slate-200 shadow-sm uppercase">
                {(displayName[0] || 'O')}
              </div>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main ref={mainRef} className="flex-1 p-4 md:p-8 pt-4 md:pt-6 flex flex-col gap-6">
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