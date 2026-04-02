import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocale } from '../context/LocaleContext';
import { useToast } from '../context/ToastContext';
import { exportAllData, importAllDataOverwrite } from '../lib/storage';
import { checkConnection, testUpload } from '../lib/syncSupabase';

export default function BackupRestore() {
  const { refreshProducts, refreshOrders, refreshStore, syncNow, manualSync, isSyncEnabled } = useStore();
  const { t } = useLocale();
  const { showToast } = useToast();
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [testingUpload, setTestingUpload] = useState(false);
  const [forceSyncing, setForceSyncing] = useState(false);

  useEffect(() => {
    if (!isSyncEnabled) return;
    let cancelled = false;
    checkConnection().then((res) => {
      if (!cancelled) setSyncStatus(res.ok ? 'ok' : { error: res.error });
    });
    return () => { cancelled = true; };
  }, [isSyncEnabled]);

  const handleTestUpload = async () => {
    if (!isSyncEnabled || testingUpload) return;
    setTestingUpload(true);
    const res = await testUpload();
    if (res.ok) showToast(t('syncWriteOk'));
    else showToast(`${t('syncWriteError')}: ${res.error}`, 'error');
    setTestingUpload(false);
  };

  const handleForceSync = async () => {
    if (!isSyncEnabled || forceSyncing) return;
    setForceSyncing(true);
    const ok = await manualSync();
    refreshProducts();
    refreshOrders();
    refreshStore();
    showToast(ok ? t('syncForceOk') : t('syncForceError'), ok ? 'success' : 'error');
    setForceSyncing(false);
  };

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
        importAllDataOverwrite(data);
        refreshProducts();
        refreshOrders();
        refreshStore();
        syncNow();
        showToast(t('backupImportSuccess'));
      } catch {
        showToast(t('backupInvalidFile'), 'error');
      }
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-800">{t('backupRestoreTitle')}</h2>
      <p className="text-slate-600 text-sm">{t('backupRestoreHint')}</p>
      {!isSyncEnabled && (
        <p className="text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 max-w-xl">{t('syncNotEnabledHint')}</p>
      )}
      {isSyncEnabled && (
        <div className="space-y-1">
          <p className="text-teal-700 text-sm font-medium">{t('syncEnabledHint')}</p>
          {syncStatus === 'ok' && <p className="text-green-700 text-sm">{t('syncStatusOk')}</p>}
          {syncStatus && syncStatus !== 'ok' && typeof syncStatus === 'object' && (
            <p className="text-red-600 text-sm break-words">{t('syncStatusError')}: {syncStatus.error}</p>
          )}
          <div className="pt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleForceSync}
              disabled={forceSyncing}
              className="px-3 py-2 rounded-xl text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white min-h-[44px] disabled:opacity-50"
            >
              {forceSyncing ? '...' : t('syncForceNow')}
            </button>
            <button
              type="button"
              onClick={handleTestUpload}
              disabled={testingUpload}
              className="px-3 py-2 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 min-h-[44px] disabled:opacity-50"
            >
              {testingUpload ? '...' : t('syncTestWrite')}
            </button>
            <button
              type="button"
              onClick={() => {
                setSyncStatus(null);
                checkConnection().then((res) => {
                  setSyncStatus(res.ok ? 'ok' : { error: res.error });
                });
              }}
              className="px-3 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 min-h-[44px] hover:bg-slate-50"
            >
              {t('syncRecheck')}
            </button>
          </div>
          <details className="pt-2 text-xs text-slate-600 leading-relaxed max-w-xl">
            <summary className="cursor-pointer text-slate-700 font-medium py-1">{t('syncTroubleshootTitle')}</summary>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>{t('syncTroubleshoot1')}</li>
              <li>{t('syncTroubleshoot2')}</li>
              <li>{t('syncTroubleshoot3')}</li>
              <li>{t('syncTroubleshoot4')}</li>
            </ul>
          </details>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-market rounded-2xl p-5">
          <h3 className="font-medium text-slate-800 mb-2">{t('backupExport')}</h3>
          <p className="text-sm text-slate-500 mb-4">{t('backupExportHint')}</p>
          <button type="button" onClick={handleExport} className="btn-primary px-4 py-2.5 rounded-xl font-medium min-h-[44px]">
            {t('backupDownload')}
          </button>
        </div>
        <div className="card-market rounded-2xl p-5">
          <h3 className="font-medium text-slate-800 mb-2">{t('backupImport')}</h3>
          <p className="text-sm text-slate-500 mb-4">{t('backupImportHint')}</p>
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
