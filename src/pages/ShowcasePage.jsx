import React from 'react';

const products = [
  { image: '/showcase/postcard-1.jpg', name: '原創明信片｜兔子與紅蘿蔔' },
  { image: '/showcase/postcard-2.jpg', name: '原創明信片｜園藝角色' },
  { image: '/showcase/postcard-3.jpg', name: '原創明信片｜大小角色' },
  { image: '/showcase/postcard-4.jpg', name: '原創明信片｜冰淇淋倉鼠' },
];

export default function ShowcasePage() {
  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-12">
      <section className="rounded-3xl bg-gradient-to-br from-amber-50 via-white to-teal-50 border border-amber-100 shadow-sm p-6 sm:p-10">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-sm font-semibold mb-4"><span className="w-2 h-2 rounded-full bg-emerald-500" />持續營運中</div>
          <h1 className="text-3xl sm:text-5xl font-bold text-slate-800 leading-tight">Studio Mogu<br />原創 IP 商品與參展實績</h1>
          <p className="mt-5 text-base sm:text-lg text-slate-600 leading-8">自行創作角色與圖稿，製作明信片、貼紙、吊飾等實體文創商品，主要於實體展會及市集少量販售。</p>
          <p className="mt-3 text-sm text-slate-500">網站：mogupos.org ・ 資料更新：2026 年 8 月 19 日</p>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div><p className="text-sm font-semibold text-teal-700">PHYSICAL PRODUCTS</p><h2 className="text-2xl sm:text-3xl font-bold text-slate-800">實體商品照片</h2></div>
          <p className="text-sm text-slate-500">少量製作，實際品項及售價依當次活動標示</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {products.map((product) => (
            <article key={product.image} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <img src={product.image} alt={product.name} className="w-full aspect-[4/5] object-cover" />
              <div className="p-4"><h3 className="font-bold text-slate-800">{product.name}</h3><p className="text-sm text-slate-500 mt-1">Studio Mogu 自有 IP／實體商品</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <article className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <img src="/showcase/packaged-charms.jpg" alt="包裝完成的原創吊飾商品" className="w-full aspect-square object-cover" />
          <div className="p-5"><h2 className="text-xl font-bold text-slate-800">原創吊飾與現場包裝</h2><p className="text-slate-600 mt-2">自有角色圖稿製作成實體商品，少量包裝並於展場陳列販售。</p></div>
        </article>
        <article className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <img src="/showcase/stickers-postcards.jpg" alt="原創貼紙與明信片實體庫存" className="w-full aspect-square object-cover" />
          <div className="p-5"><h2 className="text-xl font-bold text-slate-800">貼紙、明信片與卡片庫存</h2><p className="text-slate-600 mt-2">多款 Studio Mogu 原創角色商品，依參展活動準備少量實體庫存。</p></div>
        </article>
      </section>

      <section className="bg-slate-900 text-white rounded-3xl overflow-hidden grid lg:grid-cols-[1.15fr_.85fr]">
        <img src="/showcase/exhibition-booth.jpg" alt="Studio Mogu 實體參展攤位" className="w-full h-full max-h-[620px] object-cover" />
        <div className="p-7 sm:p-10 flex flex-col justify-center">
          <p className="text-amber-300 text-sm font-semibold">OFFLINE EXHIBITION</p><h2 className="text-3xl font-bold mt-2">實體參展與現場交付</h2>
          <p className="text-slate-200 leading-7 mt-5">消費者於展會攤位認識商品、現場挑選並付款後直接取得商品。現場交易通常沒有物流單號，參展照片、商品陳列與付款紀錄即為交易情境佐證。</p>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <h2 className="text-xl font-bold">關於賣貨便與線上收款</h2>
        <p className="mt-3 leading-7">賣貨便並非全年常設商店，僅於特定活動、展後少量庫存或郵寄需求時短期開啟；活動結束、售罄或停止接單後即下架。部分消費者會於展會後、晚間確認品項或預留商品，再透過 SHOPLINE Payments 收款連結完成付款。</p>
      </section>
    </div>
  );
}
