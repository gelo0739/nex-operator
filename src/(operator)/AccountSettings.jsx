import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LogOut, Mail, Route as RouteIcon, ShieldCheck, UserRound } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import { MIN_PASSWORD_LENGTH, changeOwnPassword } from '../utils/accountServices';

const EMPTY_FORM = { current: '', next: '', confirm: '' };

const inputClass =
  'w-full h-10 rounded-xl border border-slate-200 bg-white pl-3 pr-10 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

function PasswordInput({ id, label, value, onChange, autoComplete, visible, onToggle }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={inputClass}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </label>
  );
}

// Client-side checks before touching Firebase; returns an error message or null.
function validate({ current, next, confirm }) {
  if (!current || !next || !confirm) return 'Fill in all three fields.';
  if (next.length < MIN_PASSWORD_LENGTH) return `The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (next === current) return 'The new password must be different from your current one.';
  if (next !== confirm) return 'The new passwords don’t match.';
  return null;
}

export default function AccountSettings() {
  const { user, profile, busLine, signOut } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const update = (field) => (value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    const problem = validate(form);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await changeOwnPassword(form.current, form.next);
      setForm(EMPTY_FORM);
      setShowPasswords(false);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    { icon: UserRound, label: 'Name', value: profile?.name || user?.displayName || user?.email?.split('@')[0] || '—' },
    { icon: Mail, label: 'Email Address', value: user?.email || '—' },
    { icon: RouteIcon, label: 'Bus Line', value: busLine || '—' },
    { icon: ShieldCheck, label: 'Role', value: profile?.role === 'operator' ? 'Operator' : profile?.role || '—' },
  ];

  return (
    <MainLayout pageTitle="Account Settings" pageSubtitle="Your operator account details and password.">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start max-w-5xl">
        {/* ACCOUNT */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-base font-bold text-slate-950 mb-4">Account</h3>
          <div className="divide-y divide-slate-100">
            {rows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-4 py-4 first:pt-0">
                <div className="w-10 h-10 shrink-0 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-semibold text-slate-950 truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500 mt-4">
            Your bus line decides which routes, buses, conductors and reports you see. It’s assigned by the NEX
            team — contact an administrator to change it.
          </p>

          <button
            onClick={handleSignOut}
            className="mt-6 flex items-center gap-2 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 text-xs font-semibold px-5 py-2.5 rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        {/* PASSWORD */}
        <form onSubmit={handleChangePassword} className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col gap-4" noValidate>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-950">Change Password</h3>
              <p className="text-xs text-slate-500">Other devices signed in to this account will be signed out.</p>
            </div>
          </div>

          {/* Lets password managers attach the new password to the right account. */}
          <input type="email" name="username" autoComplete="username" value={user?.email ?? ''} readOnly hidden />

          <PasswordInput
            id="current-password"
            label="Current Password"
            value={form.current}
            onChange={update('current')}
            autoComplete="current-password"
            visible={showPasswords}
            onToggle={() => setShowPasswords((v) => !v)}
          />
          <PasswordInput
            id="new-password"
            label="New Password"
            value={form.next}
            onChange={update('next')}
            autoComplete="new-password"
            visible={showPasswords}
            onToggle={() => setShowPasswords((v) => !v)}
          />
          <PasswordInput
            id="confirm-password"
            label="Confirm New Password"
            value={form.confirm}
            onChange={update('confirm')}
            autoComplete="new-password"
            visible={showPasswords}
            onToggle={() => setShowPasswords((v) => !v)}
          />
          <p className="-mt-2 text-[11px] text-slate-400">At least {MIN_PASSWORD_LENGTH} characters.</p>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 text-red-700 text-xs font-medium px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-medium px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Password changed. Use your new password next time you sign in.
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="self-start flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {saving ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </MainLayout>
  );
}
