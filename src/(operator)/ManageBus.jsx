import { useState } from 'react';
import { AlertTriangle, BusFront, Loader2, Pencil, Plus } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import BusFormModal from '../components/BusFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import useBuses from '../hooks/useBuses';
import useLiveBuses from '../hooks/useLiveBuses';
import { createBus, deleteBus, updateBus } from '../utils/busServices';

function StatusBadge({ live }) {
  const active = Boolean(live);
  const title = active
    ? `On route${live.routeName ? `: ${live.routeName}` : ''} — live location received in the last 5 minutes`
    : 'Not on a route right now';
  return (
    <span
      title={title}
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
  const { buses, loading, error } = useBuses(busLine);
  // A bus is ACTIVE while it's on a route: a fresh entry in RTDB activeBuses
  // (status "active", reported within 5 min), keyed by its bus number.
  const liveBuses = useLiveBuses();
  const liveByNumber = new Map(liveBuses.map((b) => [b.busId, b]));

  // null | { mode: 'add' } | { mode: 'edit' | 'delete', busId }
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Look the bus up on every render so the pop-ups see live changes.
  const modalBus = modal?.busId ? buses.find((b) => b.id === modal.busId) ?? null : null;
  const modalBusLive = modalBus ? liveByNumber.get(modalBus.busNumber) : null;

  const closeModal = () => {
    setModal(null);
    setDeleteError(null);
  };

  const handleSave = async (data) => {
    if (modal.mode === 'add') await createBus(data, busLine);
    else await updateBus(modalBus.id, data);
    closeModal(); // the live snapshot updates the table
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteBus(modalBus.id);
      closeModal();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <MainLayout pageTitle="Manage Bus" pageSubtitle="View and manage your fleet inventory.">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setModal({ mode: 'add' })}
          disabled={!busLine}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add New Bus
        </button>
      </div>

      {/* TABLE CONTAINER WITH DYNAMIC SCREEN HEIGHT & STICKY HEADER */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
          <table className="w-full text-left table-auto">
            <thead className="bg-slate-50 border-b border-slate-200/60 sticky top-0 z-10">
              <tr className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider">
                <th className="px-5 py-3.5 bg-slate-50">Bus ID</th>
                <th className="px-5 py-3.5 bg-slate-50">Plate Number</th>
                <th className="px-5 py-3.5 bg-slate-50">Model</th>
                <th className="px-5 py-3.5 bg-slate-50">Status</th>
                <th className="px-5 py-3.5 text-right bg-slate-50">Actions</th>
              </tr>
            </thead>
            <tbody>
              {buses.map((bus) => (
                <tr key={bus.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 text-sm font-bold text-slate-950">{bus.busNumber}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{bus.plateNumber}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{bus.model}</td>
                  <td className="px-5 py-4">
                    <StatusBadge live={liveByNumber.get(bus.busNumber)} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => setModal({ mode: 'edit', busId: bus.id })}
                      aria-label={`Edit ${bus.busNumber}`}
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
                    {loading ? (
                      <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        Loading buses…
                      </p>
                    ) : error ? (
                      <>
                        <p className="text-sm font-semibold text-red-600">Couldn’t load buses</p>
                        <p className="text-xs text-slate-500 mt-1">Check your connection and refresh the page.</p>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 mx-auto mb-3 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                          <BusFront className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-semibold text-slate-900">No buses yet</p>
                        <p className="text-xs text-slate-500 mt-1">Click “Add New Bus” to register your first vehicle.</p>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(modal?.mode === 'add' || (modal?.mode === 'edit' && modalBus)) && (
        <BusFormModal
          key={modal.busId ?? 'new'}
          mode={modal.mode}
          bus={modalBus}
          isActive={Boolean(modalBusLive)}
          line={busLine}
          onSave={handleSave}
          onDelete={() => setModal({ mode: 'delete', busId: modalBus.id })}
          onClose={closeModal}
        />
      )}

      {/* A bus on a route right now can't be deleted. */}
      {modal?.mode === 'delete' && modalBus && modalBusLive && (
        <Modal
          icon={AlertTriangle}
          iconClassName="bg-amber-50 text-amber-600"
          title={`${modalBus.busNumber} is on a route`}
          subtitle="It’s sending live locations right now, so it can’t be deleted. Try again after its trip ends."
          onClose={() => setModal({ mode: 'edit', busId: modalBus.id })}
          maxWidth="max-w-md"
        >
          <div className="flex justify-end p-6">
            <button
              type="button"
              onClick={() => setModal({ mode: 'edit', busId: modalBus.id })}
              className="text-xs font-semibold text-slate-700 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              Back
            </button>
          </div>
        </Modal>
      )}

      {modal?.mode === 'delete' && modalBus && !modalBusLive && (
        <ConfirmDialog
          title={`Delete ${modalBus.busNumber}?`}
          message={
            deleteError ??
            'This removes the bus from your fleet. Past trips keep their bus number. This action cannot be undone.'
          }
          confirmLabel={deleting ? 'Deleting…' : 'Delete Bus'}
          onConfirm={deleting ? () => {} : handleDelete}
          onCancel={deleting ? () => {} : () => setModal({ mode: 'edit', busId: modalBus.id })}
        />
      )}
    </MainLayout>
  );
}