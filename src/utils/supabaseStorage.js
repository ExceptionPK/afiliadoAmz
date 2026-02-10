// utils/supabaseStorage.js
import { supabase } from './supabaseClient';
import {
  getHistory,
  addToHistory as addToLocal,
  removeFromHistory as removeFromLocal,
  clearHistory as clearLocal,
  fetchRealData   // ← Importamos fetchRealData para usarlo cuando estamos autenticados
} from './storage';

import { toast } from 'sonner';

/**
 * Obtiene el usuario autenticado actual
 * @returns {Promise<{id: string} | null>}
 */
const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

/**
 * Guarda (o actualiza) un elemento en el historial
 * - Si hay usuario autenticado → guarda en Supabase (con UPSERT) + lanza fetchRealData
 * - Si no → usa el almacenamiento local (que ya incluye el fetchRealData internamente)
 *
 * @param {Object} entry
 * @returns {Promise<void>}
 */
export const saveToHistory = async (entry) => {
  const user = await getCurrentUser();

  // Sin autenticación → fallback al almacenamiento local
  if (!user?.id) {
    addToLocal(entry);
    return;
  }

  const now = new Date().toISOString();

  // Preparar los datos para Supabase
  const data = {
    user_id: user.id,
    asin: entry.asin,
    dominio: entry.domain || entry.dominio || 'amazon.es',
    original_url: entry.originalUrl || entry.original_url || null,
    affiliate_url: entry.affiliateUrl || entry.affiliate_url || null,
    short_link: entry.shortLink || entry.short_link || null,
    product_title: entry.productTitle || entry.product_title || `Producto ${entry.asin}`,
    price: entry.price || null,
    original_price: entry.originalPrice || entry.original_price || null,
    prices_history: entry.prices ? entry.prices : [],
    last_update: entry.lastUpdate || now,
    recommended: entry.recommended ? entry.recommended : [],
    created_at: entry.timestamp || now,
    position: entry.position !== undefined ? entry.position : 0, // Si viene con posición, la respetamos; si no → 0 (se ajustará después)
  };

  try {
    const { error } = await supabase
      .from('affiliate_history')
      .upsert(data, {
        onConflict: 'user_id,asin,dominio',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('Error al guardar en Supabase:', error);
      toast.error('No se pudo guardar el producto en la nube');
      return;
    }

    console.log(`[saveToHistory] Guardado/actualizado en Supabase → ASIN ${entry.asin}`);

    // Disparar evento para actualizar UI
    window.dispatchEvent(new Event('amazon-history-updated'));

    // Lanzamos el scraping de precio y título real después de guardar
    console.log(`[saveToHistory] Iniciando fetchRealData para ASIN ${entry.asin} en 800ms`);

    setTimeout(() => {
      try {
        fetchRealData(entry);
      } catch (fetchErr) {
        console.error(`[saveToHistory → fetchRealData] Error al lanzar para ${entry.asin}:`, fetchErr);
      }
    }, 800);  // 800 ms para dar tiempo a que el evento se procese y Supabase refleje el cambio

  } catch (err) {
    console.error('Excepción al intentar guardar en Supabase:', err);
    toast.error('Error inesperado al guardar el producto');
  }
};

/**
 * Actualiza las posiciones de múltiples elementos del historial (usado al reordenar)
 * @param {string} userId 
 * @param {Array<{asin: string, dominio: string, position: number}>} positions 
 * @returns {Promise<boolean>}
 */
export const updateHistoryPositions = async (userId, positions) => {
  if (!userId || !Array.isArray(positions) || positions.length === 0) {
    return false;
  }

  try {
    const { error } = await supabase
      .from('affiliate_history')
      .upsert(
        positions.map(p => ({
          user_id: userId,
          asin: p.asin,
          dominio: p.dominio,
          position: p.position
        })),
        {
          onConflict: 'user_id,asin,dominio',
          ignoreDuplicates: false
        }
      );

    if (error) {
      console.error('Error al actualizar posiciones:', error);
      return false;
    }

    window.dispatchEvent(new Event('amazon-history-updated'));
    return true;
  } catch (err) {
    console.error('Excepción al actualizar posiciones:', err);
    return false;
  }
};

/**
 * Actualiza un elemento específico en el historial
 * @param {Object} updatedEntry 
 * @returns {Promise<void>}
 */

export const updateHistoryItem = async (updatedEntry) => {
  const user = await getCurrentUser();

  if (!user?.id) {
    // Actualizar en local
    const history = getHistory();
    const updatedHistory = history.map(h =>
      h.id === updatedEntry.id ? { ...h, ...updatedEntry } : h
    );
    localStorage.setItem('amazon-affiliate-history', JSON.stringify(updatedHistory));
    window.dispatchEvent(new Event('amazon-history-updated'));
    return;
  }

  // Preparar datos para Supabase
  const data = {
    user_id: user.id,
    asin: updatedEntry.asin,
    dominio: updatedEntry.domain || updatedEntry.dominio,
    product_title: updatedEntry.productTitle,
    title_is_custom: updatedEntry.title_is_custom ?? true,
    price: updatedEntry.price && updatedEntry.price.trim() ? updatedEntry.price : null,
    original_price: updatedEntry.originalPrice,
    prices_history: updatedEntry.prices || [],
    // ← QUITA ESTO: last_update: new Date().toISOString(),  // No resetear en ediciones manuales
    short_link: updatedEntry.shortLink,
    recommended: updatedEntry.recommended || [],
  };

  try {
    const { error } = await supabase
      .from('affiliate_history')
      .update(data)
      .eq('user_id', user.id)
      .eq('asin', updatedEntry.asin)
      .eq('dominio', updatedEntry.domain);

    if (error) {
      console.error('Error al actualizar en Supabase:', error);
      toast.error('No se pudo actualizar el producto');
      return;
    }

    window.dispatchEvent(new Event('amazon-history-updated'));

  } catch (err) {
    console.error('Error actualizando:', err);
    toast.error('Error al actualizar');
  }
};

/**
 * Elimina un elemento del historial
 */
export const deleteFromHistory = async (id, asin, domain) => {
  const user = await getCurrentUser();

  if (!user?.id) {
    removeFromLocal(id);
    return;
  }

  try {
    const { error } = await supabase
      .from('affiliate_history')
      .delete()
      .eq('user_id', user.id)
      .eq('asin', asin)
      .eq('dominio', domain);

    if (error) {
      console.error('Error al borrar en Supabase:', error);
      toast.error('No se pudo borrar el producto');
      return;
    }

    window.dispatchEvent(new Event('amazon-history-updated'));

  } catch (err) {
    console.error('Error borrando:', err);
    toast.error('Error al borrar');
  }
};

/**
 * Vacía todo el historial del usuario
 */
export const clearUserHistory = async () => {
  const user = await getCurrentUser();

  if (!user?.id) {
    clearLocal();
    return;
  }

  try {
    const { error } = await supabase
      .from('affiliate_history')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error al vaciar historial en Supabase:', error);
      toast.error('No se pudo vaciar el historial');
      return;
    }

    window.dispatchEvent(new Event('amazon-history-updated'));

  } catch (err) {
    console.error('Error vaciando historial:', err);
    toast.error('Error al vaciar');
  }
};

