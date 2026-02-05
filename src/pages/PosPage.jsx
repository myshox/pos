import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocale } from '../context/LocaleContext';
import { useToast } from '../context/ToastContext';
import ReceiptModal from '../components/ReceiptModal';
import { getDailyReport } from '../lib/reportUtils';

const PAYMENT_STORAGE_KEY = 'pos_last_payment';
const FONT_SIZE_STORAGE_KEY = 'pos_font_size';
const PRODUCT_VIEW_STORAGE_KEY = 'pos_product_view';
const SHOW_PRODUCT_IMAGE_STORAGE_KEY = 'pos_show_product_image';

const PAYMENT_OPTIONS = [
  { id: 'line', labelKey: 'payLine', activeClass: 'bg-green-600 hover:bg-green-700 text-white', inactiveClass: 'bg-green-50 text-green-800 border border-green-200 hover:bg-green-100' },
  { id: 'cash', labelKey: 'payCash', activeClass: 'bg-amber-600 hover:bg-amber-700 text-white', inactiveClass: 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100' },
  { id: 'card', labelKey: 'payCard', activeClass: 'bg-blue-600 hover:bg-blue-700 text-white', inactiveClass: 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100' },
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
  const [showDiscountPrompt, setShowDiscountPrompt] = useState(false);
  const [discountType, setDiscountType] = useState('none');
  const [discountValue, setDiscountValue] = useState('');
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [fontSize, setFontSize] = useState(() => {
    try {
      const s = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (['small', 'medium', 'large'].includes(s)) return s;
    } catch (_) {}
    return 'medium';
  });
  const [productViewMode, setProductViewMode] = useState(() => {
    try {
      const s = localStorage.getItem(PRODUCT_VIEW_STORAGE_KEY);
      if (['grid', 'list'].includes(s)) return s;
    } catch (_) {}
    return 'grid';
  });
  const [showProductImage, setShowProductImage] = useState(() => {
    try {
      const s = localStorage.getItem(SHOW_PRODUCT_IMAGE_STORAGE_KEY);
      if (s === '0' || s === 'false') return false;
      if (s === '1' || s === 'true') return true;
    } catch (_) {}
    return true;
  });
  const [discountSectionExpanded, setDiscountSectionExpanded] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const confirmBackRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(PAYMENT_STORAGE_KEY, paymentMethod); } catch (_) {}
  }, [paymentMethod]);

  useEffect(() => {
    try { localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize); } catch (_) {}
  }, [fontSize]);

  useEffect(() => {
    try { localStorage.setItem(PRODUCT_VIEW_STORAGE_KEY, productViewMode); } catch (_) {}
  }, [productViewMode]);

  useEffect(() => {
    try { localStorage.setItem(SHOW_PRODUCT_IMAGE_STORAGE_KEY, showProductImage ? '1' : '0'); } catch (_) {}
  }, [showProductImage]);

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

  const addProductDirect = useCallback((product) => {
    addToCartWithQty(product, 1);
    setShowCartDrawer(true);
    showToast(`${product.name} × 1 ${t('addToCart')}`);
  }, [addToCartWithQty, showToast, t]);

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
    setShowDiscountPrompt(true);
  }, [cart, products, total, showToast, t]);

  const handleConfirmCheckout = useCallback(() => {
    if (cart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setTimeout(() => {
      const newOrder = submitOrder(cart, total, orderNote.trim(), paymentMethod, discount);
      setReceiptOrder(newOrder);
      setCart([]);
      setOrderNote('');
      setDiscountType('none');
      setDiscountValue('');
      setShowCheckoutConfirm(false);
      setShowCartDrawer(false);
      showToast(t('toastCheckoutSuccess'));
      setTimeout(() => setIsSubmitting(false), 300);
    }, 80);
  }, [cart, total, orderNote, paymentMethod, discount, isSubmitting, submitOrder, showToast, t]);

  const categories = useMemo(
    () => [...new Set(activeProducts.map((p) => (p.category && p.category.trim()) ? p.category.trim() : '其他'))],
    [activeProducts]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (showDiscountPrompt) setShowDiscountPrompt(false);
      else if (showCheckoutConfirm) setShowCheckoutConfirm(false);
    };
    if (showDiscountPrompt || showCheckoutConfirm) {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [showDiscountPrompt, showCheckoutConfirm]);

  useEffect(() => {
    if (showCheckoutConfirm && confirmBackRef.current) confirmBackRef.current.focus();
  }, [showCheckoutConfirm]);

  useEffect(() => {
    if (!showCartDrawer) setConfirmRemoveId(null);
  }, [showCartDrawer]);

  return (
    <div className={`flex flex-col h-[calc(100vh-4rem)] sm:h-[calc(100vh-5rem)] min-h-0 overflow-hidden`}>
      {/* 注意：iOS 上父層有 transform 會影響 fixed/點擊座標。
          因此縮放只套用在「主內容」，固定抽屜/彈窗不套用縮放。 */}
      <div className={`pos-font-scaler pos-font-${fontSize} flex flex-col flex-1 min-h-0 ${fontSize === 'large' ? 'overflow-auto' : 'overflow-hidden'}`}>
        {/* 今日營業摘要 + 字型大小：手機兩行、桌機一行 */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 px-3 sm:px-4 py-2.5 bg-white/80 rounded-xl border border-stone-200 shrink-0 mx-2 sm:mx-3 mt-1">
          <div className="flex items-center gap-3">
            <span className="text-stone-600 font-medium text-sm">{t('todaySales')}</span>
            <span className="text-stone-700 text-sm"><span className="text-stone-500">{t('ordersCount')} </span><strong>{todayReport.count}</strong></span>
            <span className="text-amber-800 font-semibold text-sm">NT$ {todayReport.total}</span>
          </div>
          <div className="flex items-center gap-1.5 border-t border-stone-100 pt-2 sm:pt-0 sm:border-t-0">
            <span className="text-stone-500 text-xs">{t('fontSize')}</span>
            {['small', 'medium', 'large'].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setFontSize(size)}
                className={`min-w-[2.25rem] sm:min-w-[2.5rem] py-1.5 px-2 rounded-lg text-xs font-medium transition min-h-[36px] ${
                  fontSize === size ? 'btn-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {size === 'small' ? t('fontSizeSmall') : size === 'medium' ? t('fontSizeMedium') : t('fontSizeLarge')}
              </button>
            ))}
          </div>
        </div>

        {/* 商品區 - 獨立一頁，全區塊捲動 */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 sm:px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="text-xl sm:text-2xl font-semibold text-stone-800" style={{ fontFamily: 'var(--font-cute)' }}>
            {t('productArea')}
          </h1>
          {activeProducts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-stone-500 text-xs">{t('productViewLabel')}</span>
              <div className="flex rounded-lg overflow-hidden border border-stone-200">
                <button
                  type="button"
                  onClick={() => setProductViewMode('grid')}
                  className={productViewMode === 'grid' ? 'py-1.5 px-3 text-xs font-medium transition min-h-[44px] sm:min-h-[40px] btn-primary text-white' : 'py-1.5 px-3 text-xs font-medium transition min-h-[44px] sm:min-h-[40px] bg-stone-50 text-stone-600 hover:bg-stone-100'}
                >
                  {t('productViewGrid')}
                </button>
                <button
                  type="button"
                  onClick={() => setProductViewMode('list')}
                  className={productViewMode === 'list' ? 'py-1.5 px-3 text-xs font-medium transition min-h-[44px] sm:min-h-[40px] btn-primary text-white' : 'py-1.5 px-3 text-xs font-medium transition min-h-[44px] sm:min-h-[40px] bg-stone-50 text-stone-600 hover:bg-stone-100'}
                >
                  {t('productViewList')}
                </button>
              </div>
              <span className="text-stone-500 text-xs ml-1">{t('showProductImage')}</span>
              <div className="flex rounded-lg overflow-hidden border border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowProductImage(true)}
                  className={showProductImage ? 'py-1.5 px-3 text-xs font-medium transition min-h-[44px] sm:min-h-[40px] btn-primary text-white' : 'py-1.5 px-3 text-xs font-medium transition min-h-[44px] sm:min-h-[40px] bg-stone-50 text-stone-600 hover:bg-stone-100'}
                >
                  {t('showProductImage')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowProductImage(false)}
                  className={!showProductImage ? 'py-1.5 px-3 text-xs font-medium transition min-h-[44px] sm:min-h-[40px] btn-primary text-white' : 'py-1.5 px-3 text-xs font-medium transition min-h-[44px] sm:min-h-[40px] bg-stone-50 text-stone-600 hover:bg-stone-100'}
                >
                  {t('hideProductImage')}
                </button>
              </div>
            </div>
          )}
        </div>
        {activeProducts.length === 0 ? (
          <p className="text-stone-500 text-sm">{t('noProductsHint')}</p>
        ) : productViewMode === 'list' ? (
          <div className="space-y-4">
            {categories.length > 0 && categories.map((cat) => (
              <div key={cat}>
                <h2 className="text-sm font-medium text-stone-500 mb-2 uppercase tracking-wider">{cat}</h2>
                <div className="space-y-1">
                  {activeProducts
                    .filter((p) => (cat === '其他' ? !(p.category && p.category.trim()) : p.category === cat))
                    .map((product) => (
                      <button
                        key={product.id}
                        onClick={() => addProductDirect(product)}
                        type="button"
                        className="card-market w-full rounded-lg overflow-hidden text-left hover:border-amber-300 hover:shadow-md active:scale-[0.99] transition border flex flex-row items-center gap-3 p-2 sm:p-3 min-h-[56px]"
                      >
                        {showProductImage && (
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-stone-100 flex-shrink-0 overflow-hidden">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-300 text-lg font-serif">
                                {product.name.charAt(0)}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex-1 min-w-0 text-left">
                          <span className="font-semibold text-stone-800 truncate block text-sm sm:text-base">{product.name}</span>
                          {product.sku && (
                            <span className="text-xs text-stone-500 font-mono">{product.sku}</span>
                          )}
                        </div>
                        <span className="text-amber-700 font-bold text-sm sm:text-base flex-shrink-0">NT$ {product.price}</span>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
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
                        onClick={() => addProductDirect(product)}
                        type="button"
                        className="card-market rounded-lg overflow-hidden text-left hover:border-amber-300 hover:shadow-md active:scale-[0.98] transition border flex flex-col min-h-[100px] sm:min-h-[110px]"
                      >
                        {showProductImage && (
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
                        )}
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
      </div>

      {/* 浮動購物車按鈕 */}
      <button
        type="button"
        onClick={() => setShowCartDrawer(true)}
        className="fixed z-40 h-14 sm:h-16 rounded-full btn-primary shadow-lg flex items-center justify-center text-white hover:opacity-95 active:scale-95 transition floating-cart-btn px-4 sm:px-5 gap-2"
        aria-label={t('cartCount').replace('{n}', String(cartTotalQty))}
        title={t('cartCount').replace('{n}', String(cartTotalQty))}
      >
        <span className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden bg-white/15 flex-shrink-0">
          <img
            src="/cart-hams.png"
            alt=""
            className="w-full h-full object-cover"
            draggable="false"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </span>
        <span className="font-extrabold text-base sm:text-lg tracking-wide whitespace-nowrap">
          {t('checkout')}
        </span>
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
          <div className="relative ml-auto w-full sm:max-w-md max-h-[90vh] sm:max-h-full bg-white rounded-t-2xl sm:rounded-l-2xl sm:rounded-tr-none shadow-xl flex flex-col min-h-0">
            <div className="flex items-center justify-center relative p-4 border-b border-stone-200 shrink-0">
              <h2 className="text-lg font-semibold text-stone-800">{t('cart')}</h2>
              <button type="button" onClick={() => setShowCartDrawer(false)} className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full hover:bg-stone-100 text-stone-600 min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0" aria-label={t('close')}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* 結帳總金額置頂讓客人確認 */}
            {cart.length > 0 && (
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 shrink-0 min-w-0">
                <div className="text-center min-w-0">
                  <div className="text-sm text-stone-500 mb-1">{t('total')}</div>
                  <div className="overflow-x-auto overflow-y-hidden text-center" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <span className="inline-block text-2xl sm:text-4xl font-bold text-amber-800 whitespace-nowrap">NT$ {total}</span>
                  </div>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-3 min-h-0 bg-stone-100/50 snap-y snap-mandatory scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
              {cart.length === 0 ? (
                <p className="text-stone-400 text-center py-8 text-sm">{t('cartEmpty')}</p>
              ) : (
                cart.map((item) => (
                  <article key={item.id} className="flex gap-2 sm:gap-3 items-center bg-white border-2 border-stone-200 p-3 rounded-xl shadow-md snap-start shrink-0 min-w-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0 ring-1 ring-stone-200/80">
                      {item.image ? (
                        <img src={item.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400 font-medium">{item.name.charAt(0)}</div>
                      )}
                    </div>
                    <span className="font-semibold text-stone-800 text-sm truncate min-w-0 flex-1">{item.name}</span>
                    <span className="text-sm font-semibold text-amber-800 shrink-0 tabular-nums">NT$ {item.price * item.qty}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => updateQty(item.id, -1)} className="w-9 h-9 rounded-full bg-stone-200 hover:bg-stone-300 active:bg-stone-400 text-stone-700 font-bold flex items-center justify-center text-sm" aria-label="-">−</button>
                      <span className="w-7 text-center font-semibold text-sm tabular-nums">{item.qty}</span>
                      <button type="button" onClick={() => updateQty(item.id, 1)} className="w-9 h-9 rounded-full bg-stone-200 hover:bg-stone-300 active:bg-stone-400 text-stone-700 font-bold flex items-center justify-center text-sm" aria-label="+">+</button>
                    </div>
                    {confirmRemoveId === item.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => { removeFromCart(item.id); setConfirmRemoveId(null); }} className="text-red-600 text-xs font-medium px-2 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 min-h-[36px] flex items-center justify-center" aria-label={t('confirmRemoveItem')}>
                          {t('confirmRemoveItem')}
                        </button>
                        <button type="button" onClick={() => setConfirmRemoveId(null)} className="text-stone-600 text-xs font-medium px-2 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 min-h-[36px] flex items-center justify-center" aria-label={t('cancel')}>
                          {t('cancel')}
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmRemoveId(item.id)} className="text-amber-800/80 hover:text-red-600 text-xs font-medium px-2 py-1.5 rounded-lg hover:bg-red-50 min-h-[36px] flex items-center justify-center shrink-0" aria-label={t('remove')}>
                        {t('remove')}
                      </button>
                    )}
                  </article>
                ))
              )}
            </div>
            <div className="p-4 pt-3 border-t border-stone-200 space-y-3 shrink-0 bg-stone-50/50 cart-drawer-footer overflow-y-auto max-h-[50vh] min-h-0">
              <div>
                <label className="block text-xs text-stone-600 mb-1">{t('paymentMethod')}</label>
                <div className="flex gap-2 flex-wrap">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPaymentMethod(opt.id)}
                      className={`flex-1 min-w-[80px] py-3 rounded-xl text-sm font-medium transition min-h-[48px] ${paymentMethod === opt.id ? opt.activeClass : opt.inactiveClass}`}
                    >
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-stone-600 mb-1">{t('orderNote')}</label>
                <input type="text" value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder={t('orderNotePlaceholder')} className="w-full border border-stone-300 rounded-xl px-4 py-3 text-base min-h-[48px]" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-600 font-medium text-base">{t('total')}</span>
                <span className="text-3xl sm:text-4xl font-bold text-amber-800">NT$ {total}</span>
              </div>
              <button
                type="button"
                onClick={openCheckoutConfirm}
                disabled={cart.length === 0 || total === 0 || isSubmitting}
                className={`btn-primary w-full py-4 rounded-2xl text-xl font-extrabold min-h-[64px] disabled:opacity-45 disabled:cursor-not-allowed transition transform active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg ${
                  cart.length > 0 && total > 0 && !isSubmitting ? 'ring-2 ring-amber-200/80' : 'ring-0'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{t('checkoutProcessing')}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>{t('checkout')}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowCartDrawer(false)}
                className="w-full py-3.5 rounded-xl font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 flex items-center justify-center gap-2 min-h-[48px] transition"
                aria-label={t('backToPrev')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                <span>{t('backToPrev')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 結帳後：是否有折扣？小視窗 */}
      {showDiscountPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={() => setShowDiscountPrompt(false)}>
          <div className="modal-panel bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="discount-prompt-title">
            <div className="p-5 border-b border-stone-200">
              <h3 id="discount-prompt-title" className="text-lg font-semibold text-stone-800">{t('discountPromptTitle')}</h3>
              <p className="text-sm text-stone-500 mt-1">{t('discountPromptHint')}</p>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-xs text-stone-600 mb-1.5">{t('discountQuick')}</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => applyQuickDiscount('percent', 10)} className="px-4 py-3 rounded-xl text-sm font-medium bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-800 border border-transparent hover:border-amber-200 min-h-[48px]">
                    {t('discount9off')}
                  </button>
                  <button type="button" onClick={() => applyQuickDiscount('percent', 5)} className="px-4 py-3 rounded-xl text-sm font-medium bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-800 border border-transparent hover:border-amber-200 min-h-[48px]">
                    {t('discount95off')}
                  </button>
                  <button type="button" onClick={() => applyQuickDiscount('amount', 50)} className="px-4 py-3 rounded-xl text-sm font-medium bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-800 border border-transparent hover:border-amber-200 min-h-[48px]">
                    {t('discount50')}
                  </button>
                  <button type="button" onClick={() => applyQuickDiscount('amount', 100)} className="px-4 py-3 rounded-xl text-sm font-medium bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-800 border border-transparent hover:border-amber-200 min-h-[48px]">
                    {t('discount100')}
                  </button>
                  <button type="button" onClick={() => applyQuickDiscount('none')} className="px-4 py-3 rounded-xl text-sm font-medium bg-stone-100 hover:bg-stone-200 text-stone-600 min-h-[48px]">
                    {t('discountClear')}
                  </button>
                </div>
              </div>
              <div className="border-t border-stone-100 pt-3">
                <button
                  type="button"
                  onClick={() => setDiscountSectionExpanded((e) => !e)}
                  className="w-full flex items-center justify-between py-2 text-sm font-medium text-stone-600 hover:text-stone-800 rounded-lg hover:bg-stone-50 min-h-[44px]"
                  aria-expanded={discountSectionExpanded}
                >
                  <span>{t('discountCustom')}</span>
                  <svg className={`w-5 h-5 transition-transform ${discountSectionExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {discountSectionExpanded && (
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between text-sm text-stone-600 items-center flex-wrap gap-2">
                      <span>{t('discount')}</span>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <select value={discountType} onChange={(e) => setDiscountType(e.target.value)} className="border border-stone-300 rounded-xl px-3 py-2 text-base min-h-[48px]">
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
                            className="w-24 border border-stone-300 rounded-xl px-3 py-2 text-base min-h-[48px]"
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
                )}
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-stone-100">
                <span className="text-stone-600 font-medium">{t('total')}</span>
                <span className="text-2xl font-bold text-amber-800">NT$ {total}</span>
              </div>
            </div>
            <div className="p-5 border-t border-stone-200 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDiscountPrompt(false)}
                className="flex-1 py-3 rounded-xl font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 min-h-[48px] transition"
              >
                {t('backToPrev')}
              </button>
              <button
                type="button"
                onClick={() => { setShowDiscountPrompt(false); setShowCheckoutConfirm(true); }}
                className="flex-1 py-3 rounded-xl font-semibold bg-amber-600 text-white hover:bg-amber-700 min-h-[48px] transition"
              >
                {t('discountNextStep')}
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
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl font-semibold btn-primary text-white min-h-[48px] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{t('checkoutProcessing')}</span>
                  </>
                ) : (
                  t('confirmCheckoutBtn')
                )}
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
