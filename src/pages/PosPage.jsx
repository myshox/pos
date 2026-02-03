import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocale } from '../context/LocaleContext';
import { useToast } from '../context/ToastContext';
import ReceiptModal from '../components/ReceiptModal';
import { getDailyReport } from '../lib/reportUtils';

const PAYMENT_STORAGE_KEY = 'pos_last_payment';

const PAYMENT_OPTIONS = [
  { id: 'line', labelKey: 'payLine' },
  { id: 'cash', labelKey: 'payCash' },
  { id: 'card', labelKey: 'payCard' },
];

export default function PosPage() {
  const { activeProducts, products, orders, submitOrder, refreshProducts } = useStore();
  const { t } = useLocale();
  const { showToast } = useToast();
  const [cart, setCart] = useState([]);
  const [orderNote, setOrderNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(() => {
    try {
      const saved = localStorage.getItem(PAYMENT_STORAGE_KEY);
      if (['line', 'cash', 'card'].includes(saved)) return saved;
    } catch (_) {}
    return 'line';
  });
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [discountType, setDiscountType] = useState('none');
  const [discountValue, setDiscountValue] = useState('');
  const confirmBackRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(PAYMENT_STORAGE_KEY, paymentMethod); } catch (_) {}
  }, [paymentMethod]);

  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  const todayReport = useMemo(
    () => getDailyReport(orders, new Date()),
    [orders]
  );

  const addToCart = useCallback((product) => {
    const existing = cart.find((item) => item.id === product.id);
    const nextQty = existing ? existing.qty + 1 : 1;
    if (product.useStock && typeof product.stock === 'number' && product.stock < nextQty) {
      showToast(t('stockInsufficient'), 'error');
      return;
    }
    if (existing) {
      setCart(cart.map((item) =>
        item.id === product.id ? { ...item, qty: item.qty + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
  }, [cart, showToast, t]);

  const removeFromCart = useCallback((id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateQty = useCallback((id, delta) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const qty = Math.max(0, item.qty + delta);
        return qty === 0 ? null : { ...item, qty };
      }).filter(Boolean)
    );
  }, []);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart]);
  const discountAmount = useMemo(() => {
    if (discountType === 'none' || !discountValue) return 0;
    const v = Number(discountValue);
    if (Number.isNaN(v) || v < 0) return 0;
    if (discountType === 'amount') return Math.min(v, subtotal);
    if (discountType === 'percent') return Math.min(subtotal * (v / 100), subtotal);
    return 0;
  }, [discountType, discountValue, subtotal]);
  const total = Math.max(0, Math.round(subtotal - discountAmount));
  const discount = discountType !== 'none' && discountValue ? { type: discountType, value: Number(discountValue) || 0 } : null;

  const openCheckoutConfirm = useCallback(() => {
    if (cart.length === 0) {
      showToast(t('toastCartEmpty'), 'error');
      return;
    }
    for (const item of cart) {
      const p = products.find((x) => x.id === item.id);
      if (p && p.useStock && typeof p.stock === 'number' && p.stock < item.qty) {
        showToast(t('stockInsufficient'), 'error');
        return;
      }
    }
    if (total === 0) {
      showToast(t('checkoutTotalZeroWarning'), 'error');
      return;
    }
    setShowCheckoutConfirm(true);
  }, [cart, products, total, showToast, t]);

  const handleConfirmCheckout = useCallback(() => {
    if (cart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setShowCheckoutConfirm(false);
    const newOrder = submitOrder(cart, total, orderNote.trim(), paymentMethod, discount);
    setReceiptOrder(newOrder);
    setCart([]);
    setOrderNote('');
    setDiscountType('none');
    setDiscountValue('');
    showToast(t('toastCheckoutSuccess'));
    setTimeout(() => setIsSubmitting(false), 400);
  }, [cart, total, orderNote, paymentMethod, discount, isSubmitting, submitOrder, showToast, t]);

  const categories = useMemo(
    () => [...new Set(activeProducts.map((p) => (p.category && p.category.trim()) ? p.category.trim() : '其他'))],
    [activeProducts]
  );

  useEffect(() => {
    if (!showCheckoutConfirm) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setShowCheckoutConfirm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCheckoutConfirm]);

  useEffect(() => {
    if (showCheckoutConfirm && confirmBackRef.current) confirmBackRef.current.focus();
  }, [showCheckoutConfirm]);

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-4rem)] sm:h-[calc(100vh-5rem)] min-h-0">
      {/* 今日營業摘要 */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-white/80 rounded-xl border border-stone-200 shrink-0">
        <span className="text-stone-600 font-medium text-sm sm:text-base">{t('todaySales')}</span>
        <div className="flex gap-4 sm:gap-6 text-sm sm:text-base">
          <span className="text-stone-700"><span className="text-stone-500">{t('ordersCount')} </span><strong>{todayReport.count}</strong></span>
          <span className="text-amber-800 font-semibold">NT$ {todayReport.total}</span>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 gap-3 sm:gap-5 overflow-hidden">
      {/* 商品區：保證最小寬高，預覽與小視窗也能看清 */}
      <div className="flex-1 min-w-0 lg:min-w-[320px] min-h-[280px] card-market rounded-2xl p-4 sm:p-6 overflow-y-auto overflow-x-hidden">
        <h1 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-5 text-stone-800" style={{ fontFamily: 'var(--font-cute)' }}>
          {t('productArea')}
        </h1>
        {activeProducts.length === 0 ? (
          <p className="text-stone-500 text-sm sm:text-base">{t('noProductsHint')}</p>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {categories.length > 0 && categories.map((cat) => (
              <div key={cat}>
                <h2 className="text-sm font-medium text-stone-500 mb-2 sm:mb-3 uppercase tracking-wider">{cat}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                  {activeProducts
                    .filter((p) => (cat === '其他' ? !(p.category && p.category.trim()) : p.category === cat))
                    .map((product) => (
                      <button
                        key={product.id}
                        onClick={() => addToCart(product)}
                        type="button"
                        className="card-market rounded-xl sm:rounded-2xl overflow-hidden text-left hover:border-amber-300 hover:shadow-md active:scale-[0.98] transition border flex flex-col min-h-[140px] sm:min-h-[180px]"
                      >
                        <div className="w-full aspect-square bg-stone-100 flex-shrink-0 min-h-[80px] sm:min-h-[100px]">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-300 text-2xl sm:text-3xl font-serif">
                              {product.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="p-2.5 sm:p-3 flex flex-col flex-1 min-w-0">
                          <span className="font-semibold text-stone-800 truncate text-sm sm:text-base">{product.name}</span>
                          {product.description && (
                            <span className="text-xs text-stone-500 mt-0.5 line-clamp-2 hidden sm:block">{product.description}</span>
                          )}
                          <span className="text-amber-700 font-bold mt-auto pt-1.5 sm:pt-2 text-sm sm:text-base">NT$ {product.price}</span>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 購物車 + 結帳 */}
      <div className="w-full lg:max-w-[400px] lg:min-w-[320px] card-market rounded-2xl p-4 sm:p-6 flex flex-col min-h-0 shrink-0 lg:shrink-0">
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 border-b border-stone-200 pb-2 sm:pb-3 text-stone-800">{t('cart')}</h2>
        <div className="flex-1 overflow-y-auto space-y-2 sm:space-y-3 min-h-0 max-h-[40vh] lg:max-h-none">
          {cart.length === 0 ? (
            <p className="text-stone-400 text-center py-6 sm:mt-10 text-sm">{t('cartEmpty')}</p>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex justify-between items-center gap-2 sm:gap-3 bg-stone-50/80 p-2.5 sm:p-3 rounded-xl">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden bg-stone-200 flex-shrink-0">
                  {item.image ? (
                    <img src={item.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm">{item.name.charAt(0)}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-stone-800 truncate text-sm sm:text-base">{item.name}</div>
                  <div className="text-xs sm:text-sm text-stone-500">NT$ {item.price} × {item.qty}</div>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <button type="button" onClick={() => updateQty(item.id, -1)} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-stone-200 hover:bg-stone-300 active:bg-stone-400 text-stone-700 font-bold touch-target flex items-center justify-center" aria-label="-">−</button>
                  <span className="w-6 sm:w-8 text-center font-medium text-sm">{item.qty}</span>
                  <button type="button" onClick={() => updateQty(item.id, 1)} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-stone-200 hover:bg-stone-300 active:bg-stone-400 text-stone-700 font-bold touch-target flex items-center justify-center" aria-label="+">+</button>
                  <span className="font-semibold text-stone-800 w-12 sm:w-16 text-right text-sm">NT$ {item.price * item.qty}</span>
                  <button type="button" onClick={() => removeFromCart(item.id)} className="text-amber-800/80 hover:text-red-600 text-xs sm:text-sm px-1 min-w-[32px] min-h-[32px] flex items-center justify-center">{t('remove')}</button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-stone-200 space-y-2 sm:space-y-3 shrink-0">
          <div>
            <label className="block text-xs sm:text-sm text-stone-600 mb-1">{t('paymentMethod')}</label>
            <div className="flex gap-2 flex-wrap">
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPaymentMethod(opt.id)}
                  className={`flex-1 min-w-[70px] sm:min-w-[80px] py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-medium transition min-h-[44px] ${
                    paymentMethod === opt.id ? 'btn-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs sm:text-sm text-stone-600 mb-1">{t('orderNote')}</label>
            <input type="text" value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder={t('orderNotePlaceholder')} className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-stone-600">
              <span>{t('discount')}</span>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <select value={discountType} onChange={(e) => setDiscountType(e.target.value)} className="border border-stone-300 rounded-lg px-2 py-1 text-sm min-h-[36px]">
                  <option value="none">{t('discountNone')}</option>
                  <option value="amount">{t('discountAmount')}</option>
                  <option value="percent">{t('discountPercent')}</option>
                </select>
                {(discountType === 'amount' || discountType === 'percent') && (
                  <input
                    type="number"
                    min={0}
                    step={discountType === 'percent' ? 1 : 1}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === 'percent' ? '10' : '50'}
                    className="w-20 border border-stone-300 rounded-lg px-2 py-1 text-sm min-h-[36px]"
                  />
                )}
              </div>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-amber-700">
                <span>{t('discountDeduct')}</span>
                <span>- NT$ {discountAmount}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-stone-600 text-sm sm:text-base">{t('total')}</span>
            <span className="text-xl sm:text-2xl font-bold text-amber-800">NT$ {total}</span>
          </div>
          <button
            type="button"
            onClick={openCheckoutConfirm}
            disabled={cart.length === 0 || total === 0 || isSubmitting}
            className="btn-primary w-full py-3 sm:py-4 rounded-xl text-base sm:text-lg font-semibold min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-[0.98]"
          >
            {isSubmitting ? '...' : t('checkout')}
          </button>
        </div>
      </div>

      </div>

      {/* 結帳確認防呆彈窗 */}
      {showCheckoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowCheckoutConfirm(false)}>
          <div className="modal-panel bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="confirm-checkout-title">
            <div className="p-5 border-b border-stone-200">
              <h3 id="confirm-checkout-title" className="text-lg font-semibold text-stone-800">{t('confirmCheckoutTitle')}</h3>
              <p className="text-sm text-stone-500 mt-1">{t('confirmCheckoutHint')}</p>
            </div>
            <div className="p-5 space-y-3 max-h-[50vh] overflow-y-auto">
              <div className="text-sm text-stone-600">
                {t('confirmCheckoutItems')}：{cart.length} {t('confirmCheckoutItemCount')}，{cart.reduce((s, i) => s + i.qty, 0)} {t('confirmCheckoutQty')}
              </div>
              {subtotal !== total && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-600">{t('subtotal')}</span>
                    <span>NT$ {subtotal}</span>
                  </div>
                  <div className="flex justify-between text-sm text-amber-700">
                    <span>{t('discount')}</span>
                    <span>- NT$ {subtotal - total}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-semibold text-base pt-2 border-t border-stone-100">
                <span className="text-stone-700">{t('total')}</span>
                <span className="text-amber-800">NT$ {total}</span>
              </div>
              <div className="flex justify-between text-sm text-stone-600">
                <span>{t('paymentMethod')}</span>
                <span>{t(paymentMethod === 'line' ? 'payLine' : paymentMethod === 'card' ? 'payCard' : 'payCash')}</span>
              </div>
              {orderNote.trim() && (
                <div className="text-sm text-stone-600">
                  <span className="text-stone-500">{t('note')}：</span>{orderNote.trim()}
                </div>
              )}
            </div>
            <div className="p-4 flex gap-3 border-t border-stone-200 bg-stone-50/50">
              <button
                ref={confirmBackRef}
                type="button"
                onClick={() => setShowCheckoutConfirm(false)}
                className="flex-1 py-3 rounded-xl font-medium bg-stone-200 text-stone-700 hover:bg-stone-300 min-h-[48px]"
                aria-label={t('confirmCheckoutBack')}
              >
                {t('confirmCheckoutBack')}
              </button>
              <button
                type="button"
                onClick={handleConfirmCheckout}
                className="flex-1 py-3 rounded-xl font-semibold btn-primary text-white min-h-[48px]"
              >
                {t('confirmCheckoutBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptOrder && (
        <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />
      )}
    </div>
  );
}
