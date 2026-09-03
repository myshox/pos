import React from 'react';
import TapPayDisclosure from './TapPayDisclosure';

export default function TapPayAfteeForm({ customer, onChange }) {
  const update = (key) => (event) => onChange({ ...customer, [key]: event.target.value });
  return (
    <section className="space-y-3" aria-label="AFTEE 先享後付">
      <TapPayDisclosure compact method="aftee" />
      <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-3 text-sm text-fuchsia-900">送出後將前往 AFTEE 完成身分驗證與付款確認，完成後會返回本站。</div>
      <label className="block"><span className="text-sm font-medium text-slate-600">購買人姓名</span><input value={customer.name} onChange={update('name')} autoComplete="name" maxLength={40} className="input-pro mt-1 w-full rounded-xl px-4 py-3" required /></label>
      <label className="block"><span className="text-sm font-medium text-slate-600">手機號碼</span><input value={customer.phone_number} onChange={update('phone_number')} inputMode="tel" autoComplete="tel" maxLength={16} placeholder="0912345678" className="input-pro mt-1 w-full rounded-xl px-4 py-3" required /></label>
      <label className="block"><span className="text-sm font-medium text-slate-600">電子信箱</span><input value={customer.email} onChange={update('email')} inputMode="email" autoComplete="email" maxLength={40} placeholder="name@example.com" className="input-pro mt-1 w-full rounded-xl px-4 py-3" required /></label>
    </section>
  );
}
