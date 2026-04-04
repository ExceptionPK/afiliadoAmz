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
    const history = getHistory();
    const updatedHistory = history.map(h =>
      h.id === updatedEntry.id ? { ...h, ...updatedEntry } : h
    );
    localStorage.setItem('amazon-affiliate-history', JSON.stringify(updatedHistory));
    window.dispatchEvent(new Event('amazon-history-updated'));
    return;
  }

  // ── Preparar los datos para affiliate_history ───────────────────────────────
  const data = {
    user_id: user.id,
    asin: updatedEntry.asin,
    dominio: updatedEntry.domain || updatedEntry.dominio || 'amazon.es',
    product_title: updatedEntry.productTitle?.trim() || `Producto ${updatedEntry.asin}`,
    title_is_custom: updatedEntry.title_is_custom ?? true,
    price: updatedEntry.price && updatedEntry.price.trim() ? updatedEntry.price : null,
    original_price: updatedEntry.originalPrice || null,
    prices_history: updatedEntry.prices || [],
    short_link: updatedEntry.shortLink || null,
    recommended: updatedEntry.recommended || [],
  };

  try {
    const { error: updateErr } = await supabase
      .from('affiliate_history')
      .update(data)
      .eq('user_id', user.id)
      .eq('asin', updatedEntry.asin)
      .eq('dominio', data.dominio);

    if (updateErr) {
      console.error('Error al actualizar affiliate_history:', updateErr);
      toast.error('No se pudo actualizar el producto');
      return;
    }

    const { data: favRecord, error: checkErr } = await supabase
      .from('user_favorites')
      .select('id, product_title')
      .eq('user_id', user.id)
      .eq('asin', updatedEntry.asin)
      .eq('dominio', data.dominio)
      .maybeSingle();

    if (checkErr) {
      console.warn('Error al verificar si es favorito:', checkErr);
    }

    if (favRecord) {
      const favUpdateData = {
        product_title: data.product_title,
        price: data.price,
        original_price: data.original_price,
      };

      const { error: favUpdateErr } = await supabase
        .from('user_favorites')
        .update(favUpdateData)
        .eq('id', favRecord.id);

      if (favUpdateErr) {
        console.warn(`No se pudo sincronizar el título en favoritos para ASIN ${updatedEntry.asin}:`, favUpdateErr);
      } else {
        console.log(`[sync-favorites] Título actualizado en user_favorites para ${updatedEntry.asin}`);
      }
    }

    window.dispatchEvent(new Event('amazon-history-updated'));

  } catch (err) {
    console.error('Excepción durante updateHistoryItem:', err);
    toast.error('Error inesperado al actualizar el producto');
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
    const { error: historyError } = await supabase
      .from('affiliate_history')
      .delete()
      .eq('user_id', user.id)
      .eq('asin', asin)
      .eq('dominio', domain);

    if (historyError) {
      console.error('Error al borrar en affiliate_history:', historyError);
      toast.error('No se pudo borrar el producto');
      return;
    }

    const { error: favError } = await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('asin', asin)
      .eq('dominio', domain);

    if (favError) {
      console.warn('No se pudo borrar el favorito asociado:', favError);
    }

    window.dispatchEvent(new Event('amazon-history-updated'));
    toast.success("Producto eliminado");

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
    const { error: historyError } = await supabase
      .from('affiliate_history')
      .delete()
      .eq('user_id', user.id);

    if (historyError) {
      console.error('Error al vaciar historial en Supabase:', historyError);
      toast.error('No se pudo vaciar el historial');
      return;
    }

    const { error: favError } = await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', user.id);

    if (favError) {
      console.warn('No se pudieron borrar los favoritos al vaciar historial:', favError);
    }

    window.dispatchEvent(new Event('amazon-history-updated'));
    toast.success("Historial vaciado");

  } catch (err) {
    console.error('Error vaciando historial:', err);
    toast.error('Error al vaciar');
  }
};

/**
 * Obtiene el historial del usuario ordenado por posición personalizada
 * (si existe sesión) o desde localStorage (si no hay sesión)
 */
