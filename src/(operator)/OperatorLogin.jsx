import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Bus, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function OperatorLogin() {
  const { user, isOperator, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from?.pathname || '/dashboard';

  // Already signed in as an operator — skip the form.
  if (!loading && user && isOperator) return <Navigate to={redirectTo} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email.trim(), password, rememberMe);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      // Don't disclose whether the email exists.
      const code = err?.code || '';
      setError(
        code === 'auth/too-many-requests'
          ? 'Too many attempts. Please wait a moment and try again.'
          : 'Invalid credentials. Check your email and password.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center bg-slate-200/60 font-sans overflow-hidden">
      {/* Background Image Overlay with Motion Blur Style */}
      <div
        className="absolute inset-0 bg-cover bg-center filter grayscale opacity-25"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1570125909232-eb263c188f7e?q=80&w=2070&auto=format&fit=crop')`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-200/80 via-slate-100/60 to-transparent" />

      {/* Top Left NEX Logo Header */}
      <div className="absolute top-8 left-8 z-10 flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Bus className="w-8 h-8 text-blue-700 -rotate-6" />
          <span className="text-3xl font-black text-blue-900 tracking-tighter italic">NEX</span>
        </div>
      </div>

      {/* Center Operator Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-3xl shadow-2xl shadow-slate-400/50 border border-slate-100 p-8">
        {/* Bus Icon Badge */}
        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
          <Bus className="w-7 h-7 text-white" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-slate-900 text-center mb-8 tracking-tight">
          Operator Login
        </h1>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 text-xs font-medium rounded-xl px-3.5 py-3">
              <AlertCircle className="w-4 h-4 mt-px shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Email Address Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@nextransit.com"
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-10 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password Row */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              Remember Me
            </label>
            <a
              href="#forgot"
              onClick={(e) => e.preventDefault()}
              className="text-blue-600 font-semibold hover:underline"
            >
              Forgot Password?
            </a>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>{submitting ? 'Signing In…' : 'Sign In'}</span>
            {!submitting && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-7">
          <div className="border-t border-slate-200 w-full" />
          <span className="absolute bg-white px-3 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
            Internal Personnel
          </span>
        </div>

        {/* Footer Notice */}
        <p className="text-center text-xs font-medium text-slate-400">
          Authorized Personnel Only.
        </p>
      </div>
    </div>
  );
}
