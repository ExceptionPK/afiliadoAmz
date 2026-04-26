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

  if (!user?.id) {
    addToLocal(entry);
    return;
  }

  const now = new Date().toISOString();

  // Es la primera inserción desde Home si no viene ningún precio
  const isFirstInsertion = !entry.price && !entry.originalPrice && !entry.first_ever_price;

  const priceToSave = isFirstInsertion ? null : (entry.price ?? null);
  const originalPriceToSave = entry.originalPrice ?? null;

  const firstEverPrice = entry.first_ever_price
    || originalPriceToSave
    || priceToSave
    || null;

  const data = {
    user_id: user.id,
    asin: entry.asin,
    dominio: entry.domain || entry.dominio || 'amazon.es',
    original_url: entry.originalUrl || entry.original_url || null,
    affiliate_url: entry.affiliateUrl || entry.affiliate_url || null,
    short_link: entry.shortLink || entry.short_link || null,
    product_title: entry.productTitle || entry.product_title || `Producto ${entry.asin}`,

    price: priceToSave,                    // ← NULL solo la primera vez
    original_price: originalPriceToSave,
    first_ever_price: firstEverPrice,

    prices_history: entry.prices ? entry.prices : [],
    last_update: entry.lastUpdate || now,
    recommended: entry.recommended ? entry.recommended : [],
    created_at: entry.timestamp || now,
    position: entry.position !== undefined ? entry.position : 0,
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

    console.log(`[saveToHistory] Guardado → ASIN ${entry.asin} | price: ${priceToSave === null ? 'NULL (primera vez)' : priceToSave}`);

    window.dispatchEvent(new Event('amazon-history-updated'));

    // Pasamos la bandera a fetchRealData
    const entryForFetch = { ...entry, isFirstInsertion };

    setTimeout(() => {
      try {
        fetchRealData(entryForFetch);
      } catch (fetchErr) {
        console.error(`[saveToHistory → fetchRealData] Error para ${entry.asin}:`, fetchErr);
      }
    }, 800);

  } catch (err) {
    console.error('Excepción al guardar:', err);
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

/**
 * Actualiza un elemento específico en el historial
 * Soporte mejorado para historial acumulativo cuando cambian price o original_price
 */
export const updateHistoryItem = async (updatedEntry) => {
  const user = await getCurrentUser();
  const now = new Date().toISOString();
  const domain = updatedEntry.domain || updatedEntry.dominio || 'amazon.es';

  if (!user?.id) {
    // ==================== MODO LOCALSTORAGE ====================
    const history = getHistory();
    const updatedHistory = history.map(h => {
      if (h.id === updatedEntry.id) {
        let pricesHistory = Array.isArray(h.prices) ? [...h.prices] : [];

        const oldPrice = h.price || null;
        const newPrice = updatedEntry.price && updatedEntry.price.trim()
          ? updatedEntry.price.trim()
          : null;

        const oldOriginal = h.originalPrice || null;
        const newOriginal = updatedEntry.originalPrice && updatedEntry.originalPrice.trim()
          ? updatedEntry.originalPrice.trim()
          : null;

        // Registramos cambio si price o original_price cambiaron
        if (newPrice !== oldPrice || newOriginal !== oldOriginal) {
          pricesHistory.push({
            timestamp: now,
            price: newPrice,                    // precio actual en ese momento
            original_price: newOriginal,        // precio original en ese momento
            type: "manual"
          });
        }

        return {
          ...h,
          ...updatedEntry,
          prices: pricesHistory,
          lastUpdate: now
        };
      }
      return h;
    });

    localStorage.setItem('amazon-affiliate-history', JSON.stringify(updatedHistory));
    window.dispatchEvent(new Event('amazon-history-updated'));
    return;
  }

  // ==================== MODO SUPABASE ====================
  const { data: current, error: fetchErr } = await supabase
    .from('affiliate_history')
    .select('prices_history, price, original_price')
    .eq('user_id', user.id)
    .eq('asin', updatedEntry.asin)
    .eq('dominio', domain)
    .single();

  if (fetchErr && fetchErr.code !== 'PGRST116') {
    console.warn('Error al obtener datos actuales:', fetchErr);
  }

  let pricesHistory = current?.prices_history || [];

  const oldPrice = current?.price || null;
  const newPrice = updatedEntry.price && updatedEntry.price.trim()
    ? updatedEntry.price.trim()
    : null;

  const oldOriginal = current?.original_price || null;
  const newOriginal = updatedEntry.originalPrice && updatedEntry.originalPrice.trim()
    ? updatedEntry.originalPrice.trim()
    : null;

  // Si cambió price O original_price → registramos en el historial
  if (newPrice !== oldPrice || newOriginal !== oldOriginal) {
    pricesHistory.push({
      timestamp: now,
      price: newPrice,
      original_price: newOriginal,     // ← Guardamos también el original_price en ese momento
      type: "manual"
    });
  }

  const data = {
    product_title: updatedEntry.productTitle?.trim() || `Producto ${updatedEntry.asin}`,
    title_is_custom: updatedEntry.title_is_custom ?? true,
    price: newPrice,
    original_price: newOriginal,
    prices_history: pricesHistory,
    last_update: now,
    short_link: updatedEntry.shortLink || null,
    recommended: updatedEntry.recommended || [],
  };

  try {
    const { error: updateErr } = await supabase
      .from('affiliate_history')
      .update(data)
      .eq('user_id', user.id)
      .eq('asin', updatedEntry.asin)
      .eq('dominio', domain);

    if (updateErr) {
      console.error('Error al actualizar:', updateErr);
      toast.error('No se pudo actualizar el producto');
      return;
    }

    // Sincronización con favoritos
    const { data: favRecord } = await supabase
      .from('user_favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('asin', updatedEntry.asin)
      .eq('dominio', domain)
      .maybeSingle();

    if (favRecord) {
      await supabase
        .from('user_favorites')
        .update({
          product_title: data.product_title,
          price: data.price,
          original_price: data.original_price,
        })
        .eq('id', favRecord.id);
    }

    window.dispatchEvent(new Event('amazon-history-updated'));

  } catch (err) {
    console.error('Excepción durante updateHistoryItem:', err);
    toast.error('Error al actualizar producto');
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
      first_ever_price: item.first_ever_price,
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

    localStorage.setItem('amazon-affiliate-history', JSON.stringify(remaining));
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