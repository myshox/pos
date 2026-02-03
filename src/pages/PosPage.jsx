import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocale } from '../context/LocaleContext';
import { useToast } from '../context/ToastContext';
import ReceiptModal from '../components/ReceiptModal';
import { getDailyReport } from '../lib/reportUtils';

const PAYMENT_STORAGE_KEY = 'pos_last_payment';
const FONT_SIZE_STORAGE_KEY = 'pos_font_size';

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
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [confirmProduct, setConfirmProduct] = useState(null);
  const [confirmQty, setConfirmQty] = useState(1);
  const [fontSize, setFontSize] = useState(() => {
    try {
      const s = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (['small', 'medium', 'large'].includes(s)) return s;
    } catch (_) {}
    return 'medium';
  });
  const confirmBackRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(PAYMENT_STORAGE_KEY, paymentMethod); } catch (_) {}
  }, [paymentMethod]);

  useEffect(() => {
    try { localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize); } catch (_) {}
  }, [fontSize]);

  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  const todayReport = useMemo(
    () => getDailyReport(orders, new Date()),
    [orders]
  );

  const addToCartWithQty = useCallback((product, qty) => {
    if (!qty || qty < 1) return;
    const existing = cart.find((item) => item.id === product.id);
    const nextQty = existing ? existing.qty + qty : qty;
    if (product.useStock && typeof product.stock === 'number' && product.stock < nextQty) {
      showToast(t('stockInsufficient'), 'error');
      return;
    }
    if (existing) {
      setCart(cart.map((item) =>
        item.id === product.id ? { ...item, qty: item.qty + qty } : item
      ));
    } else {
      setCart([...cart, { ...product, qty }]);
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
  const cartTotalQty = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  const openProductConfirm = useCallback((product) => {
    setConfirmProduct(product);
    setConfirmQty(1);
  }, []);

  const handleConfirmAddToCart = useCallback(() => {
    if (!confirmProduct || confirmQty < 1) return;
    addToCartWithQty(confirmProduct, confirmQty);
    setConfirmProduct(null);
    setShowCartDrawer(true);
    showToast(`${confirmProduct.name} × ${confirmQty} ${t('addToCart')}`);
  }, [confirmProduct, confirmQty, addToCartWithQty, showToast, t]);

  const applyQuickDiscount = useCallback((type, value) => {
    if (type === 'none') {
      setDiscountType('none');
      setDiscountValue('');
      return;
    }
    setDiscountType(type);
    setDiscountValue(String(value));
  }, []);

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
    setShowCartDrawer(false);
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

  useEffect(() => {
    if (!confirmProduct) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setConfirmProduct(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmProduct]);

  return (
    <div className={`flex flex-col h-[calc(100vh-4rem)] sm:h-[calc(100vh-5rem)] min-h-0 pos-font-${fontSize}`}>
      {/* 今日營業摘要 + 字型大小 */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-white/80 rounded-xl border border-stone-200 shrink-0 mx-2 sm:mx-3 mt-1">
        <span className="text-stone-600 font-medium text-sm">{t('todaySales')}</span>
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <span className="text-stone-700 text-sm"><span className="text-stone-500">{t('ordersCount')} </span><strong>{todayReport.count}</strong></span>
          <span className="text-amber-800 font-semibold text-sm">NT$ {todayReport.total}</span>
          <span className="text-stone-500 text-xs sm:text-sm">|</span>
          <div className="flex items-center gap-1">
            <span className="text-stone-500 text-xs">{t('fontSize')}</span>
            {['small', 'medium', 'large'].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setFontSize(size)}
                className={`min-w-[2rem] sm:min-w-[2.5rem] py-1.5 px-2 rounded-lg text-xs font-medium transition ${
                  fontSize === size ? 'btn-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {size === 'small' ? t('fontSizeSmall') : size === 'medium' ? t('fontSizeMedium') : t('fontSizeLarge')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 商品區 - 獨立一頁，全區塊捲動 */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 sm:px-4 py-3">
        <h1 className="text-xl sm:text-2xl font-semibold mb-4 text-stone-800" style={{ fontFamily: 'var(--font-cute)' }}>
          {t('productArea')}
        </h1>
        {activeProducts.length === 0 ? (
          <p className="text-stone-500 text-sm">{t('noProductsHint')}</p>
        ) : (
          <div className="space-y-6">
            {categories.length > 0 && categories.map((cat) => (
              <div key={cat}>
                <h2 className="text-sm font-medium text-stone-500 mb-3 uppercase tracking-wider">{cat}</h2>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {activeProducts
                    .filter((p) => (cat === '其他' ? !(p.category && p.category.trim()) : p.category === cat))
                    .map((product) => (
                      <button
                        key={product.id}
                        onClick={() => openProductConfirm(product)}
                        type="button"
                        className="card-market rounded-lg overflow-hidden text-left hover:border-amber-300 hover:shadow-md active:scale-[0.98] transition border flex flex-col min-h-[100px] sm:min-h-[110px]"
                      >
                        <div className="w-full aspect-square bg-stone-100 flex-shrink-0 min-h-[56px] sm:min-h-[60px]">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-300 text-lg sm:text-xl font-serif">
                              {product.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="p-1.5 sm:p-2 flex flex-col flex-1 min-w-0">
                          <span className="font-semibold text-stone-800 truncate text-xs sm:text-sm">{product.name}</span>
                          {product.sku && (
                            <span className="text-[10px] sm:text-xs text-stone-500 font-mono mt-0.5">{product.sku}</span>
                          )}
                          <span className="text-amber-700 font-bold mt-auto pt-1 text-xs sm:text-sm">NT$ {product.price}</span>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 浮動購物車按鈕 */}
      <button
        type="button"
        onClick={() => setShowCartDrawer(true)}
        className="fixed bottom-6 right-4 sm:bottom-8 sm:right-6 z-40 w-14 h-14 sm:w-16 sm:h-16 rounded-full btn-primary shadow-lg flex items-center justify-center text-white hover:opacity-95 active:scale-95 transition"
        aria-label={t('cartCount').replace('{n}', String(cartTotalQty))}
        title={t('cartCount').replace('{n}', String(cartTotalQty))}
      >
        <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        {cartTotalQty > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center">
            {cartTotalQty > 99 ? '99+' : cartTotalQty}
          </span>
        )}
      </button>

      {/* 購物車抽屜 */}
      {showCartDrawer && (
        <div className="fixed inset-0 z-50 flex flex-col sm:flex-row" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCartDrawer(false)} aria-hidden="true" />
          <div className="relative ml-auto w-full sm:max-w-md max-h-[90vh] sm:max-h-full bg-white rounded-t-2xl sm:rounded-l-2xl sm:rounded-tr-none shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-stone-200 shrink-0">
              <h2 className="text-lg font-semibold text-stone-800">{t('cart')}</h2>
              <button type="button" onClick={() => setShowCartDrawer(false)} className="p-2 rounded-full hover:bg-stone-100 text-stone-600" aria-label={t('close')}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* 結帳總金額置頂讓客人確認 */}
            {cart.length > 0 && (
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 shrink-0">
                <div className="text-center">
                  <div className="text-xs text-stone-500 mb-0.5">{t('total')}</div>
                  <div className="text-3xl sm:text-4xl font-bold text-amber-800">NT$ {total}</div>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {cart.length === 0 ? (
                <p className="text-stone-400 text-center py-8 text-sm">{t('cartEmpty')}</p>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center gap-2 bg-stone-50/80 p-3 rounded-xl">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-200 flex-shrink-0">
                      {item.image ? (
                        <img src={item.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm">{item.name.charAt(0)}</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-stone-800 truncate">{item.name}</div>
                      <div className="text-xs text-stone-500">NT$ {item.price} × {item.qty}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => updateQty(item.id, -1)} className="w-9 h-9 rounded-full bg-stone-200 hover:bg-stone-300 active:bg-stone-400 text-stone-700 font-bold flex items-center justify-center" aria-label="-">−</button>
                      <span className="w-8 text-center font-medium text-sm">{item.qty}</span>
                      <button type="button" onClick={() => updateQty(item.id, 1)} className="w-9 h-9 rounded-full bg-stone-200 hover:bg-stone-300 active:bg-stone-400 text-stone-700 font-bold flex items-center justify-center" aria-label="+">+</button>
                      <span className="font-semibold text-stone-800 w-14 text-right text-sm">NT$ {item.price * item.qty}</span>
                      <button type="button" onClick={() => removeFromCart(item.id)} className="text-amber-800/80 hover:text-red-600 text-sm px-1 min-w-[32px] min-h-[32px] flex items-center justify-center">{t('remove')}</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-stone-200 space-y-3 shrink-0 bg-stone-50/50">
              <div>
                <label className="block text-xs text-stone-600 mb-1">{t('paymentMethod')}</label>
                <div className="flex gap-2 flex-wrap">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPaymentMethod(opt.id)}
                      className={`flex-1 min-w-[70px] py-2.5 rounded-xl text-xs font-medium transition min-h-[44px] ${paymentMethod === opt.id ? 'btn-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                    >
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-stone-600 mb-1">{t('orderNote')}</label>
                <input type="text" value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder={t('orderNotePlaceholder')} className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm min-h-[44px]" />
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-stone-600 mb-1.5">{t('discountQuick')}</label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => applyQuickDiscount('percent', 10)} className="px-3 py-2 rounded-lg text-sm font-medium bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-800 border border-transparent hover:border-amber-200 min-h-[40px]">
                      {t('discount9off')}
                    </button>
                    <button type="button" onClick={() => applyQuickDiscount('percent', 5)} className="px-3 py-2 rounded-lg text-sm font-medium bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-800 border border-transparent hover:border-amber-200 min-h-[40px]">
                      {t('discount95off')}
                    </button>
                    <button type="button" onClick={() => applyQuickDiscount('amount', 50)} className="px-3 py-2 rounded-lg text-sm font-medium bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-800 border border-transparent hover:border-amber-200 min-h-[40px]">
                      {t('discount50')}
                    </button>
                    <button type="button" onClick={() => applyQuickDiscount('amount', 100)} className="px-3 py-2 rounded-lg text-sm font-medium bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-800 border border-transparent hover:border-amber-200 min-h-[40px]">
                      {t('discount100')}
                    </button>
                    <button type="button" onClick={() => applyQuickDiscount('none')} className="px-3 py-2 rounded-lg text-sm font-medium bg-stone-100 hover:bg-stone-200 text-stone-600 min-h-[40px]">
                      {t('discountClear')}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between text-sm text-stone-600 items-center flex-wrap gap-2">
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
                <span className="text-stone-600 font-medium">{t('total')}</span>
                <span className="text-2xl sm:text-3xl font-bold text-amber-800">NT$ {total}</span>
              </div>
              <button
                type="button"
                onClick={openCheckoutConfirm}
                disabled={cart.length === 0 || total === 0 || isSubmitting}
                className="btn-primary w-full py-3 rounded-xl text-base font-semibold min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-[0.98]"
              >
                {isSubmitting ? '...' : t('checkout')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 確認商品彈窗 - 選數量後加入購物車 */}
      {confirmProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setConfirmProduct(null)}>
          <div className="modal-panel bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="confirm-product-title">
            <div className="p-4 border-b border-stone-200">
              <h3 id="confirm-product-title" className="text-lg font-semibold text-stone-800">{t('confirmProduct')}</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex gap-4">
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-stone-100 flex-shrink-0">
                  {confirmProduct.image ? (
                    <img src={confirmProduct.image} alt={confirmProduct.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-400 text-2xl font-serif">{confirmProduct.name.charAt(0)}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-stone-800">{confirmProduct.name}</div>
                  <div className="text-amber-700 font-bold mt-1">NT$ {confirmProduct.price}</div>
                </div>
              </div>
              <div>
                <label className="block text-sm text-stone-600 mb-2">{t('quantity')}</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setConfirmQty((q) => Math.max(1, q - 1))} className="w-10 h-10 rounded-full bg-stone-200 hover:bg-stone-300 font-bold text-stone-700 flex items-center justify-center">−</button>
                  <span className="w-12 text-center text-lg font-semibold">{confirmQty}</span>
                  <button type="button" onClick={() => setConfirmQty((q) => q + 1)} className="w-10 h-10 rounded-full bg-stone-200 hover:bg-stone-300 font-bold text-stone-700 flex items-center justify-center">+</button>
                </div>
              </div>
            </div>
            <div className="p-4 flex gap-3 border-t border-stone-200 bg-stone-50/50">
              <button type="button" onClick={() => setConfirmProduct(null)} className="flex-1 py-3 rounded-xl font-medium bg-stone-200 text-stone-700 hover:bg-stone-300 min-h-[48px]">
                {t('cancel')}
              </button>
              <button type="button" onClick={handleConfirmAddToCart} className="flex-1 py-3 rounded-xl font-semibold btn-primary text-white min-h-[48px]">
                {t('addToCart')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 結帳確認防呆彈窗 */}
      {showCheckoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={() => setShowCheckoutConfirm(false)}>
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
