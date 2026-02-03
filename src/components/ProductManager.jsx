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
  const [form, setForm] = useState({ name: '', price: '', category: defaultCategory, description: '', image: null, useStock: false, stock: 0 });
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
    setForm({ name: '', price: '', category: defaultCategory, description: '', image: null, useStock: false, stock: 0 });
    setEditing(null);
    setIsAdding(true);
    setImageError('');
  };

  const openEdit = (product) => {
    setForm({
      name: product.name,
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
    setForm({ name: '', price: '', category: defaultCategory, description: '', image: null, useStock: false, stock: 0 });
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
    const price = Number(form.price);
    const category = form.category?.trim() || defaultCategory || '';
    const description = form.description.trim();
    const image = form.image || undefined;
    const useStock = !!form.useStock;
    const stock = Math.max(0, Math.floor(Number(form.stock) || 0));
    if (!name) { showToast(t('validationProductName'), 'error'); return; }
    if (Number.isNaN(price) || price < 0) { showToast(t('validationPrice'), 'error'); return; }
    if (isAdding) {
      addProduct({ name, price, category, description, image, isActive: true, useStock, stock });
      closeForm();
    } else if (editing) {
      updateProduct(editing, { name, price, category, description, image: image ?? '', useStock, stock });
      closeForm();
    }
  };

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h2 className="text-xl font-semibold text-stone-800">{t('tabProducts')}</h2>
        <div className="flex gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-stone-300 rounded-xl px-3 py-2 text-sm bg-white"
          >
            <option value="">{t('allCategories')}</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={openAdd}
            className="btn-primary px-4 py-2 rounded-xl font-medium"
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

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="pb-3 text-stone-600 font-medium w-16">{t('image')}</th>
              <th className="pb-3 text-stone-600 font-medium">{t('id')}</th>
              <th className="pb-3 text-stone-600 font-medium">{t('productName')}</th>
              <th className="pb-3 text-stone-600 font-medium">{t('category')}</th>
              <th className="pb-3 text-stone-600 font-medium">{t('description')}</th>
              <th className="pb-3 text-stone-600 font-medium">{t('price')}</th>
              <th className="pb-3 text-stone-600 font-medium">{t('status')}</th>
              <th className="pb-3 text-stone-600 font-medium">{t('productStock')}</th>
              <th className="pb-3 text-stone-600 font-medium">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => (
              <tr key={p.id} className="border-b border-stone-100">
                <td className="py-3">
                  {p.image ? (
                    <img src={p.image} alt="" className="w-12 h-12 object-cover rounded-lg" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-stone-200 flex items-center justify-center text-stone-400 text-xs">{t('noImage')}</div>
                  )}
                </td>
                <td className="py-3 text-stone-500">{p.id}</td>
                <td className="py-3 font-medium text-stone-800">{p.name}</td>
                <td className="py-3">
                  <span className="category-badge px-2 py-0.5 rounded-lg text-sm">{p.category}</span>
                </td>
                <td className="py-3 text-stone-600 text-sm max-w-[180px] truncate">{p.description || '—'}</td>
                <td className="py-3 text-stone-700">NT$ {p.price}</td>
                <td className="py-3">
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-sm ${
                      p.isActive ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    {p.isActive ? t('onSale') : t('offSale')}
                  </span>
                </td>
                <td className="py-3">
                  {p.useStock ? (
                    <span className={p.stock < 5 ? 'text-red-600 font-medium' : 'text-stone-700'}>{p.stock}</span>
                  ) : (
                    <span className="text-stone-400">—</span>
                  )}
                </td>
                <td className="py-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleProductActive(p.id)}
                    className="text-sm px-3 py-1 rounded-lg bg-stone-200 hover:bg-stone-300"
                  >
                    {p.isActive ? t('setOffSale') : t('setOnSale')}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="text-sm px-3 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800"
                  >
                    {t('edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.confirm(t('confirmDeleteProduct')) && deleteProduct(p.id)}
                    className="text-sm px-3 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-700"
                  >
                    {t('delete')}
                  </button>
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
