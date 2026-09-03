import React, { useEffect, useState } from 'react';
import { setupTapPayFields } from '../lib/tappay';

export default function TapPayCardForm({ cardholder, onCardholderChange, onReadyChange }) {
  const [message, setMessage] = useState('正在載入 TapPay 安全刷卡欄位…');

  useEffect(() => {
    let active = true;
    onReadyChange(false);
    setupTapPayFields((update) => {
      if (!active) return;
      onReadyChange(Boolean(update.canGetPrime));
      setMessage(update.canGetPrime ? '卡片資料正確，可以進行測試付款。' : '請完整輸入卡號、有效期限與安全碼。');
    }).then((result) => {
      if (!active) return;
      setMessage(result.ready ? '請完整輸入卡號、有效期限與安全碼。' : 'TapPay 尚未完成設定。');
    }).catch(() => {
      if (active) setMessage('TapPay 欄位載入失敗，請檢查網路後重試。');
    });
    return () => { active = false; };
  }, [onReadyChange]);

  const update = (key) => (event) => onCardholderChange({ ...cardholder, [key]: event.target.value });

  return (
    <section className="tappay-card-form" aria-label="TapPay 信用卡付款">
      <div className="tappay-field-group tappay-field-group--wide">
        <label>信用卡卡號</label>
        <div id="tappay-card-number" className="tappay-field" />
      </div>
      <div className="tappay-field-group">
        <label>有效期限</label>
        <div id="tappay-card-expiry" className="tappay-field" />
      </div>
      <div className="tappay-field-group">
        <label>安全碼</label>
        <div id="tappay-card-ccv" className="tappay-field" />
      </div>
      <label className="tappay-contact-field">
        <span>持卡人姓名</span>
        <input value={cardholder.name} onChange={update('name')} autoComplete="cc-name" placeholder="請輸入姓名" />
      </label>
      <label className="tappay-contact-field">
        <span>手機號碼</span>
        <input value={cardholder.phone_number} onChange={update('phone_number')} inputMode="tel" autoComplete="tel" placeholder="0912345678" />
      </label>
      <label className="tappay-contact-field tappay-field-group--wide">
        <span>Email</span>
        <input value={cardholder.email} onChange={update('email')} inputMode="email" autoComplete="email" placeholder="name@example.com" />
      </label>
      <p className="tappay-field-status" aria-live="polite">{message}</p>
    </section>
  );
}
