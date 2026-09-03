import React from 'react';
import TapPayDisclosure from './TapPayDisclosure';

export default function TapPayAtmForm({ customer, onChange, total }) {
  const update = (key) => (event) => onChange({ ...customer, [key]: event.target.value });
  const outOfRange = total > 0 && (total < 16 || total > 49999);

  return (
    <section className="tappay-atm-form space-y-3" aria-label="TapPay ATM 虛擬帳號轉帳">
      <TapPayDisclosure compact method="atm" />
      <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
        送出後會產生專屬虛擬帳號，訂單將先標示為「待轉帳」。請在期限內轉入正確金額。
      </div>
      {outOfRange && <p className="text-sm font-semibold text-red-600">ATM 單筆金額須為 NT$16～49,999。</p>}
      <label className="block"><span className="text-sm font-medium text-slate-600">付款人姓名</span><input value={customer.name} onChange={update('name')} autoComplete="name" maxLength={40} placeholder="請輸入姓名" className="input-pro mt-1 w-full rounded-xl px-4 py-3" /></label>
      <label className="block"><span className="text-sm font-medium text-slate-600">手機號碼</span><input value={customer.phone_number} onChange={update('phone_number')} inputMode="tel" autoComplete="tel" maxLength={40} placeholder="0912345678" className="input-pro mt-1 w-full rounded-xl px-4 py-3" /></label>
      <label className="block"><span className="text-sm font-medium text-slate-600">電子信箱</span><input value={customer.email} onChange={update('email')} inputMode="email" autoComplete="email" maxLength={40} placeholder="name@example.com" className="input-pro mt-1 w-full rounded-xl px-4 py-3" /></label>
    </section>
  );
}
