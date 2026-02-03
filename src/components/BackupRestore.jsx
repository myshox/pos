import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocale } from '../context/LocaleContext';
import { useToast } from '../context/ToastContext';
import { exportAllData, importAllData } from '../lib/storage';
import { checkConnection } from '../lib/syncSupabase';

export default function BackupRestore() {
  const { refreshProducts, refreshOrders, refreshStore, syncNow, isSyncEnabled } = useStore();
  const { t } = useLocale();
  const { showToast } = useToast();
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  useEffect(() => {
    if (!isSyncEnabled) return;
    let cancelled = false;
    checkConnection().then((res) => {
      if (!cancelled) setSyncStatus(res.ok ? 'ok' : { error: res.error });
    });
    return () => { cancelled = true; };
  }, [isSyncEnabled]);

  const handleExport = () => {
    const data = exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('backupExportSuccess'));
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.products && !data.orders && !data.categories && !data.store) {
          showToast(t('backupInvalidFile'), 'error');
          setImporting(false);
          return;
        }
        if (!window.confirm(t('backupImportConfirm'))) {
          setImporting(false);
          return;
        }
        importAllData(data);
        refreshProducts();
        refreshOrders();
        refreshStore();
        syncNow();
        showToast(t('backupImportSuccess'));
      } catch (err) {
        showToast(t('backupInvalidFile'), 'error');
      }
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-stone-800">{t('backupRestoreTitle')}</h2>
      <p className="text-stone-600 text-sm">{t('backupRestoreHint')}</p>
      {isSyncEnabled && (
        <div className="space-y-1">
          <p className="text-amber-700 text-sm font-medium">{t('syncEnabledHint')}</p>
          {syncStatus === 'ok' && <p className="text-green-700 text-sm">{t('syncStatusOk')}</p>}
          {syncStatus && syncStatus !== 'ok' && typeof syncStatus === 'object' && (
            <p className="text-red-600 text-sm">{t('syncStatusError')}: {syncStatus.error}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-market rounded-2xl p-5">
          <h3 className="font-medium text-stone-800 mb-2">{t('backupExport')}</h3>
          <p className="text-sm text-stone-500 mb-4">{t('backupExportHint')}</p>
          <button type="button" onClick={handleExport} className="btn-primary px-4 py-2.5 rounded-xl font-medium min-h-[44px]">
            {t('backupDownload')}
          </button>
        </div>
        <div className="card-market rounded-2xl p-5">
          <h3 className="font-medium text-stone-800 mb-2">{t('backupImport')}</h3>
          <p className="text-sm text-stone-500 mb-4">{t('backupImportHint')}</p>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            disabled={importing}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="btn-primary px-4 py-2.5 rounded-xl font-medium min-h-[44px] disabled:opacity-50"
          >
            {importing ? '...' : t('backupSelectFile')}
          </button>
        </div>
      </div>
    </div>
  );
}
