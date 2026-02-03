import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import { LocaleProvider } from './context/LocaleContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import PosPage from './pages/PosPage';
import AdminGuard from './components/AdminGuard';
import ErrorBoundary from './components/ErrorBoundary';

const AdminPage = lazy(() => import('./pages/AdminPage'));

function App() {
  return (
    <LocaleProvider>
      <ToastProvider>
        <ErrorBoundary>
          <StoreProvider>
            <BrowserRouter>
              <Layout>
            <Routes>
              <Route path="/" element={<PosPage />} />
              <Route path="/admin" element={<AdminGuard><Suspense fallback={<div className="p-8 text-center text-stone-500">載入中...</div>}><AdminPage /></Suspense></AdminGuard>} />
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
