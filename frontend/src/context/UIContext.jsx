import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [toasts, setToasts]               = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      setConfirmDialog({
        message,
        onConfirm: () => { setConfirmDialog(null); resolve(true);  },
        onCancel:  () => { setConfirmDialog(null); resolve(false); },
      });
    });
  }, []);

  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <UIContext.Provider value={{ showToast, confirm }}>
      {children}

      {/* ── Toast container ─────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2
        pointer-events-none w-80">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3 rounded-xl
              shadow-lg border transition-all duration-300
              animate-in slide-in-from-right-8 fade-in
              ${toast.type === 'error'
                ? 'bg-status-danger-bg  border-status-danger-text/20'
                : toast.type === 'success'
                ? 'bg-status-success-bg border-status-success-text/20'
                : 'bg-surface-1 border-line'
              }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'error'   && <AlertCircle   className="text-status-danger-text"  size={18} />}
              {toast.type === 'success' && <CheckCircle2  className="text-status-success-text" size={18} />}
              {toast.type === 'info'    && <Info          className="text-accent"               size={18} />}
            </div>
            <p className={`text-sm font-medium leading-snug flex-1 ${
              toast.type === 'error'
                ? 'text-status-danger-text'
                : toast.type === 'success'
                ? 'text-status-success-text'
                : 'text-tx-primary'
            }`}>
              {toast.message}
            </p>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-tx-muted hover:text-tx-primary transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* ── Confirm dialog ──────────────────────────────────────── */}
      {confirmDialog && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]"
            onClick={confirmDialog.onCancel}
          />
          {/* Dialog */}
          <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[9999]
            w-full max-w-sm animate-in slide-in-from-top-4 fade-in duration-200">
            <div className="bg-surface-1 rounded-2xl shadow-xl border border-line p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-status-warning-bg text-status-warning-text
                  rounded-full shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div className="pt-1">
                  <h3 className="text-base font-semibold text-tx-primary leading-snug">
                    Are you sure?
                  </h3>
                  <p className="text-sm text-tx-secondary mt-1">{confirmDialog.message}</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={confirmDialog.onCancel}
                  className="px-4 py-2 text-sm font-medium text-tx-secondary
                    hover:bg-surface-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="px-4 py-2 text-sm font-medium text-white
                    bg-status-danger-text hover:opacity-90 rounded-lg
                    shadow-sm transition-opacity"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within a UIProvider');
  return context;
}
