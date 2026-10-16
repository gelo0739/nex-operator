import { useState } from 'react';
import { AlertTriangle, BusFront, FilePenLine, Loader2, Lock, Radio, Trash2, TriangleAlert, Wrench } from 'lucide-react';
import Modal from './Modal';

// Must match the `buses` rules in firestore.rules.
const BUS_NUMBER_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,19}$/;
const MAX_PLATE = 20;
const MAX_MODEL = 60;

const inputClass =
  'w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';
const readOnlyClass = 'cursor-not-allowed text-slate-500 focus:ring-0 focus:border-slate-200 focus:bg-slate-50';

function Field({ label, error, hint, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
      {error ? <span className="text-xs text-red-600">{error}</span> : hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

/**
 * Add / edit form for a Firestore `buses` doc. `mode` is "add" or "edit".
 * In edit mode the bus number is read-only — trips and live tracking
 * (RTDB activeBuses/{busNumber}) are keyed on it. The bus line is always the
 * operator's line. `onSave(data)` is async; an Error with `field` set is shown
 * next to that field, any other error above the buttons.
 * In edit mode the Status box also sets the bus inoperable / operable:
 * `inoperable` is its RTDB inoperableBuses entry (or null), and
 * `onChangeStatus('inoperable' | 'operable')` opens the confirm.
 */
export default function BusFormModal({ mode, bus, isActive, inoperable, line, onSave, onDelete, onChangeStatus, onClose }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    busNumber: bus?.busNumber ?? '',
    plateNumber: bus?.plateNumber ?? '',
    model: bus?.model ?? '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSaveError(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const cleaned = {
      busNumber: form.busNumber.trim().toUpperCase().replace(/\s+/g, '-'),
      plateNumber: form.plateNumber.trim().toUpperCase(),
      model: form.model.trim(),
    };

    const nextErrors = {};
    if (!isEdit) {
      if (!cleaned.busNumber) nextErrors.busNumber = 'Bus ID is required.';
      else if (!BUS_NUMBER_PATTERN.test(cleaned.busNumber)) {
        nextErrors.busNumber = '2–20 characters: letters, numbers and dashes (e.g. BUS-004).';
      }
    }
    if (!cleaned.plateNumber) nextErrors.plateNumber = 'Plate number is required.';
    else if (cleaned.plateNumber.length > MAX_PLATE) nextErrors.plateNumber = `At most ${MAX_PLATE} characters.`;
    if (!cleaned.model) nextErrors.model = 'Model is required.';
    else if (cleaned.model.length > MAX_MODEL) nextErrors.model = `At most ${MAX_MODEL} characters.`;

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await onSave(cleaned);
    } catch (error) {
      if (error.field) setErrors({ [error.field]: error.message });
      else setSaveError(error.message);
      setSaving(false);
    }
  };

  const borderFor = (field) => (errors[field] ? 'border-red-300' : 'border-slate-200');

  return (
    <Modal
      icon={isEdit ? FilePenLine : BusFront}
      title={isEdit ? `Edit ${bus.busNumber}` : 'Add New Bus'}
      subtitle={isEdit ? 'Update this vehicle’s details.' : 'Register a new vehicle to your fleet.'}
      onClose={saving ? () => {} : onClose}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-4 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Bus ID"
              error={errors.busNumber}
              hint={isEdit ? 'Can’t be changed — trips and live tracking use it.' : 'Must be unique across the fleet.'}
            >
              <input
                type="text"
                value={form.busNumber}
                onChange={updateField('busNumber')}
                readOnly={isEdit}
                disabled={saving}
                placeholder="e.g. BUS-004"
                maxLength={20}
                autoFocus={!isEdit}
                className={`${inputClass} ${borderFor('busNumber')} ${isEdit ? readOnlyClass : ''}`}
              />
            </Field>
            <Field label="Plate Number" error={errors.plateNumber}>
              <input
                type="text"
                value={form.plateNumber}
                onChange={updateField('plateNumber')}
                disabled={saving}
                placeholder="e.g. NX-1234"
                maxLength={MAX_PLATE}
                autoFocus={isEdit}
                className={`${inputClass} ${borderFor('plateNumber')}`}
              />
            </Field>
          </div>

          <Field label="Model" error={errors.model}>
            <input
              type="text"
              value={form.model}
              onChange={updateField('model')}
              disabled={saving}
              placeholder="e.g. Volta EV-X1"
              maxLength={MAX_MODEL}
              className={`${inputClass} ${borderFor('model')}`}
            />
          </Field>

          <Field label="Bus Line" hint="Buses are added to your account’s bus line.">
            <div className={`${inputClass} border-slate-200 ${readOnlyClass} flex items-center gap-2`}>
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              {line || '—'}
            </div>
          </Field>

          {isEdit && (
            <div
              className={`flex flex-col gap-3 rounded-xl border px-4 py-3 ${
                inoperable ? 'bg-red-50/60 border-red-100' : 'bg-slate-50 border-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                {inoperable ? (
                  <TriangleAlert className="w-4 h-4 text-red-500 shrink-0" />
                ) : (
                  <Radio className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <p className="flex-1 text-xs text-slate-500">
                  {inoperable
                    ? inoperable.source === 'operator'
                      ? 'Out of service — set inoperable by an operator. No trips can start until it’s marked operable.'
                      : 'Out of service — reported inoperable by a conductor. No trips can start until it’s marked operable.'
                    : isActive
                      ? 'On a route right now. To take it out of service, its conductor marks it inoperable from the NEX app.'
                      : 'Active / Inactive is set automatically from live tracking.'}
                </p>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                    inoperable
                      ? 'bg-red-50 text-red-700'
                      : isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-orange-50 text-orange-600'
                  }`}
                >
                  {inoperable ? 'Inoperable' : isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex justify-end">
                {inoperable ? (
                  <button
                    type="button"
                    onClick={() => onChangeStatus('operable')}
                    disabled={saving}
                    className="flex items-center gap-2 text-xs font-semibold text-emerald-700 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Mark as Operable
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onChangeStatus('inoperable')}
                    disabled={saving || isActive}
                    title={isActive ? 'It’s on a route — its conductor marks it inoperable from the NEX app' : undefined}
                    className="flex items-center gap-2 text-xs font-semibold text-red-700 px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <TriangleAlert className="w-3.5 h-3.5" />
                    Mark as Inoperable
                  </button>
                )}
              </div>
            </div>
          )}

          {saveError && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-xs font-medium text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              {saveError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100">
          {isEdit && (
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              className="flex items-center gap-2 text-xs font-semibold text-red-600 px-4 py-2.5 hover:bg-red-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete Bus
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-xs font-semibold text-slate-700 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 text-xs font-semibold text-white px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-lg shadow-blue-600/30 transition-colors cursor-pointer disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Bus'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
