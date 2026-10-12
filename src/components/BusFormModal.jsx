import { useState } from 'react';
import { BusFront, FilePenLine, Radio, Trash2 } from 'lucide-react';
import Modal from './Modal';

const inputClass =
  'w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

function Field({ label, error, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}

/**
 * Add / edit form for a bus. `mode` is "add" or "edit".
 * In edit mode the Bus ID is read-only — it is the key that links the record
 * to its live entry in RTDB `activeBuses`.
 */
export default function BusFormModal({ mode, bus, isActive, busLines, existingIds, onSave, onDelete, onClose }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    busId: bus?.busId ?? '',
    plateNumber: bus?.plateNumber ?? '',
    model: bus?.model ?? '',
    busLine: bus?.busLine ?? busLines[0] ?? '',
  });
  const [errors, setErrors] = useState({});

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const cleaned = {
      busId: form.busId.trim().toUpperCase(),
      plateNumber: form.plateNumber.trim().toUpperCase(),
      model: form.model.trim(),
      busLine: form.busLine,
    };

    const nextErrors = {};
    if (!cleaned.busId) nextErrors.busId = 'Bus ID is required.';
    else if (!isEdit && existingIds.includes(cleaned.busId)) nextErrors.busId = 'A bus with this ID already exists.';
    if (!cleaned.plateNumber) nextErrors.plateNumber = 'Plate number is required.';
    if (!cleaned.model) nextErrors.model = 'Model is required.';
    if (!cleaned.busLine) nextErrors.busLine = 'Bus line is required.';

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    onSave(cleaned);
  };

  const borderFor = (field) => (errors[field] ? 'border-red-300' : 'border-slate-200');

  return (
    <Modal
      icon={isEdit ? FilePenLine : BusFront}
      title={isEdit ? `Edit ${bus.busId}` : 'Add New Bus'}
      subtitle={isEdit ? 'Update this vehicle’s details.' : 'Register a new vehicle to your fleet.'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-4 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Bus ID" error={errors.busId}>
              <input
                type="text"
                value={form.busId}
                onChange={updateField('busId')}
                readOnly={isEdit}
                placeholder="e.g. BUS-004"
                autoFocus={!isEdit}
                className={`${inputClass} ${borderFor('busId')} ${isEdit ? 'cursor-not-allowed text-slate-500 focus:ring-0 focus:border-slate-200 focus:bg-slate-50' : ''}`}
              />
            </Field>
            <Field label="Plate Number" error={errors.plateNumber}>
              <input
                type="text"
                value={form.plateNumber}
                onChange={updateField('plateNumber')}
                placeholder="e.g. NX-1234"
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
              placeholder="e.g. Volta EV-X1"
              className={`${inputClass} ${borderFor('model')}`}
            />
          </Field>

          <Field label="Bus Line" error={errors.busLine}>
            <select
              value={form.busLine}
              onChange={updateField('busLine')}
              className={`${inputClass} ${borderFor('busLine')} cursor-pointer`}
            >
              {busLines.map((line) => (
                <option key={line} value={line}>{line}</option>
              ))}
            </select>
          </Field>

          {isEdit && (
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
              <Radio className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="flex-1 text-xs text-slate-500">Status is set automatically from live tracking.</p>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                  isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-600'
                }`}
              >
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100">
          {isEdit && (
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-2 text-xs font-semibold text-red-600 px-4 py-2.5 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Delete Bus
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-700 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="text-xs font-semibold text-white px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-lg shadow-blue-600/30 transition-colors cursor-pointer"
            >
              {isEdit ? 'Save Changes' : 'Add Bus'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