/**
 * Obtiene el historial del usuario ordenado por posición personalizada
 * (si existe sesión) o desde localStorage (si no hay sesión)
 */
export const getUserHistory = async (limit = 50) => {
  const user = await getCurrentUser();

  if (!user?.id) {
    return getHistory();
  }

  try {
    const { data, error } = await supabase
      .from('affiliate_history')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true, nullsLast: true })
      .limit(limit);

    if (error) {
      console.error('Error al leer historial ordenado de Supabase:', error);
      toast.error('No se pudo cargar el historial desde la nube. Intenta refrescar la página.');

      return [];
    }

    // Transformación (sin cambios)
    return data.map(item => ({
      id: item.id || `${item.asin}-${item.dominio}`,
      asin: item.asin,
      domain: item.dominio,
      originalUrl: item.original_url,
      affiliateUrl: item.affiliate_url,
      shortLink: item.short_link,
      productTitle: item.product_title,
      title_is_custom: item.title_is_custom ?? false,
      price: item.price,
      originalPrice: item.original_price,
      prices: item.prices_history || [],
      lastUpdate: item.last_update,
      timestamp: item.created_at,
      recommended: item.recommended || [],
      position: item.position,
      lastVisited: item.last_visited ? new Date(item.last_visited).getTime() : null,
    }));

  } catch (err) {
    console.error('Excepción al leer historial:', err);
    toast.error('Error inesperado al cargar el historial. Refresca la página.');
    return [];
  }
};

/**
 * Sincronización al iniciar sesión: sube lo que había en localStorage a Supabase
 */
export const syncLocalToSupabase = async () => {
  const user = await getCurrentUser();
  if (!user?.id) return;

  const localItems = getHistory();
  if (localItems.length === 0) return;

  let successCount = 0;

  for (const item of localItems) {
    try {
      await saveToHistory(item);
      successCount++;
    } catch (err) {
      console.warn('No se pudo sincronizar item:', item.asin, err);
    }
  }

  if (successCount > 0) {
    toast.success(`Se sincronizaron ${successCount} productos con tu cuenta`);
    // Opcional: limpiar localStorage después de migrar exitosamente
    // localStorage.removeItem('amazon-affiliate-history');
  }
};

export const saveSimpleMessage = async (messageText) => {
  if (!messageText?.trim()) {
    toast.warning("No hay texto para guardar");
    return false;
  }

  try {
    const { error } = await supabase
      .from('saved_messages')
      .insert([{
        message_text: messageText.trim()
      }]);

    if (error) throw error;

    toast.success("Mensaje guardado");
    return true;
  } catch (err) {
    console.error("Error al guardar mensaje:", err);
    toast.error("No se pudo guardar el mensaje");
    return false;
  }
};

export const getSavedMessages = async (limit = 10) => {
  try {
    const { data, error } = await supabase
      .from('saved_messages')
      .select('message_text')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map(item => item.message_text) || [];
  } catch (err) {
    console.error("Error obteniendo mensajes guardados:", err);
    return [];
  }
};