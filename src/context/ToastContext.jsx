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
          className="toast-enter fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] max-w-[min(100vw-2rem,22rem)] px-5 py-3.5 rounded-2xl shadow-2xl text-white text-sm font-medium text-center leading-snug border border-white/15 backdrop-blur-sm"
          style={{
            background: toast.type === 'error'
              ? 'linear-gradient(145deg, #f87171 0%, #b91c1c 100%)'
              : 'linear-gradient(145deg, #2dd4bf 0%, #0f766e 100%)',
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
