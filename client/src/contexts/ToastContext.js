import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // fallback: context 없이도 동작하도록
    return { showToast: (msg) => console.warn('ToastProvider 없음:', msg) };
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const [timerId, setTimerId] = useState(null);

  const showToast = useCallback((message, duration = 2500) => {
    if (timerId) clearTimeout(timerId);
    setToast(message);
    const id = setTimeout(() => setToast(null), duration);
    setTimerId(id);
  }, [timerId]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100002,
          pointerEvents: 'none',
          animation: 'toastFadeIn 0.3s ease-out'
        }}>
          <div style={{
            background: 'rgba(30,30,30,0.92)',
            color: '#fff',
            padding: '10px 22px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            whiteSpace: 'pre-line',
            textAlign: 'center',
            maxWidth: '85vw'
          }}>
            {toast}
          </div>
        </div>
      )}
      <style>{`
        @keyframes toastFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
};
