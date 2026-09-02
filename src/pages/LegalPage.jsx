import React from 'react';
import { useStore } from '../context/StoreContext';

const DEFAULT_POLICY = [
  '本 POS 主要用於實體市集現場交易。消費者可於購買前查看及挑選商品，因此現場購買不適用通訊交易的七日無條件解除權；除商品瑕疵或交付錯誤外，恕不因個人喜好、尺寸判斷或重複購買提供退換貨。',
  '結帳前請共同確認商品名稱、款式、數量、價格與外觀。貼紙、明信片、印刷品、壓克力吊飾及其他文創商品的輕微色差，可能來自螢幕顯示、印刷批次或製程；在不影響正常使用且已於現場確認的情況下，不視為瑕疵。',
  '若商品有非人為破損、零件缺漏、明顯印刷錯誤，或實際交付品項與結帳內容不符，建議於購買後七日內攜帶商品及可辨識的購買資訊與我們聯絡；此聯絡期限不影響消費者依法享有的瑕疵擔保權利。',
  '經確認屬商品瑕疵或交付錯誤時，將視庫存提供同款換貨；若商品已售罄或無法更換，則協助更換等值商品或辦理退款。',
  '因不當保存、碰撞、拉扯、受潮、曝曬、正常使用耗損，或消費者自行拆解、修改所造成的損壞，不屬於商品原始瑕疵。',
  '依消費者指定內容製作的姓名、圖樣、尺寸或其他客製商品，確認製作內容後即開始製作；除製作結果與確認內容不符或商品本身有瑕疵外，不接受取消或退換。',
];

export default function LegalPage() {
  const { store } = useStore();
  const companyName = store.name || '蘑菇宇宙工作室';
  const taxId = store.taxId || '95148616';
  const phone = store.phone || '0908-180-610';
  const companyEmail = store.companyEmail || 'mogu5486047@gmail.com';
  const supportEmail = store.supportEmail || 'myshoxisgood@gmail.com';
  const policy = store.returnPolicy ? store.returnPolicy.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : DEFAULT_POLICY;
  return (
    <div className="legal-page max-w-4xl mx-auto pb-16">
      <header className="legal-hero">
        <h1>商店資訊與退換貨規則</h1>
        <p>Studio Mogu 主要於實體市集販售原創 IP 文創商品；購買前請確認品項與商品狀態，若有問題我們會協助處理。</p>
      </header>
      <div className="legal-grid">
        <section><h2>商店資訊</h2><dl><div><dt>公司名稱</dt><dd>{companyName}</dd></div><div><dt>統一編號</dt><dd>{taxId}</dd></div><div><dt>公司信箱</dt><dd><a href={`mailto:${companyEmail}`}>{companyEmail}</a></dd></div><div><dt>客服信箱</dt><dd><a href={`mailto:${supportEmail}`}>{supportEmail}</a></dd></div><div><dt>聯絡電話</dt><dd><a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a></dd></div></dl></section>
        <section><h2>實體市集退換貨規則</h2><ul>{policy.map((item, index) => <li key={`${index}-${item.slice(0, 12)}`}>{item}</li>)}</ul><p className="legal-note">若交易並非於實體市集現場完成，而是透過網路、通訊方式訂購及寄送，相關退換貨將依消費者保護法的通訊交易規定另行處理。</p></section>
      </div>
    </div>
  );
}
