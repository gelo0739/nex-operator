import { useState } from 'react';
import { Plus, Pencil, BusFront } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import BusFormModal from '../components/BusFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';

// Mock data shaped like Firestore `buses` docs — replace with getBuses() (utils/dashboardServices.js).
const INITIAL_BUSES = [
  { busId: 'BUS-001', plateNumber: 'NX-4492', model: 'Volta EV-X1', busLine: 'Cavite-Batangas' },
  { busId: 'BUS-002', plateNumber: 'NX-8821', model: 'Volta EV-X1', busLine: 'Cavite-Batangas' },
  { busId: 'BUS-003', plateNumber: 'NX-1204', model: 'Volta EV-X1', busLine: 'Cavite-Batangas' },
];

// Mock data shaped like RTDB `activeBuses` — replace with a live subscription (subscribeToActiveBuses).
const MOCK_ACTIVE_BUSES = {
  'BUS-001': { busId: 'BUS-001', status: 'active', lastUpdated: Date.now() },
  'BUS-003': { busId: 'BUS-003', status: 'active', lastUpdated: Date.now() },
};

const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes — same rule as hooks/useActiveBusCount.js

function isBusActive(activeBuses, busId, now) {
  const entry = activeBuses[busId];
  return Boolean(entry && entry.status === 'active' && entry.lastUpdated && now - entry.lastUpdated <= STALE_THRESHOLD);
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-600'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function ManageBus() {
  const { busLine } = useAuth(); // operator's line, from Firestore users/{uid}
  const [buses, setBuses] = useState(INITIAL_BUSES);
  const [now] = useState(() => Date.now());
  const [modal, setModal] = useState(null); // null | { mode: 'add' } | { mode: 'edit', bus } | { mode: 'delete', bus }

  const closeModal = () => setModal(null);

  const handleSave = (data) => {
    if (modal.mode === 'add') {
      setBuses((prev) => [...prev, data]);
    } else {
      setBuses((prev) => prev.map((bus) => (bus.busId === modal.bus.busId ? { ...bus, ...data } : bus)));
    }
    closeModal();
  };

  const handleDelete = () => {
    setBuses((prev) => prev.filter((bus) => bus.busId !== modal.bus.busId));
    closeModal();
  };

  return (
    <MainLayout pageTitle="Manage Bus" pageSubtitle="View and manage your fleet inventory.">
      <div>
        <button
          onClick={() => setModal({ mode: 'add' })}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add New Bus
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-auto">
            <thead className="bg-slate-50 border-b border-slate-200/60">
              <tr className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider">
                <th className="px-5 py-3.5">Bus ID</th>
                <th className="px-5 py-3.5">Plate Number</th>
                <th className="px-5 py-3.5">Model</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {buses.map((bus) => (
                <tr key={bus.busId} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 text-sm font-bold text-slate-950">{bus.busId}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{bus.plateNumber}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{bus.model}</td>
                  <td className="px-5 py-4">
                    <StatusBadge active={isBusActive(MOCK_ACTIVE_BUSES, bus.busId, now)} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => setModal({ mode: 'edit', bus })}
                      aria-label={`Edit ${bus.busId}`}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {buses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                      <BusFront className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900">No buses yet</p>
                    <p className="text-xs text-slate-500 mt-1">Click “Add New Bus” to register your first vehicle.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(modal?.mode === 'add' || modal?.mode === 'edit') && (
        <BusFormModal
          mode={modal.mode}
          bus={modal.bus}
          isActive={modal.bus ? isBusActive(MOCK_ACTIVE_BUSES, modal.bus.busId, now) : false}
          busLines={busLine ? [busLine] : []}
          existingIds={buses.map((bus) => bus.busId)}
          onSave={handleSave}
          onDelete={() => setModal({ mode: 'delete', bus: modal.bus })}
          onClose={closeModal}
        />
      )}

      {modal?.mode === 'delete' && (
        <ConfirmDialog
          title={`Delete ${modal.bus.busId}?`}
          message="This removes the bus from your fleet. This action cannot be undone."
          confirmLabel="Delete Bus"
          onConfirm={handleDelete}
          onCancel={() => setModal({ mode: 'edit', bus: modal.bus })}
        />
      )}
    </MainLayout>
  );
}
