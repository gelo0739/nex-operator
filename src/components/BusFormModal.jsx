import { useState } from 'react';
import { Bus, Lock, Trash2, X } from 'lucide-react';

export default function BusFormModal({
  mode,
  bus,
  isActive,
  line,
  onSave,
  onDelete,
  onClose,
}) {
  const [busNumber, setBusNumber] = useState(bus?.busNumber || '');
  const [plateNumber, setPlateNumber] = useState(bus?.plateNumber || '');
  const [model, setModel] = useState(bus?.model || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({ busNumber, plateNumber, model });
    } catch (err) {
      setError(err.message || 'Failed to save bus details');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      {/* Modal Container: Height capped at 90vh */}
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
        
        {/* Fixed Header */}
        <div className="p-6 pb-4 flex items-start justify-between border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {mode === 'add' ? 'Add New Bus' : `Edit ${bus?.busNumber}`}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {mode === 'add' ? 'Register a vehicle to your fleet.' : 'Update this vehicle’s details.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs font-semibold bg-rose-50 text-rose-600 rounded-xl">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Bus ID / Number
              </label>
              <input
                type="text"
                required
                disabled={mode === 'edit'}
                value={busNumber}
                onChange={(e) => setBusNumber(e.target.value)}
                placeholder="e.g. BUS-001"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:opacity-60 disabled:bg-slate-100"
              />
              {mode === 'edit' && (
                <p className="text-[10px] text-slate-400 mt-1">Can't be changed — trips and live tracking use it.</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Plate Number
              </label>
              <input
                type="text"
                required
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                placeholder="e.g. ABC 1234"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Model
            </label>
            <input
              type="text"
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. Hino / Yutong"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Bus Line
            </label>
            <div className="flex items-center gap-2 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
              <Lock className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-semibold">{line || 'Default Line'}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Buses are added to your account's bus line.</p>
          </div>

          {mode === 'edit' && (
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60 mt-2">
              <span className="text-xs text-slate-500">
                Status is set automatically from live tracking.
              </span>
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          )}

          {/* Sticky Actions Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-6 shrink-0">
            {mode === 'edit' ? (
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-xl transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Delete Bus
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-slate-600 hover:bg-slate-100 px-4 py-2.5 rounded-xl border border-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-60"
              >
                {saving ? 'Saving…' : mode === 'add' ? 'Add Bus' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}