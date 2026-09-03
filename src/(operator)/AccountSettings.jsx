import { useNavigate } from 'react-router-dom';
import { Mail, ShieldCheck, LogOut } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';

export default function AccountSettings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const rows = [
    { icon: Mail, label: 'Email Address', value: user?.email || '—' },
    { icon: ShieldCheck, label: 'Account Status', value: user ? 'Active' : 'Signed out' },
  ];

  return (
    <MainLayout pageTitle="Account Settings" pageSubtitle="Your operator account details.">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 max-w-2xl">
        <div className="divide-y divide-slate-100">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-4 py-4 first:pt-0">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-semibold text-slate-950">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500 mt-4">
          Accounts are managed by the NEX team in the Firebase console. Contact an administrator
          to update your credentials or access.
        </p>

        <button
          onClick={handleSignOut}
          className="mt-6 flex items-center gap-2 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 text-xs font-semibold px-5 py-2.5 rounded-xl border border-slate-200 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </MainLayout>
  );
}
