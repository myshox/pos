import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocale } from '../context/LocaleContext';
import { useToast } from '../context/ToastContext';
import { exportAllData, importAllDataOverwrite } from '../lib/storage';
import { checkConnection, testUpload, fetchCloudStats, clearRemoteCursor } from '../lib/syncSupabase';
import { getProducts, getOrders, getCategories } from '../lib/storage';

export default function BackupRestore() {
  const { refreshProducts, refreshOrders, refreshStore, syncNow, manualSync, forceRePull, isSyncEnabled } = useStore();
  const { t } = useLocale();
  const { showToast } = useToast();
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [testingUpload, setTestingUpload] = useState(false);
  const [forceSyncing, setForceSyncing] = useState(false);
  const [cloudStats, setCloudStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const localStats = {
    products: getProducts().length,
    orders: getOrders().length,
    categories: getCategories().length,
  };

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
    const stats = await fetchCloudStats();
    setCloudStats(stats);
  };

  const handleLoadStats = async () => {
    if (!isSyncEnabled || loadingStats) return;
    setLoadingStats(true);
    const stats = await fetchCloudStats();
    setCloudStats(stats);
    setLoadingStats(false);
  };

  const handleForceRePull = async () => {
    if (!isSyncEnabled || forceSyncing) return;
    setForceSyncing(true);
    const ok = await forceRePull();
    showToast(ok ? t('syncForceOk') : t('syncForceError'), ok ? 'success' : 'error');
    setForceSyncing(false);
    const stats = await fetchCloudStats();
    setCloudStats(stats);
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
        <div className="space-y-2">
          <p className="text-teal-700 text-sm font-medium">{t('syncEnabledHint')}</p>
          {syncStatus === 'ok' && <p className="text-green-700 text-sm">{t('syncStatusOk')}</p>}
          {syncStatus && syncStatus !== 'ok' && typeof syncStatus === 'object' && (
            <p className="text-red-600 text-sm break-words">{t('syncStatusError')}: {syncStatus.error}</p>
          )}

          {/* 診斷：本機 vs 雲端筆數 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm space-y-1 max-w-xl">
            <p className="font-medium text-slate-700">本機資料</p>
            <p className="text-slate-600">商品 {localStats.products} 筆　訂單 {localStats.orders} 筆　分類 {localStats.categories} 筆</p>
            {cloudStats ? (
              <>
                <p className="font-medium text-slate-700 pt-1">雲端資料</p>
                <p className={cloudStats.products === 0 ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                  商品 {cloudStats.products} 筆　訂單 {cloudStats.orders} 筆　分類 {cloudStats.categories} 筆
                </p>
                {cloudStats.updatedAt && (
                  <p className="text-slate-400 text-xs">雲端更新：{new Date(cloudStats.updatedAt).toLocaleString('zh-TW')}</p>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={handleLoadStats}
                disabled={loadingStats}
                className="text-teal-600 underline text-xs disabled:opacity-50"
              >
                {loadingStats ? '查詢中...' : '查詢雲端筆數'}
              </button>
            )}
          </div>

          <div className="pt-1 flex flex-wrap gap-2">
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
              onClick={handleForceRePull}
              disabled={forceSyncing}
              className="px-3 py-2 rounded-xl text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white min-h-[44px] disabled:opacity-50"
            >
              {forceSyncing ? '...' : '強制重新拉取'}
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