export const getUserHistory = async (limit = 2000) => {
  const user = await getCurrentUser();

  if (!user?.id) {
    return getHistory(); // localStorage fallback
  }

  try {
    // 1. Obtenemos el historial principal
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

    // 2. Obtenemos los favoritos (solo si hay datos)
    let favoritesSet = new Set();
    if (data?.length > 0) {
      const favResult = await getUserFavorites();
      favoritesSet = favResult; // ya es un Set
    }

    // 3. Mapeamos añadiendo isFavorite
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

      // Campo seguro: nunca undefined
      isFavorite: favoritesSet.has(`${item.asin}-${item.dominio}`)
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

// ====================== FAVORITOS ======================

/**
 * Añade o quita un producto de favoritos (toggle)
 * - Al añadir: copia original_price y price desde affiliate_history
 */
export const toggleFavorite = async (asin, dominio = 'amazon.es') => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return false;

  const { data: existing, error: checkError } = await supabase
    .from('user_favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('asin', asin)
    .eq('dominio', dominio)
    .maybeSingle();

  if (checkError) {
    console.error('Error verificando favorito existente:', checkError);
    return false;
  }

  if (existing) {
    // Quitar favorito
    const { error: deleteError } = await supabase
      .from('user_favorites')
      .delete()
      .eq('id', existing.id);

    if (deleteError) {
      console.error('Error al quitar favorito:', deleteError);
      toast.error('No se pudo quitar de favoritos');
      return true;
    }

    return false;
  }

  // ── Añadir favorito ────────────────────────────────────────────────
  // 1. Obtener datos actuales desde affiliate_history (incluyendo original_price)
  const { data: product, error: fetchError } = await supabase
    .from('affiliate_history')
    .select('product_title, price, original_price')
    .eq('user_id', user.id)
    .eq('asin', asin)
    .eq('dominio', dominio)
    .single();

  let titleToSave = 'Producto sin título';
  let priceToSave = null;
  let originalPriceToSave = null;

  if (!fetchError && product) {
    titleToSave = product.product_title?.trim() || titleToSave;
    priceToSave = product.price;
    originalPriceToSave = product.original_price;
    console.log(`[toggleFavorite] Copiando desde affiliate_history → original_price: ${originalPriceToSave}, price: ${priceToSave}`);
  } else {
    console.warn(`No se encontró producto en affiliate_history para ASIN ${asin} → usando defaults`);
  }

  // 2. Insertar en user_favorites con original_price incluido
  const { data: inserted, error: insertError } = await supabase
    .from('user_favorites')
    .insert({
      user_id: user.id,
      asin,
      dominio,
      product_title: titleToSave,
      price: priceToSave,              // precio actual
      original_price: originalPriceToSave,  // ← el precio original (o fallback)
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error al añadir favorito:', insertError);
    toast.error('No se pudo añadir a favoritos');
    return false;
  }

  return true;
};

/**
 * Comprueba si un producto es favorito
 */
export const isProductFavorite = async (asin, dominio = 'amazon.es') => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return false;

  const { data } = await supabase
    .from('user_favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('asin', asin)
    .eq('dominio', dominio)
    .maybeSingle();

  return !!data;
};

/**
 * Obtiene todos los favoritos del usuario (para marcar en el historial)
 */
export const getUserFavorites = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return new Set();

  const { data } = await supabase
    .from('user_favorites')
    .select('asin, dominio')
    .eq('user_id', user.id);

  const set = new Set();
  data?.forEach(f => set.add(`${f.asin}-${f.dominio}`));
  return set;
};

/**
 * Elimina múltiples elementos del historial por sus ASIN + dominio
 * @param {Array<{asin: string, dominio: string}>} itemsToDelete 
 * @returns {Promise<boolean>}
 */
export const bulkDeleteItems = async (itemsToDelete) => {
  const user = await getCurrentUser();

  if (!user?.id) {
    // Modo localStorage
    const current = getHistory();
    const keysToRemove = new Set(itemsToDelete.map(i => `${i.asin}-${i.dominio || 'amazon.es'}`));

    const remaining = current.filter(item => {
      const key = `${item.asin}-${item.domain || 'amazon.es'}`;
      return !keysToRemove.has(key);
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    window.dispatchEvent(new Event('amazon-history-updated'));
    return true;
  }

  // Modo Supabase
  try {
    // Como la clave primaria compuesta es (user_id, asin, dominio)
    // podemos hacer varias llamadas o intentar un filter con in + lógica
    // La forma más segura hoy por hoy es borrar uno por uno o por batches

    const batches = [];
    for (let i = 0; i < itemsToDelete.length; i += 20) {
      batches.push(itemsToDelete.slice(i, i + 20));
    }

    for (const batch of batches) {
      const { error } = await supabase
        .from('affiliate_history')
        .delete()
        .in('asin', batch.map(b => b.asin))
        .eq('user_id', user.id)
        // Nota: no podemos usar .in para dominio directamente junto a asin
        // → mejor borrar uno por uno en este caso (o mejorar después)
        // Alternativa temporal: bucle individual
        .or(
          batch.map(b => `and(asin.eq.${b.asin},dominio.eq.${b.dominio || 'amazon.es'})`).join(',')
        );

      if (error) {
        console.error("Error en bulk delete batch:", error);
        return false;
      }
    }

    // También eliminamos favoritos asociados
    await supabase
      .from('user_favorites')
      .delete()
      .in('asin', itemsToDelete.map(i => i.asin))
      .eq('user_id', user.id);

    window.dispatchEvent(new Event('amazon-history-updated'));
    return true;
  } catch (err) {
    console.error("Excepción en bulkDeleteItems:", err);
    return false;
  }
};