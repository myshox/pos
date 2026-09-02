import React from 'react';
import { isTapPayCheckoutReady } from '../lib/tappay';

export default function TapPayDisclosure({ compact = false }) {
  return (
    <aside className={`tappay-disclosure ${compact ? 'tappay-disclosure--compact' : ''}`} aria-label="TapPay 金流服務資訊">
      <img src="/tappay-logo.png" alt="TapPay" className="tappay-logo" />
      <div className="min-w-0">
        <p className="font-semibold text-slate-700">線上金流由 TapPay 喬睿科技提供</p>
        <p id="tappay-setup-status" className="text-xs text-slate-500 mt-0.5">
          {isTapPayCheckoutReady ? '選用 TapPay 時，信用卡資料將由 TapPay 安全處理。' : 'TapPay 尚未啟用；仍可使用現場其他刷卡機收款。'}
        </p>
      </div>
      {!isTapPayCheckoutReady && <span className="setup-badge">TapPay 待設定</span>}
    </aside>
  );
}
