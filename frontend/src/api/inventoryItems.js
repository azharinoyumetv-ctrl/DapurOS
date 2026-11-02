import api from './client';
import { loadCatalogue } from './catalogue';
import { isPlanLocked } from '@/navigation/sections';
import { readCollection } from './records';

export async function loadInventoryItems(plan) {
  const [products, ingredients] = await Promise.all([
    loadCatalogue(),
    isPlanLocked('pro', plan) ? [] : readCollection('/ingredients').then(r => r.data),
  ]);
  return [
    ...products.filter(p => !p.recipe?.length).map(p => ({ ...p, kind: 'product', key: p.id })),
    ...ingredients.map(p => ({ ...p, kind: 'ingredient', key: `ingredient:${p.id}` })),
  ];
}

export const inventoryError = error => typeof error?.response?.data?.detail === 'string'
  ? error.response.data.detail : 'Data belum dapat disimpan. Periksa koneksi lalu coba lagi.';
