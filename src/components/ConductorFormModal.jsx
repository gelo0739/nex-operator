import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  Trash2,
  UserPlus,
  UserRound,
} from 'lucide-react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import {
  CONDUCTOR_EMAIL_DOMAIN,
  createConductor,
  deleteConductor,
  generateTempPassword,
  resetConductorPassword,
  updateConductor,
} from '../utils/conductorServices';

const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

const primaryButton =
  'flex items-center justify-center gap-2 text-xs font-semibold text-white px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-lg shadow-blue-600/30 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';
const secondaryButton =
  'text-xs font-semibold text-slate-700 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';

function Label({ children }) {
  return <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{children}</span>;
}

function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-xs font-medium text-red-700">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
      {children}
    </div>
  );
}

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the value is still selectable on screen.
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-1.5 py-1.5">
        <code className="flex-1 min-w-0 truncate text-sm font-semibold text-slate-900 select-all">{value}</code>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 px-2.5 py-1.5 hover:bg-blue-50 rounded-lg cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

/** Temporary password input with show/hide and regenerate. */
function TempPasswordField({ value, onChange, disabled }) {
  const [visible, setVisible] = useState(true);
  return (
    <label className="flex flex-col gap-1.5">
      <Label>Temporary Password</Label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          autoComplete="new-password"
          className={`${inputClass} pr-20 font-mono`}
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex">
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
          >
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => onChange(generateTempPassword())}
            disabled={disabled}
            aria-label="Generate a new password"
            title="Generate a new password"
            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
      <span className="text-[11px] text-slate-500">The conductor must change this when they first log in.</span>
    </label>
  );
}

/**
 * Add / edit a conductor.
 * - add:  name + username (@nex.com) + temporary password → creates the login.
 * - edit: rename, reset password, or delete.
 * After creating or resetting, shows the credentials to hand to the conductor.
 */
