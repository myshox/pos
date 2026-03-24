import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          className="toast-enter fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-lg text-white text-sm font-medium"
          style={{
            background: toast.type === 'error'
              ? 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)'
              : 'linear-gradient(135deg, #2dd4bf 0%, #0d9488 100%)',
          }}
          role="alert"
        >
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx || { showToast: () => {} };
}
