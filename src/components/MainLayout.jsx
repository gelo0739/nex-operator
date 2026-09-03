import { NavLink, useNavigate } from 'react-router-dom';
import {
  Bus,
  Users,
  Route as RouteIcon,
  MessageSquare,
  FileText,
  BarChart3,
  Settings,
  Bell,
  Map,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { id: 'dashboard', label: 'Fleet Overview', icon: Map, path: '/dashboard' },
  { id: 'conductors', label: 'Manage Conductors', icon: Users, path: '/manage-conductors' },
  { id: 'bus', label: 'Manage Bus', icon: Bus, path: '/manage-bus' },
  { id: 'route', label: 'Manage Route', icon: RouteIcon, path: '/manage-route' },
  { id: 'feedback', label: 'Passenger Feedback', icon: MessageSquare, path: '/feedback' },
  { id: 'lost-items', label: 'Lost Item Reports', icon: FileText, path: '/lost-items' },
  { id: 'end-reports', label: 'End of Trip Reports', icon: BarChart3, path: '/end-reports' },
];

const navLinkClass = ({ isActive }) => `
  w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all
  ${isActive
    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
  }
`;

export default function MainLayout({ children, pageTitle, pageSubtitle }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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

          {/* Notification Bell */}
          <div className="relative">
            <button className="p-2 text-slate-600 hover:bg-slate-200/60 rounded-full relative transition-colors cursor-pointer">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
          </div>

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

        {/* PAGE CONTENT */}
        <main className="flex-1 p-8 pt-6 flex flex-col gap-6 overflow-y-auto">
          {/* Page Title Header */}
          {pageTitle && (
            <div className="mb-2">
              <h2 className="text-2xl font-bold text-slate-950 tracking-tight">{pageTitle}</h2>
              {pageSubtitle && <p className="text-sm text-slate-600 mt-1">{pageSubtitle}</p>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
