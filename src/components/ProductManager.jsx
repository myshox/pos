import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocale } from '../context/LocaleContext';
import { useToast } from '../context/ToastContext';
import { fileToDataUrl } from '../lib/imageUtils';

const PRODUCT_VIEW_KEY = 'admin_product_view';

export default function ProductManager() {
  const { products, categories, addProduct, updateProduct, toggleProductActive, deleteProduct } = useStore();
  const { t } = useLocale();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(null);
  const defaultCategory = categories.length > 0 ? categories[0] : '';
  const [form, setForm] = useState({ name: '', sku: '', price: '', category: defaultCategory, description: '', image: null, useStock: false, stock: 0 });
  const [isAdding, setIsAdding] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [imageError, setImageError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [failedImages, setFailedImages] = useState(() => new Set());
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem(PRODUCT_VIEW_KEY) === 'list' ? 'list' : 'cards'; } catch { return 'cards'; }
  });
  const formRef = useRef(null);

  const categoryOptions = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products]
  );
  const filteredProducts = useMemo(() => {
    if (!categoryFilter) return products;
    return products.filter((p) => p.category === categoryFilter);
  }, [products, categoryFilter]);

  const openAdd = () => {
    setForm({ name: '', sku: '', price: '', category: defaultCategory, description: '', image: null, useStock: false, stock: 0 });
    setEditing(null);
    setIsAdding(true);
    setIsDuplicate(false);
    setImageError('');
  };

  /** 複製：帶入內容並走「新增」流程（新 ID） */
  const openDuplicate = (product) => {
    const baseSku = (product.sku && String(product.sku).trim()) ? `${String(product.sku).trim()}-copy` : '';
    setForm({
      name: `${product.name}${t('copySuffix')}`,
      sku: baseSku,
      price: String(product.price),
      category: product.category || defaultCategory,
      description: product.description || '',
      image: product.image || null,
      useStock: !!product.useStock,
      stock: typeof product.stock === 'number' ? product.stock : 0,
    });
    setEditing(null);
    setIsAdding(true);
    setIsDuplicate(true);
    setImageError('');
    showToast(t('duplicateProductHint'));
  };

  const openEdit = (product) => {
    setForm({
      name: product.name,
      sku: product.sku ?? '',
      price: String(product.price),
      category: product.category || defaultCategory,
      description: product.description || '',
      image: product.image || null,
      useStock: !!product.useStock,
      stock: typeof product.stock === 'number' ? product.stock : 0,
    });
    setEditing(product.id);
    setIsAdding(false);
    setIsDuplicate(false);
    setImageError('');
    setPendingDeleteId(null);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const closeForm = () => {
    setEditing(null);
    setIsAdding(false);
    setIsDuplicate(false);
    setForm({ name: '', sku: '', price: '', category: defaultCategory, description: '', image: null, useStock: false, stock: 0 });
    setImageError('');
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError('');
    fileToDataUrl(file)
      .then((dataUrl) => setForm((f) => ({ ...f, image: dataUrl })))
      .catch((err) => setImageError(err.message || t('imageError')));
    e.target.value = '';
  };

  const clearImage = () => {
    setForm((f) => ({ ...f, image: null }));
    setImageError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const sku = form.sku?.trim() ?? '';
    const price = Math.round(Number(form.price));
    const category = form.category?.trim() || defaultCategory || '';
    const description = form.description.trim();
    const image = form.image || undefined;
    const useStock = !!form.useStock;
    const stock = Math.max(0, Math.floor(Number(form.stock) || 0));
    if (!name) { showToast(t('validationProductName'), 'error'); return; }
    if (Number.isNaN(price) || price < 0) { showToast(t('validationPrice'), 'error'); return; }
    if (isAdding) {
      addProduct({ name, sku, price, category, description, image, isActive: true, useStock, stock });
      showToast(isDuplicate ? t('toastDuplicateSaved') : t('toastSaved'));
      closeForm();
    } else if (editing) {
      updateProduct(editing, { name, sku, price, category, description, image: image ?? '', useStock, stock });
      showToast(t('toastProductUpdated'));
      closeForm();
    }
  };

  const handleToggle = (product) => {
    toggleProductActive(product.id);
    showToast(t(product.isActive ? 'toastProductUnlisted' : 'toastProductListed'));
  };

  const handleDelete = (product) => {
    deleteProduct(product.id);
    setPendingDeleteId(null);
    showToast(t('toastProductDeleted'));
  };

  const markImageFailed = (id) => {
    setFailedImages((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  };

  const changeViewMode = (mode) => {
    setViewMode(mode);
    try { localStorage.setItem(PRODUCT_VIEW_KEY, mode); } catch { /* empty */ }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-between sm:items-center gap-3 mb-4 md:mb-6">
        <h2 className="text-xl font-semibold text-slate-800">{t('tabProducts')}</h2>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="admin-view-switch" aria-label={t('viewMode')}>
            <button type="button" aria-pressed={viewMode === 'cards'} onClick={() => changeViewMode('cards')} className={viewMode === 'cards' ? 'is-active' : ''}>{t('cardView')}</button>
            <button type="button" aria-pressed={viewMode === 'list'} onClick={() => changeViewMode('list')} className={viewMode === 'list' ? 'is-active' : ''}>{t('listView')}</button>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white min-h-[44px] w-full sm:w-auto"
          >
            <option value="">{t('allCategories')}</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={openAdd}
            className="btn-primary px-4 py-2.5 rounded-xl font-medium min-h-[44px] w-full sm:w-auto"
          >
            {t('addProduct')}
          </button>
        </div>
      </div>

      {(isAdding || editing) && (
        <form ref={formRef} onSubmit={handleSubmit} className="mb-6 p-5 card-market rounded-2xl space-y-4 scroll-mt-28">
          <h3 className="font-semibold text-slate-700">
            {editing ? t('editProductTitle') : isDuplicate ? t('duplicateProductTitle') : t('addProductTitle')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">{t('productName')}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-3 py-2"
                placeholder={t('productNamePlaceholder')}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">{t('sku')}</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-3 py-2"
                placeholder={t('skuPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">{t('price')}</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-3 py-2"
                placeholder="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">{t('category')}</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-3 py-2"
              >
                {categories.length === 0 ? (
                  <option value="" disabled>{t('noCategoriesYet')}</option>
                ) : (
                  categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))
                )}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1">{t('description')}</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-3 py-2"
                placeholder={t('descriptionPlaceholder')}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useStock"
                checked={form.useStock}
                onChange={(e) => setForm((f) => ({ ...f, useStock: e.target.checked }))}
                className="rounded border-slate-300"
              />
              <label htmlFor="useStock" className="text-sm font-medium text-slate-600">{t('productUseStock')}</label>
            </div>
            {form.useStock && (
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">{t('productStock')}</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>
            )}
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-sm font-medium text-slate-600 mb-1">{t('productImage')}</label>
              <div className="flex flex-wrap items-start gap-4">
                {form.image ? (
                  <div className="relative">
                    <img
                      src={form.image}
                      alt="預覽"
                      className="w-24 h-24 object-cover rounded-xl border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-sm hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ) : null}
                <label className="cursor-pointer px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-700">
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  {form.image ? t('changeImage') : t('uploadImage')}
                </label>
              </div>
              {imageError && <p className="text-red-600 text-sm mt-1">{imageError}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary px-4 py-2 rounded-xl">
              {isAdding ? (isDuplicate ? t('duplicateProductSave') : t('add')) : t('save')}
            </button>
            <button type="button" onClick={closeForm} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl">
              {t('cancel')}
            </button>
          </div>
        </form>
      )}

      {/* 篩選後無商品 */}
      {products.length > 0 && filteredProducts.length === 0 && (
        <div className="py-10 text-center">
          <p className="text-slate-500">{t('noProductsInCategory')}</p>
        </div>
      )}

      {filteredProducts.length > 0 && (
        <div className={`product-admin-grid ${viewMode === 'list' ? 'is-list' : ''}`}>
          {filteredProducts.map((p) => {
            const showImage = p.image && !failedImages.has(p.id);
            const confirmingDelete = pendingDeleteId === p.id;
            return (
              <article key={p.id} className={`product-admin-card ${p.isActive ? '' : 'is-off-sale'}`}>
                <div className="product-admin-media">
                  {showImage ? (
                    <img src={p.image} alt={p.name} loading="lazy" onError={() => markImageFailed(p.id)} />
                  ) : (
                    <div className="product-admin-no-image"><span>{p.name?.charAt(0) || '—'}</span><small>{t('noImage')}</small></div>
                  )}
                  <span className={`product-admin-status ${p.isActive ? 'is-live' : ''}`}>{p.isActive ? t('onSale') : t('offSale')}</span>
                </div>
                <div className="product-admin-body">
                  <div className="min-w-0">
                    <h3 title={p.name}>{p.name}</h3>
                    <p>{p.category || '—'}{p.sku ? ` · ${p.sku}` : ''}</p>
                  </div>
                  <strong>NT$ {p.price}</strong>
                  {p.description && <p className="product-admin-description">{p.description}</p>}
                  {p.useStock && <p className={p.stock < 5 ? 'product-admin-stock is-low' : 'product-admin-stock'}>{t('productColStock')} {p.stock}</p>}
                </div>
                {confirmingDelete ? (
                  <div className="product-admin-confirm" role="alert">
                    <p>{t('confirmDeleteProduct')}</p>
                    <div>
                      <button type="button" onClick={() => setPendingDeleteId(null)}>{t('cancel')}</button>
                      <button type="button" className="is-danger" onClick={() => handleDelete(p)}>{t('confirmDelete')}</button>
                    </div>
                  </div>
                ) : (
                  <div className="product-admin-actions" aria-label={`${p.name} ${t('actions')}`}>
                    <button type="button" onClick={() => handleToggle(p)}>{p.isActive ? t('setOffSale') : t('setOnSale')}</button>
                    <button type="button" className="is-primary" onClick={() => openEdit(p)}>{t('edit')}</button>
                    <button type="button" onClick={() => openDuplicate(p)}>{t('duplicateProduct')}</button>
                    <button type="button" className="is-danger" onClick={() => setPendingDeleteId(p.id)}>{t('delete')}</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {products.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-slate-500">{t('noProducts')}</p>
          <p className="text-slate-400 text-sm mt-2">{t('emptyProductsHintAdmin')}</p>
        </div>
      )}
    </div>
  );
}
