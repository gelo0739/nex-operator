import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

/**
 * Small "are you sure?" pop-up for destructive actions (e.g. deleting a record).
 */
export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  return (
    <Modal
      icon={AlertTriangle}
      iconClassName="bg-red-50 text-red-600"
      title={title}
      subtitle={message}
      onClose={onCancel}
      maxWidth="max-w-md"
    >
      <div className="flex justify-end gap-3 p-6">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-semibold text-slate-700 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="text-xs font-semibold text-white px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl shadow-lg shadow-red-600/30 transition-colors cursor-pointer"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
