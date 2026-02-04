import React from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import PinGate from './PinGate';

export default function AdminGuard({ children }) {
  const location = useLocation();
  const { isAdminUnlocked, adminHasPin, store } = useStore();
  const pinDisabled = !!store?.pinDisabled;
  const needUnlock = location.pathname.startsWith('/admin') && !pinDisabled && (!adminHasPin || !isAdminUnlocked);
  if (needUnlock) return <PinGate />;
  return children;
}
