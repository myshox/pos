import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocale } from '../context/LocaleContext';
import { useToast } from '../context/ToastContext';
import { fileToDataUrl } from '../lib/imageUtils';

export default function ProductManager() {
  const { products, categories, addProduct, updateProduct, toggleProductActive, deleteProduct } = useStore();
  const { t } = useLocale();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(null);
  const defaultCategory = categories.length > 0 ? categories[0] : '';
  const [form, setForm] = useState({ name: '', sku: '', price: '', category: defaultCategory, description: '', image: null, useStock: false, stock: 0 });
  const [isAdding, setIsAdding] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [imageError, setImageError] = useState('');

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
    setImageError('');
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
    setImageError('');
  };

  const closeForm = () => {
    setEditing(null);
    setIsAdding(false);
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
    const price = Number(form.price);
    const category = form.category?.trim() || defaultCategory || '';
    const description = form.description.trim();
    const image = form.image || undefined;
    const useStock = !!form.useStock;
    const stock = Math.max(0, Math.floor(Number(form.stock) || 0));
    if (!name) { showToast(t('validationProductName'), 'error'); return; }
    if (Number.isNaN(price) || price < 0) { showToast(t('validationPrice'), 'error'); return; }
    if (isAdding) {
      addProduct({ name, sku, price, category, description, image, isActive: true, useStock, stock });
      closeForm();
    } else if (editing) {
      updateProduct(editing, { name, sku, price, category, description, image: image ?? '', useStock, stock });
      closeForm();
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-between sm:items-center gap-3 mb-4 md:mb-6">
        <h2 className="text-xl font-semibold text-stone-800">{t('tabProducts')}</h2>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-stone-300 rounded-xl px-3 py-2.5 text-sm bg-white min-h-[44px] w-full sm:w-auto"
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
        <form onSubmit={handleSubmit} className="mb-6 p-5 card-market rounded-2xl space-y-4">
          <h3 className="font-semibold text-stone-700">{isAdding ? t('addProductTitle') : t('editProductTitle')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">{t('productName')}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-stone-300 rounded-xl px-3 py-2"
                placeholder={t('productNamePlaceholder')}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">{t('sku')}</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                className="w-full border border-stone-300 rounded-xl px-3 py-2"
                placeholder={t('skuPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">{t('price')}</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="w-full border border-stone-300 rounded-xl px-3 py-2"
                placeholder="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">{t('category')}</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full border border-stone-300 rounded-xl px-3 py-2"
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
              <label className="block text-sm font-medium text-stone-600 mb-1">{t('description')}</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-stone-300 rounded-xl px-3 py-2"
                placeholder={t('descriptionPlaceholder')}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useStock"
                checked={form.useStock}
                onChange={(e) => setForm((f) => ({ ...f, useStock: e.target.checked }))}
                className="rounded border-stone-300"
              />
              <label htmlFor="useStock" className="text-sm font-medium text-stone-600">{t('productUseStock')}</label>
            </div>
            {form.useStock && (
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">{t('productStock')}</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2"
                />
              </div>
            )}
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-sm font-medium text-stone-600 mb-1">{t('productImage')}</label>
              <div className="flex flex-wrap items-start gap-4">
                {form.image ? (
                  <div className="relative">
                    <img
                      src={form.image}
                      alt="預覽"
                      className="w-24 h-24 object-cover rounded-xl border border-stone-200"
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
                <label className="cursor-pointer px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-xl text-sm font-medium text-stone-700">
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  {form.image ? t('changeImage') : t('uploadImage')}
                </label>
              </div>
              {imageError && <p className="text-red-600 text-sm mt-1">{imageError}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary px-4 py-2 rounded-xl">
              {isAdding ? t('add') : t('save')}
            </button>
            <button type="button" onClick={closeForm} className="px-4 py-2 bg-stone-200 hover:bg-stone-300 rounded-xl">
              {t('cancel')}
            </button>
          </div>
        </form>
      )}

      {/* 手機／平板：卡片列表 */}
      <div className="lg:hidden space-y-3">
        {filteredProducts.map((p) => (
          <article
            key={p.id}
            className="card-market rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
          >
            <div className="flex gap-3 min-w-0 flex-1">
              {p.image ? (
                <img src={p.image} alt="" className="w-16 h-16 sm:w-14 sm:h-14 object-cover rounded-lg flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 sm:w-14 sm:h-14 rounded-lg bg-stone-200 flex items-center justify-center text-stone-400 text-sm flex-shrink-0">{t('noImage')}</div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-stone-800 truncate">{p.name}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="category-badge px-2 py-0.5 rounded-lg text-xs">{p.category || '—'}</span>
                  <span className="text-amber-700 font-semibold text-sm">NT$ {p.price}</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.isActive ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    {p.isActive ? t('onSale') : t('offSale')}
                  </span>
                  {p.useStock && (
                    <span className={`text-xs ${p.stock < 5 ? 'text-red-600 font-medium' : 'text-stone-500'}`}>
                      {t('productColStock')} {p.stock}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:flex-shrink-0 border-t border-stone-100 pt-3 sm:pt-0 sm:border-t-0">
              <button
                type="button"
                onClick={() => toggleProductActive(p.id)}
                className="flex-1 sm:flex-none min-h-[44px] px-3 py-2 rounded-xl text-sm bg-stone-200 hover:bg-stone-300"
              >
                {p.isActive ? t('setOffSale') : t('setOnSale')}
              </button>
              <button
                type="button"
                onClick={() => openEdit(p)}
                className="flex-1 sm:flex-none min-h-[44px] px-3 py-2 rounded-xl text-sm bg-amber-100 hover:bg-amber-200 text-amber-800"
              >
                {t('edit')}
              </button>
              <button
                type="button"
                onClick={() => window.confirm(t('confirmDeleteProduct')) && deleteProduct(p.id)}
                className="flex-1 sm:flex-none min-h-[44px] px-3 py-2 rounded-xl text-sm bg-red-100 hover:bg-red-200 text-red-700"
              >
                {t('delete')}
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* 桌機：表格 */}
      <div className="hidden lg:block overflow-x-auto -mx-1">
        <table className="w-full text-left min-w-[880px]">
          <thead>
            <tr className="border-b-2 border-stone-200 bg-stone-50/80">
              <th className="py-3 px-2 text-stone-600 font-medium text-sm whitespace-nowrap w-14" title={t('image')}>{t('image')}</th>
              <th className="py-3 px-2 text-stone-600 font-medium text-sm whitespace-nowrap w-12" title={t('id')}>{t('id')}</th>
              <th className="py-3 px-2 text-stone-600 font-medium text-sm whitespace-nowrap w-16" title={t('sku')}>{t('sku')}</th>
              <th className="py-3 px-2 text-stone-600 font-medium text-sm whitespace-nowrap min-w-[72px]" title={t('productName')}>{t('productName')}</th>
              <th className="py-3 px-2 text-stone-600 font-medium text-sm whitespace-nowrap min-w-[56px]" title={t('category')}>{t('category')}</th>
              <th className="py-3 px-2 text-stone-600 font-medium text-sm whitespace-nowrap min-w-[52px]" title={t('description')}>{t('productColDesc')}</th>
              <th className="py-3 px-2 text-stone-600 font-medium text-sm whitespace-nowrap w-20" title={t('price')}>{t('price')}</th>
              <th className="py-3 px-2 text-stone-600 font-medium text-sm whitespace-nowrap w-16" title={t('status')}>{t('status')}</th>
              <th className="py-3 px-2 text-stone-600 font-medium text-sm whitespace-nowrap w-14" title={t('productStock')}>{t('productColStock')}</th>
              <th className="py-3 px-2 text-stone-600 font-medium text-sm whitespace-nowrap w-[180px]" title={t('actions')}>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => (
              <tr key={p.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                <td className="py-2.5 px-2 align-middle">
                  {p.image ? (
                    <img src={p.image} alt="" className="w-11 h-11 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-stone-200 flex items-center justify-center text-stone-400 text-xs">{t('noImage')}</div>
                  )}
                </td>
                <td className="py-2.5 px-2 text-stone-500 text-xs truncate align-middle" title={String(p.id)}>{String(p.id).slice(0, 6)}</td>
                <td className="py-2.5 px-2 text-stone-600 text-sm font-mono truncate align-middle">{p.sku || '—'}</td>
                <td className="py-2.5 px-2 font-medium text-stone-800 text-sm truncate align-middle" title={p.name}>{p.name}</td>
                <td className="py-2.5 px-2 align-middle">
                  <span className="category-badge px-2 py-0.5 rounded-lg text-xs whitespace-nowrap inline-block max-w-full truncate" title={p.category}>{p.category || '—'}</span>
                </td>
                <td className="py-2.5 px-2 text-stone-600 text-xs truncate align-middle" title={p.description || ''}>{p.description || '—'}</td>
                <td className="py-2.5 px-2 text-stone-700 text-sm whitespace-nowrap align-middle">NT$ {p.price}</td>
                <td className="py-2.5 px-2 align-middle">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                      p.isActive ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    {p.isActive ? t('onSale') : t('offSale')}
                  </span>
                </td>
                <td className="py-2.5 px-2 text-sm align-middle">
                  {p.useStock ? (
                    <span className={`whitespace-nowrap ${p.stock < 5 ? 'text-red-600 font-medium' : 'text-stone-700'}`}>{p.stock}</span>
                  ) : (
                    <span className="text-stone-400">—</span>
                  )}
                </td>
                <td className="py-2.5 px-2 align-middle">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleProductActive(p.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 whitespace-nowrap"
                    >
                      {p.isActive ? t('setOffSale') : t('setOnSale')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 whitespace-nowrap"
                    >
                      {t('edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.confirm(t('confirmDeleteProduct')) && deleteProduct(p.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 whitespace-nowrap"
                    >
                      {t('delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {products.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-stone-500">{t('noProducts')}</p>
          <p className="text-stone-400 text-sm mt-2">{t('emptyProductsHintAdmin')}</p>
        </div>
      )}
    </div>
  );
}
