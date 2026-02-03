import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useLocale } from '../context/LocaleContext';

export default function CategoryManager() {
  const { categories, products, addCategory, removeCategory, updateCategory } = useStore();
  const { t } = useLocale();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');

  const countByCategory = (name) => products.filter((p) => p.category === name).length;

  const handleAdd = (e) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (trimmed) {
      addCategory(trimmed);
      setNewName('');
    }
  };

  const startEdit = (name) => {
    setEditing(name);
    setEditValue(name);
  };

  const saveEdit = () => {
    if (editing && editValue.trim() && editValue.trim() !== editing) {
      updateCategory(editing, editValue.trim());
    }
    setEditing(null);
    setEditValue('');
  };

  const handleDelete = (name) => {
    if (window.confirm(t('confirmDeleteCategory'))) {
      removeCategory(name);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-stone-800 mb-6">{t('mainCategories')}</h2>

      <form onSubmit={handleAdd} className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('categoryNamePlaceholder')}
          className="border border-stone-300 rounded-xl px-4 py-2 w-48"
        />
        <button type="submit" className="btn-primary px-4 py-2 rounded-xl font-medium">
          {t('addCategory')}
        </button>
      </form>

      {categories.length === 0 ? (
        <p className="text-stone-500 py-8">{t('noCategoriesYet')}</p>
      ) : (
        <ul className="space-y-2">
          {categories.map((name) => (
            <li
              key={name}
              className="flex items-center justify-between gap-4 py-3 px-4 bg-stone-50 rounded-xl border border-stone-100"
            >
              {editing === name ? (
                <>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 border border-stone-300 rounded-lg px-3 py-2"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={saveEdit} className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-sm">
                      {t('save')}
                    </button>
                    <button type="button" onClick={() => { setEditing(null); setEditValue(''); }} className="px-3 py-1.5 bg-stone-200 rounded-lg text-sm">
                      {t('cancel')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="font-medium text-stone-800">{name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-stone-500">
                      {t('categoryInUse').replace('{n}', countByCategory(name))}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(name)}
                      className="text-sm px-3 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800"
                    >
                      {t('edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(name)}
                      className="text-sm px-3 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-700"
                    >
                      {t('delete')}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