export default function ConductorFormModal({ mode, conductor, activeAssignment, onClose }) {
  const isEdit = mode === 'edit';

  // form | reset | delete | credentials
  const [view, setView] = useState('form');
  const [name, setName] = useState(conductor?.name ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(generateTempPassword);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [credentials, setCredentials] = useState(null); // { email, password }

  const run = async (action) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = 'Full name is required.';
    if (!isEdit && !USERNAME_PATTERN.test(username)) {
      next.username = '3–30 characters: lowercase letters, numbers, dots, dashes or underscores.';
    }
    if (view !== 'form' || !isEdit) {
      if (password.length < 8) next.password = 'At least 8 characters.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate()) return;
    if (isEdit) {
      run(async () => {
        await updateConductor(conductor.id, { name });
        onClose();
      });
    } else {
      run(async () => {
        const result = await createConductor({ name: name.trim(), username, password });
        setCredentials({ email: result.email, password });
        setView('credentials');
      });
    }
  };

  const handleReset = () => {
    if (password.length < 8) {
      setErrors({ password: 'At least 8 characters.' });
      return;
    }
    run(async () => {
      await resetConductorPassword(conductor.id, password);
      setCredentials({ email: conductor.email, password });
      setView('credentials');
    });
  };

  const close = busy ? () => {} : onClose;

  // ---- delete confirmation -------------------------------------------------
  if (view === 'delete') {
    return (
      <ConfirmDialog
        title={`Delete ${conductor.name || conductor.email}?`}
        message={
          busy
            ? 'Deleting…'
            : actionError
              ? actionError
              : activeAssignment
                ? `They're currently active on Bus ${activeAssignment.busId}. Deleting removes their login immediately and can't be undone.`
                : 'This removes their login and profile. This action cannot be undone.'
        }
        confirmLabel={busy ? 'Deleting…' : 'Delete Conductor'}
        onConfirm={busy ? () => {} : () => run(async () => {
          await deleteConductor(conductor.id);
          onClose();
        })}
        onCancel={busy ? () => {} : () => {
          setActionError(null);
          setView('form');
        }}
      />
    );
  }

  // ---- credentials panel ---------------------------------------------------
  if (view === 'credentials') {
    return (
      <Modal
        icon={KeyRound}
        iconClassName="bg-emerald-50 text-emerald-600"
        title={isEdit ? 'Password reset' : 'Conductor account created'}
        subtitle="Give these login details to the conductor."
        onClose={onClose}
      >
        <div className="flex flex-col gap-4 p-6">
          <CopyField label="Email" value={credentials.email} />
          <CopyField label="Temporary Password" value={credentials.password} />
          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
            This password is shown only once. The conductor will be asked to set a new password when they first log in
            to the NEX app.
          </p>
        </div>
        <div className="flex justify-end px-6 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className={primaryButton}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  // ---- reset password ------------------------------------------------------
  if (view === 'reset') {
    return (
      <Modal
        icon={KeyRound}
        title="Reset password"
        subtitle={`Set a new temporary password for ${conductor.name || conductor.email}.`}
        onClose={close}
      >
        <div className="flex flex-col gap-4 p-6">
          <TempPasswordField value={password} onChange={setPassword} disabled={busy} />
          {errors.password && <span className="-mt-2 text-xs text-red-600">{errors.password}</span>}
          <p className="text-xs text-slate-500">They'll be signed out of the NEX app on every device.</p>
          <ErrorNote>{actionError}</ErrorNote>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button type="button" onClick={() => setView('form')} disabled={busy} className={secondaryButton}>
            Back
          </button>
          <button type="button" onClick={handleReset} disabled={busy} className={primaryButton}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Reset Password
          </button>
        </div>
      </Modal>
    );
  }

  // ---- add / edit form -----------------------------------------------------
  return (
    <Modal
      icon={isEdit ? UserRound : UserPlus}
      title={isEdit ? 'Edit Conductor' : 'Add New Conductor'}
      subtitle={isEdit ? conductor.email : `Creates a login ending in @${CONDUCTOR_EMAIL_DOMAIN}.`}
      onClose={close}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-4 p-6">
          <label className="flex flex-col gap-1.5">
            <Label>Full Name</Label>
            <input
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="e.g. Juan Dela Cruz"
              maxLength={80}
              autoFocus
              disabled={busy}
              className={`${inputClass} ${errors.name ? 'border-red-300' : ''}`}
            />
            {errors.name && <span className="text-xs text-red-600">{errors.name}</span>}
          </label>

          {isEdit ? (
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <p className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-500">
                {conductor.email}
              </p>
            </div>
          ) : (
            <label className="flex flex-col gap-1.5">
              <Label>Username</Label>
              <div
                className={`flex items-center rounded-xl border bg-slate-50 overflow-hidden focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 ${
                  errors.username ? 'border-red-300' : 'border-slate-200'
                }`}
              >
                <input
                  type="text"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value.toLowerCase().replace(/\s+/g, ''));
                    setErrors((prev) => ({ ...prev, username: undefined }));
                  }}
                  placeholder="juan.delacruz"
                  maxLength={30}
                  disabled={busy}
                  autoComplete="off"
                  className="flex-1 min-w-0 bg-transparent px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                />
                <span className="px-3 py-2.5 text-sm font-medium text-slate-500 bg-slate-100 border-l border-slate-200">
                  @{CONDUCTOR_EMAIL_DOMAIN}
                </span>
              </div>
              {errors.username && <span className="text-xs text-red-600">{errors.username}</span>}
            </label>
          )}

          {!isEdit && (
            <>
              <TempPasswordField value={password} onChange={setPassword} disabled={busy} />
              {errors.password && <span className="-mt-2 text-xs text-red-600">{errors.password}</span>}
            </>
          )}

          {isEdit && (
            <div className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <Label>Account</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPassword(generateTempPassword());
                    setErrors({});
                    setActionError(null);
                    setView('reset');
                  }}
                  disabled={busy}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-700 px-4 py-2 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  Reset Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setView('delete');
                  }}
                  disabled={busy}
                  className="flex items-center gap-2 text-xs font-semibold text-red-600 px-4 py-2 bg-white hover:bg-red-50 rounded-xl border border-red-100 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Conductor
                </button>
              </div>
            </div>
          )}

          <ErrorNote>{actionError}</ErrorNote>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} disabled={busy} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={primaryButton}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
