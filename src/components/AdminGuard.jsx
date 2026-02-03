import React from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import PinGate from './PinGate';

export default function AdminGuard({ children }) {
  const location = useLocation();
  const { isAdminUnlocked, adminHasPin } = useStore();
  const needUnlock = location.pathname.startsWith('/admin') && (!adminHasPin || !isAdminUnlocked);
  if (needUnlock) return <PinGate />;
  return children;
}
