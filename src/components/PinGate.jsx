import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocale } from '../context/LocaleContext';
import { useToast } from '../context/ToastContext';

export default function PinGate({ children }) {
  const { adminHasPin, adminCheckPin, adminSetPin, adminUnlock, updateUnlock } = useStore();
  const { t } = useLocale();
  const { showToast } = useToast();
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState('enter'); // 'enter' | 'set'
  const [setPinValue, setSetPinValue] = useState('');
  const [setPinConfirm, setSetPinConfirm] = useState('');

  useEffect(() => {
    updateUnlock();
  }, [updateUnlock]);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (!pin.trim()) return;
    if (adminCheckPin(pin)) {
      adminUnlock(30);
      setPin('');
    } else {
      showToast(t('pinIncorrect'), 'error');
    }
  };

  const handleSetPin = (e) => {
    e.preventDefault();
    const p = setPinValue.trim();
    if (p.length < 4) {
      showToast(t('pinMinLength'), 'error');
      return;
    }
    if (p !== setPinConfirm.trim()) {
      showToast(t('pinMismatch'), 'error');
      return;
    }
    adminSetPin(p);
    setSetPinValue('');
    setSetPinConfirm('');
    setMode('enter');
    adminUnlock(30);
    showToast(t('pinSetSuccess'));
  };

  const needSetPin = !adminHasPin;
  const showSetForm = needSetPin || mode === 'set';

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-sm card-market rounded-2xl p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-stone-800 mb-2 text-center">
          {showSetForm ? t('pinSetTitle') : t('pinEnterTitle')}
        </h2>
        <p className="text-stone-500 text-sm text-center mb-6">
          {showSetForm ? t('pinSetHint') : t('pinEnterHint')}
        </p>

        {showSetForm ? (
          <form onSubmit={handleSetPin} className="space-y-4">
            <label className="block">
              <span className="text-sm text-stone-600">{t('pinNew')}</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={setPinValue}
                onChange={(e) => setSetPinValue(e.target.value)}
                placeholder="••••"
                className="mt-1 w-full border border-stone-300 rounded-xl px-4 py-3 text-center text-lg tracking-widest min-h-[48px]"
                maxLength={8}
              />
            </label>
            <label className="block">
              <span className="text-sm text-stone-600">{t('pinConfirm')}</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={setPinConfirm}
                onChange={(e) => setSetPinConfirm(e.target.value)}
                placeholder="••••"
                className="mt-1 w-full border border-stone-300 rounded-xl px-4 py-3 text-center text-lg tracking-widest min-h-[48px]"
                maxLength={8}
              />
            </label>
            <button type="submit" className="btn-primary w-full py-3 rounded-xl font-medium min-h-[48px]">
              {t('save')}
            </button>
            {adminHasPin && mode === 'set' && (
              <button type="button" onClick={() => setMode('enter')} className="w-full py-2 text-stone-500 text-sm">
                {t('cancel')}
              </button>
            )}
          </form>
        ) : (
          <form onSubmit={handleUnlock} className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="w-full border border-stone-300 rounded-xl px-4 py-3 text-center text-lg tracking-widest min-h-[48px]"
              maxLength={8}
            />
            <button type="submit" className="btn-primary w-full py-3 rounded-xl font-medium min-h-[48px]">
              {t('pinUnlock')}
            </button>
            <button type="button" onClick={() => setMode('set')} className="w-full py-2 text-stone-500 text-sm">
              {t('pinChange')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
