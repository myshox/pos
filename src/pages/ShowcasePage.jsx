import React from 'react';

const postcards = [
  ['/showcase/postcard-1.jpg', '原創明信片｜兔子與紅蘿蔔'],
  ['/showcase/postcard-2.jpg', '原創明信片｜園藝角色'],
  ['/showcase/postcard-3.jpg', '原創明信片｜大小角色'],
  ['/showcase/postcard-4.jpg', '原創明信片｜冰淇淋倉鼠'],
];

const productCards = [
  ['/showcase/packaged-charms.jpg', '原創吊飾', '少量製作與現場包裝的原創角色吊飾。'],
  ['/showcase/stickers-postcards.jpg', '貼紙、明信片與卡片', '參展時陳列的 Studio Mogu 自有 IP 實體商品。'],
  ['/showcase/acrylic-charms.png', '壓克力吊飾', '自有角色圖稿製作的實體吊飾。'],
  ['/showcase/canvas-bag.png', '原創圖樣帆布袋', '商品設計與樣品圖；該款目前已缺貨且不再補貨。'],
];

export default function ShowcasePage() {
  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-12">
      <section className="rounded-3xl bg-gradient-to-br from-amber-50 via-white to-teal-50 border border-amber-100 shadow-sm p-6 sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-sm font-semibold mb-4"><span className="w-2 h-2 rounded-full bg-emerald-500" />持續營運中</span>
        <h1 className="text-3xl sm:text-5xl font-bold text-slate-800 leading-tight">Studio Mogu<br />原創 IP 商品與參展實績</h1>
        <p className="mt-5 max-w-3xl text-base sm:text-lg text-slate-600 leading-8">自行創作角色與圖稿，製作明信片、貼紙、吊飾等實體文創商品，主要於實體展會及市集少量販售。</p>
        <p className="mt-3 text-sm text-slate-500">網站：mogupos.org　｜　資料更新：2026 年 8 月 19 日</p>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div><p className="text-sm font-semibold text-teal-700">PHYSICAL PRODUCTS</p><h2 className="text-2xl sm:text-3xl font-bold text-slate-800">實體商品照片</h2></div>
          <p className="text-sm text-slate-500">少量製作，實際品項及售價依當次活動標示</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {postcards.map(([image, name]) => <article key={image} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"><img src={image} alt={name} className="w-full aspect-[4/5] object-cover" /><div className="p-4"><h3 className="font-bold text-slate-800">{name}</h3><p className="text-sm text-slate-500 mt-1">Studio Mogu 自有 IP／實體商品</p></div></article>)}
        </div>
      </section>

      <section className="grid sm:grid-cols-2 gap-6">
        {productCards.map(([image, title, text]) => <article key={image} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm"><img src={image} alt={title} className="w-full aspect-square object-cover" /><div className="p-5"><h2 className="text-xl font-bold text-slate-800">{title}</h2><p className="text-slate-600 mt-2 leading-7">{text}</p></div></article>)}
      </section>

      <section className="bg-slate-900 text-white rounded-3xl overflow-hidden grid lg:grid-cols-[1.15fr_.85fr]">
        <div className="grid grid-cols-2"><img src="/showcase/exhibition-booth.jpg" alt="Studio Mogu 實體參展攤位" className="w-full h-full min-h-80 object-cover" /><img src="/showcase/exhibition-crowd.jpg" alt="Studio Mogu 參展現場與消費者" className="w-full h-full min-h-80 object-cover" /></div>
        <div className="p-7 sm:p-10 flex flex-col justify-center"><p className="text-amber-300 text-sm font-semibold">OFFLINE EXHIBITION</p><h2 className="text-3xl font-bold mt-2">實體參展與現場交付</h2><p className="text-slate-200 leading-7 mt-5">消費者於展會攤位認識商品、現場挑選並付款，大部分商品於現場直接交付。</p></div>
      </section>
    </div>
  );
}
