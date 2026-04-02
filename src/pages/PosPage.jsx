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
  { id: 'line', labelKey: 'payLine', activeClass: 'bg-emerald-500 hover:bg-emerald-600 text-white', inactiveClass: 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100' },
  { id: 'cash', labelKey: 'payCash', activeClass: 'bg-amber-500 hover:bg-amber-600 text-white', inactiveClass: 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100' },
  { id: 'card', labelKey: 'payCard', activeClass: 'bg-violet-500 hover:bg-violet-600 text-white', inactiveClass: 'bg-violet-50 text-violet-800 border border-violet-200 hover:bg-violet-100' },
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
    } catch { /* empty */ }
    return 'line';
  });
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [cashReceived, setCashReceived] = useState('');
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [fontSize, setFontSize] = useState(() => {
    try {
      const s = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (['small', 'medium', 'large'].includes(s)) return s;
    } catch { /* empty */ }
    return 'medium';
  });
  const [productViewMode, setProductViewMode] = useState(() => {
    try {
      const s = localStorage.getItem(PRODUCT_VIEW_STORAGE_KEY);
      if (['grid', 'list'].includes(s)) return s;
    } catch { /* empty */ }
    return 'grid';
  });
  const [showProductImage, setShowProductImage] = useState(() => {
    try {
      const s = localStorage.getItem(SHOW_PRODUCT_IMAGE_STORAGE_KEY);
      if (s === '0' || s === 'false') return false;
      if (s === '1' || s === 'true') return true;
    } catch { /* empty */ }
    return true;
  });
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const confirmBackRef = useRef(null);
  const productSearchInputRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(PAYMENT_STORAGE_KEY, paymentMethod); } catch { /* empty */ }
  }, [paymentMethod]);

  useEffect(() => {
    try { localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize); } catch { /* empty */ }
  }, [fontSize]);

  useEffect(() => {
    try { localStorage.setItem(PRODUCT_VIEW_STORAGE_KEY, productViewMode); } catch { /* empty */ }
  }, [productViewMode]);

  useEffect(() => {
    try { localStorage.setItem(SHOW_PRODUCT_IMAGE_STORAGE_KEY, showProductImage ? '1' : '0'); } catch { /* empty */ }
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

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart]);
  const cartTotalQty = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);
  const cashReceivedNum = Number(cashReceived) || 0;
  const changeAmount = cashReceivedNum >= total ? Math.round((cashReceivedNum - total) * 100) / 100 : 0;
  const quickCashAmounts = useMemo(() => {
    if (total <= 0) return [];
    const amounts = [100, 500, 1000, 2000, 5000];
    const rounded = Math.ceil(total / 100) * 100;
    const result = new Set();
    if (rounded > total) result.add(rounded);
    amounts.forEach((a) => { if (a >= total) result.add(a); });
    return [...result].sort((a, b) => a - b).slice(0, 5);
  }, [total]);

  const addProductDirect = useCallback((product) => {
    addToCartWithQty(product, 1);
    showToast(`${product.name} × 1 ${t('addToCart')}`);
  }, [addToCartWithQty, showToast, t]);

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
    setCashReceived('');
    setShowCheckoutConfirm(true);
  }, [cart, products, total, showToast, t]);

  const handleConfirmCheckout = useCallback(() => {
    if (cart.length === 0 || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setTimeout(() => {
      try {
        const cashInfo = paymentMethod === 'cash' && cashReceivedNum > 0 ? { cashReceived: cashReceivedNum, changeAmount } : null;
        const newOrder = submitOrder(cart, total, orderNote.trim(), paymentMethod, cashInfo);
        setReceiptOrder(newOrder);
        setCart([]);
        setOrderNote('');
        setCashReceived('');
        setShowCheckoutConfirm(false);
        setShowCartDrawer(false);
        showToast(t('toastCheckoutSuccess'));
      } catch {
        showToast(t('checkoutError') || '結帳失敗，請重試', 'error');
      } finally {
        setTimeout(() => { submittingRef.current = false; setIsSubmitting(false); }, 300);
      }
    }, 80);
  }, [cart, total, orderNote, paymentMethod, cashReceivedNum, changeAmount, submitOrder, showToast, t]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return activeProducts;
    return activeProducts.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const cat = ((p.category && p.category.trim()) ? p.category.trim() : '其他').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      return name.includes(q) || cat.includes(q) || sku.includes(q) || desc.includes(q);
    });
  }, [activeProducts, productSearch]);

  const categories = useMemo(
    () => [...new Set(filteredProducts.map((p) => (p.category && p.category.trim()) ? p.category.trim() : '其他'))],
    [filteredProducts]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (showCheckoutConfirm) setShowCheckoutConfirm(false);
    };
    if (showCheckoutConfirm) {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [showCheckoutConfirm]);

  useEffect(() => {
    if (showCheckoutConfirm && confirmBackRef.current) confirmBackRef.current.focus();
  }, [showCheckoutConfirm]);

  useEffect(() => {
    if (!showCartDrawer) setConfirmRemoveId(null);
  }, [showCartDrawer]);

  /* 快速聚焦搜尋：/（不在輸入框、且未開彈窗時） */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (showCheckoutConfirm || showCartDrawer) return;
      if (activeProducts.length === 0) return;
      e.preventDefault();
      productSearchInputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCheckoutConfirm, showCartDrawer, activeProducts.length]);

  return (
    <div className={`flex flex-col h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-5rem)] min-h-0`}>
      {/* 注意：iOS 上父層有 transform 會影響 fixed/點擊座標。
          因此縮放只套用在「主內容」，固定抽屜/彈窗不套用縮放。 */}
      <div className={`pos-font-scaler pos-font-${fontSize} flex flex-col flex-1 min-h-0 ${fontSize === 'large' ? 'overflow-auto' : 'overflow-hidden'}`}>
        {/* 今日營業摘要 + 字型大小：手機兩行、桌機一行 */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 px-3 sm:px-4 py-2.5 bg-white rounded-xl border border-slate-200/90 shadow-sm ring-1 ring-slate-200/40 shrink-0 mx-2 sm:mx-3 mt-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
            <span className="text-slate-600 font-medium text-sm shrink-0">{t('todaySales')}</span>
            <span className="text-slate-700 text-sm min-w-0"><span className="text-slate-500">{t('ordersCount')} </span><strong>{todayReport.count}</strong></span>
            <span className="text-slate-800 font-semibold text-sm tabular-nums whitespace-nowrap">NT$ {todayReport.total}</span>
          </div>
          <div className="flex items-center gap-1.5 border-t border-slate-100 pt-2 sm:pt-0 sm:border-t-0">
            <span className="text-slate-500 text-xs">{t('fontSize')}</span>
            {['small', 'medium', 'large'].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setFontSize(size)}
                className={`min-w-[2.25rem] sm:min-w-[2.5rem] py-1.5 px-2 rounded-lg text-xs font-medium transition min-h-[36px] ${
                  fontSize === size ? 'btn-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {size === 'small' ? t('fontSizeSmall') : size === 'medium' ? t('fontSizeMedium') : t('fontSizeLarge')}
              </button>
            ))}
          </div>
        </div>

        {/* 商品區 - 獨立一頁，全區塊捲動（底部留白避免被浮動結帳鈕遮字） */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 sm:px-4 py-3 pos-product-scroll">
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 shrink-0" style={{ fontFamily: 'var(--font-cute)' }}>
            {t('productArea')}
          </h1>
          {activeProducts.length > 0 && (
            <div className="flex flex-col gap-2 w-full min-w-0 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
              <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500 text-xs shrink-0">{t('productViewLabel')}</span>
              <div className="flex rounded-xl overflow-hidden border border-slate-200/90 bg-slate-50/90 p-0.5 gap-0.5 shadow-inner shrink-0">
                <button
                  type="button"
                  onClick={() => setProductViewMode('grid')}
                  className={productViewMode === 'grid' ? 'rounded-lg py-1.5 px-3 text-xs font-medium transition min-h-[44px] sm:min-h-[40px] btn-primary text-white shadow-sm' : 'rounded-lg py-1.5 px-3 text-xs font-medium transition min-h-[44px] sm:min-h-[40px] bg-transparent text-slate-600 hover:bg-white/80'}
                >
                  {t('productViewGrid')}
                </button>
                <button
                  type="button"
                  onClick={() => setProductViewMode('list')}
                  className={productViewMode === 'list' ? 'rounded-lg py-1.5 px-3 text-xs font-medium transition min-h-[44px] sm:min-h-[40px] btn-primary text-white shadow-sm' : 'rounded-lg py-1.5 px-3 text-xs font-medium transition min-h-[44px] sm:min-h-[40px] bg-transparent text-slate-600 hover:bg-white/80'}
                >
                  {t('productViewList')}
                </button>
              </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500 text-xs shrink-0">{t('showProductImage')}</span>
              <div className="flex rounded-xl overflow-hidden border border-slate-200/90 bg-slate-50/90 p-0.5 gap-0.5 shadow-inner shrink-0">
                <button
                  type="button"
                  onClick={() => setShowProductImage(true)}
                  className={showProductImage ? 'rounded-lg py-1.5 px-3 text-xs font-medium transition min-h-[44px] sm:min-h-[40px] btn-primary text-white shadow-sm' : 'rounded-lg py-1.5 px-3 text-xs font-medium transition min-h-[44px] sm:min-h-[40px] bg-transparent text-slate-600 hover:bg-white/80'}
                >
                  {t('showProductImage')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowProductImage(false)}
                  className={!showProductImage ? 'rounded-lg py-1.5 px-3 text-xs font-medium transition min-h-[44px] sm:min-h-[40px] btn-primary text-white shadow-sm' : 'rounded-lg py-1.5 px-3 text-xs font-medium transition min-h-[44px] sm:min-h-[40px] bg-transparent text-slate-600 hover:bg-white/80'}
                >
                  {t('hideProductImage')}
                </button>
              </div>
              </div>
            </div>
          )}
        </div>
        {activeProducts.length > 0 && (
          <p className="text-sm text-slate-500 mb-3 max-w-2xl leading-relaxed">{t('checkoutFlowHint')}</p>
        )}
        {activeProducts.length > 0 && (
          <div className="relative w-full max-w-2xl mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              ref={productSearchInputRef}
              type="search"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder={t('productSearchPlaceholder')}
              autoComplete="off"
              enterKeyHint="search"
              aria-label={t('productSearchPlaceholder')}
              className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 py-3 text-base text-slate-800 placeholder:text-slate-400 min-h-[48px] shadow-sm transition focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500"
            />
            {productSearch.trim() !== '' && (
              <button
                type="button"
                onClick={() => { setProductSearch(''); productSearchInputRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={t('productSearchClear')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        )}
        {activeProducts.length === 0 ? (
          <p className="text-slate-500 text-sm">{t('noProductsHint')}</p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-slate-500 text-sm py-8 text-center">{t('productSearchNoResults')}</p>
        ) : productViewMode === 'list' ? (
          <div className="space-y-4">
            {categories.length > 0 && categories.map((cat) => (
              <div key={cat}>
                <h2 className="pos-category-heading mb-2">{cat}</h2>
                <div className="space-y-1">
                  {filteredProducts
                    .filter((p) => (cat === '其他' ? !(p.category && p.category.trim()) : p.category === cat))
                    .map((product) => (
                      <button
                        key={product.id}
                        onClick={() => addProductDirect(product)}
                        type="button"
                        className="card-market w-full rounded-xl overflow-hidden text-left border border-slate-200 hover:border-teal-300/90 hover:shadow-md active:scale-[0.99] transition-all duration-200 flex flex-row items-center gap-3 p-2 sm:p-3 min-h-[56px]"
                      >
                        {showProductImage && (
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300 text-lg font-serif">
                                {product.name.charAt(0)}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex-1 min-w-0 text-left">
                          <span className="font-semibold text-slate-800 truncate block text-sm sm:text-base">{product.name}</span>
                          {product.sku && (
                            <span className="text-xs text-slate-500 font-mono">{product.sku}</span>
                          )}
                        </div>
                        <span className="text-teal-700 font-bold text-sm sm:text-base flex-shrink-0">NT$ {product.price}</span>
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
                <h2 className="pos-category-heading mb-3">{cat}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                  {filteredProducts
                    .filter((p) => (cat === '其他' ? !(p.category && p.category.trim()) : p.category === cat))
                    .map((product) => (
                      <button
                        key={product.id}
                        onClick={() => addProductDirect(product)}
                        type="button"
                        className="card-market rounded-xl overflow-hidden text-left border border-slate-200 hover:border-teal-300/90 hover:shadow-md active:scale-[0.98] transition-all duration-200 flex flex-col min-h-[108px] sm:min-h-[110px]"
                      >
                        {showProductImage && (
                          <div className="w-full aspect-square bg-slate-100 flex-shrink-0 min-h-[56px] sm:min-h-[60px]">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300 text-lg sm:text-xl font-serif">
                                {product.name.charAt(0)}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="p-1.5 sm:p-2 flex flex-col flex-1 min-w-0">
                          <span className="font-semibold text-slate-800 line-clamp-2 text-left text-xs sm:text-sm leading-snug">{product.name}</span>
                          {product.sku && (
                            <span className="text-[10px] sm:text-xs text-slate-500 font-mono mt-0.5">{product.sku}</span>
                          )}
                          <span className="text-teal-700 font-bold mt-auto pt-1 text-xs sm:text-sm">NT$ {product.price}</span>
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
        className="fixed z-40 h-14 sm:h-16 rounded-full btn-primary shadow-lg flex items-center justify-center text-white hover:opacity-95 transition floating-cart-btn px-4 sm:px-5 gap-2 max-w-[min(100vw-2rem,20rem)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900/20 touch-manipulation"
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
        <span className="font-extrabold text-base sm:text-lg tracking-wide truncate min-w-0 text-left">
          {t('checkout')}
        </span>
        {cartTotalQty > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center">
            {cartTotalQty > 99 ? '99+' : cartTotalQty}
          </span>
        )}
      </button>

      {/* 購物車抽屜 */}
      {showCartDrawer && (
        <div className="fixed inset-0 z-50 flex flex-col sm:flex-row" aria-modal="true">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] sm:backdrop-blur-sm" onClick={() => setShowCartDrawer(false)} aria-hidden="true" />
          <div className="relative ml-auto w-full sm:max-w-md md:max-w-lg max-h-[92dvh] sm:max-h-full sm:h-full sm:min-h-0 bg-white rounded-t-2xl sm:rounded-l-2xl sm:rounded-tr-none shadow-2xl ring-1 ring-slate-900/5 flex flex-col min-h-0">
            <div className="flex items-center justify-center relative p-4 pr-14 border-b border-slate-200 shrink-0">
              <h2 className="text-lg font-semibold text-slate-800 text-center px-2">{t('cart')}</h2>
              <button type="button" onClick={() => setShowCartDrawer(false)} className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full hover:bg-slate-100 text-slate-600 min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0 z-10" aria-label={t('close')}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* 結帳總金額置頂讓客人確認 */}
            {cart.length > 0 && (
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0 min-w-0">
                <div className="text-center min-w-0">
                  <div className="text-sm text-slate-500 mb-1">{t('total')}</div>
                  <div className="overflow-x-auto overflow-y-hidden text-center" style={{ WebkitOverflowScrolling: 'touch' }}>
                    <span className="inline-block text-3xl sm:text-4xl font-bold text-slate-800 whitespace-nowrap">NT$ {total}</span>
                  </div>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-3 min-h-0 bg-slate-100/50 snap-y snap-mandatory scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
              {cart.length === 0 ? (
                <p className="text-slate-400 text-center py-8 text-sm">{t('cartEmpty')}</p>
              ) : (
                cart.map((item) => (
                  <article key={item.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 bg-white border border-slate-200/95 p-3 rounded-xl shadow-sm ring-1 ring-slate-900/[0.04] snap-start shrink-0 min-w-0">
                    <div className="flex gap-2 sm:gap-3 items-start sm:items-center flex-1 min-w-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 ring-1 ring-slate-200/80">
                        {item.image ? (
                          <img src={item.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium">{item.name.charAt(0)}</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-slate-800 text-sm line-clamp-2 sm:truncate leading-snug block">{item.name}</span>
                        <span className="text-xs text-slate-500 tabular-nums mt-0.5 block sm:hidden">NT$ {item.price} × {item.qty}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-800 shrink-0 tabular-nums sm:hidden">NT$ {item.price * item.qty}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end sm:gap-3 sm:flex-nowrap sm:shrink-0">
                      <span className="hidden sm:inline text-sm font-semibold text-slate-800 shrink-0 tabular-nums order-first sm:order-none">NT$ {item.price * item.qty}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => updateQty(item.id, -1)} className="w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 font-bold flex items-center justify-center text-sm touch-manipulation" aria-label="-">−</button>
                        <span className="w-8 text-center font-semibold text-sm tabular-nums">{item.qty}</span>
                        <button type="button" onClick={() => updateQty(item.id, 1)} className="w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 font-bold flex items-center justify-center text-sm touch-manipulation" aria-label="+">+</button>
                      </div>
                      {confirmRemoveId === item.id ? (
                        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                          <button type="button" onClick={() => { removeFromCart(item.id); setConfirmRemoveId(null); }} className="text-red-600 text-xs font-medium px-3 py-2 rounded-lg bg-red-100 hover:bg-red-200 min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-0 flex items-center justify-center" aria-label={t('confirmRemoveItem')}>
                            {t('confirmRemoveItem')}
                          </button>
                          <button type="button" onClick={() => setConfirmRemoveId(null)} className="text-slate-600 text-xs font-medium px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-0 flex items-center justify-center" aria-label={t('cancel')}>
                            {t('cancel')}
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirmRemoveId(item.id)} className="text-slate-800/80 hover:text-red-600 text-xs font-medium px-3 py-2 rounded-lg hover:bg-red-50 min-h-[44px] sm:min-h-[36px] flex items-center justify-center shrink-0 touch-manipulation" aria-label={t('remove')}>
                          {t('remove')}
                        </button>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
            <div className="p-4 pt-3 border-t border-slate-200 space-y-3 shrink-0 bg-slate-50/50 cart-drawer-footer min-h-0">
              <div>
                <label className="block text-xs text-slate-600 mb-1">{t('paymentMethod')}</label>
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
                <label className="block text-xs text-slate-600 mb-1">{t('orderNote')}</label>
                <input type="text" value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder={t('orderNotePlaceholder')} className="input-pro w-full rounded-xl px-4 py-3 text-base min-h-[48px]" />
              </div>
              <div className="flex justify-between items-baseline gap-2 min-w-0">
                <span className="text-slate-600 font-medium text-base shrink-0">{t('total')}</span>
                <span className="text-3xl sm:text-4xl font-bold text-slate-800 tabular-nums text-right break-all sm:break-normal min-w-0">NT$ {total}</span>
              </div>
              <button
                type="button"
                onClick={openCheckoutConfirm}
                disabled={cart.length === 0 || total === 0 || isSubmitting}
                className={`btn-primary w-full py-4 rounded-2xl text-xl font-extrabold min-h-[64px] disabled:opacity-45 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg touch-manipulation ${
                  cart.length > 0 && total > 0 && !isSubmitting ? 'ring-2 ring-teal-200/80' : 'ring-0'
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
                className="w-full py-3.5 rounded-xl font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center gap-2 min-h-[48px] transition"
                aria-label={t('backToPrev')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                <span>{t('backToPrev')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 結帳確認防呆彈窗 */}
      {showCheckoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" onClick={() => setShowCheckoutConfirm(false)}>
          <div className="modal-panel bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md max-h-[85dvh] flex flex-col min-h-0" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="confirm-checkout-title">
            <div className="p-5 border-b border-slate-200 shrink-0">
              <h3 id="confirm-checkout-title" className="text-lg font-semibold text-slate-800">{t('confirmCheckoutTitle')}</h3>
              <p className="text-sm text-slate-500 mt-1">{t('confirmCheckoutHint')}</p>
            </div>
            <div className="p-5 space-y-3 flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <div className="text-sm text-slate-600">
                {t('confirmCheckoutItems')}：{cart.length} {t('confirmCheckoutItemCount')}，{cart.reduce((s, i) => s + i.qty, 0)} {t('confirmCheckoutQty')}
              </div>
              <div className="flex justify-between font-semibold text-lg pt-2 border-t border-slate-100">
                <span className="text-slate-700">{t('total')}</span>
                <span className="text-xl font-bold text-slate-800">NT$ {total}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>{t('paymentMethod')}</span>
                <span>{t(paymentMethod === 'line' ? 'payLine' : paymentMethod === 'card' ? 'payCard' : 'payCash')}</span>
              </div>
              {paymentMethod === 'cash' && (
                <div className="pt-2 space-y-2">
                  <label className="text-sm font-medium text-slate-600">{t('cashReceived')}</label>
                  <div className="flex flex-wrap gap-2">
                    {quickCashAmounts.map((amt) => (
                      <button key={amt} type="button" onClick={() => setCashReceived(String(amt))} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${String(amt) === cashReceived ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'}`}>
                        NT${amt}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder={t('cashReceivedPlaceholder')}
                    className="input-pro w-full rounded-xl px-4 py-3 text-base min-h-[48px]"
                  />
                  {cashReceivedNum > 0 && cashReceivedNum >= total && (
                    <div className="flex justify-between items-center bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-200">
                      <span className="text-emerald-700 font-medium">{t('changeAmount')}</span>
                      <span className="text-2xl font-bold text-emerald-700">NT$ {changeAmount}</span>
                    </div>
                  )}
                  {cashReceivedNum > 0 && cashReceivedNum < total && (
                    <div className="text-sm text-red-500 font-medium">{t('cashNotEnough')}</div>
                  )}
                </div>
              )}
              {orderNote.trim() && (
                <div className="text-sm text-slate-600 break-words">
                  <span className="text-slate-500">{t('note')}：</span>{orderNote.trim()}
                </div>
              )}
            </div>
            <div className="p-4 flex gap-3 border-t border-slate-200 bg-slate-50/50 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
              <button
                ref={confirmBackRef}
                type="button"
                onClick={() => setShowCheckoutConfirm(false)}
                className="flex-1 py-3 rounded-xl font-medium bg-slate-200 text-slate-700 hover:bg-slate-300 min-h-[48px]"
                aria-label={t('confirmCheckoutBack')}
              >
                {t('confirmCheckoutBack')}
              </button>
              <button
                type="button"
                onClick={handleConfirmCheckout}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl font-semibold btn-primary text-white min-h-[48px] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation"
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
