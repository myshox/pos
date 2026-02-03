import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import { LocaleProvider } from './context/LocaleContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import PosPage from './pages/PosPage';
import AdminPage from './pages/AdminPage';
import AdminGuard from './components/AdminGuard';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  // 鎖定直向：PWA 時盡量不隨手機旋轉
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
      || document.referrer.includes('android-app://');
    if (!isStandalone) return;
    if (typeof screen !== 'undefined' && screen.orientation?.lock) {
      screen.orientation.lock('portrait').catch(() => {});
    }
  }, []);

  return (
    <LocaleProvider>
      <ToastProvider>
        <ErrorBoundary>
          <StoreProvider>
            <BrowserRouter>
              <Layout>
            <Routes>
              <Route path="/" element={<PosPage />} />
              <Route path="/admin" element={<AdminGuard><AdminPage /></AdminGuard>} />
            </Routes>
              </Layout>
            </BrowserRouter>
          </StoreProvider>
        </ErrorBoundary>
      </ToastProvider>
    </LocaleProvider>
  );
}

export default App;
