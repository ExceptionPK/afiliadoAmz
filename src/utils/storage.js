// utils/storage.js
const STORAGE_KEY = 'amazon-affiliate-history';
const TITLE_CACHE_KEY = 'amazon-title-cache';

const getTitleCache = () => {
    try {
        const data = localStorage.getItem(TITLE_CACHE_KEY);
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
};

const saveTitleCache = (cache) => {
    try {
        localStorage.setItem(TITLE_CACHE_KEY, JSON.stringify(cache));
    } catch { }
};

export const getHistory = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

export const addToHistory = (entry) => {
    const history = getHistory();
    const exists = history.some(
        (h) => h.asin === entry.asin && h.domain === entry.domain
    );
    if (exists) return;

    // === TÍTULO SEGURO: NUNCA domain, NUNCA URL ===
    let productTitle = `Producto ${entry.asin}`; // ← Valor por defecto

    // 1. Intentar extraer slug del path
    try {
        const urlObj = new URL(entry.originalUrl);
        const path = urlObj.pathname;
        const slugMatch = path.match(/\/([^\/]+)\/dp\/([A-Z0-9]{10})/i);

        if (slugMatch && slugMatch[1]) {
            const slug = decodeURIComponent(slugMatch[1]).trim();
            if (
                slug &&
                slug.length >= 3 &&
                slug.length <= 200 &&
                !slug.includes('.') &&
                !slug.includes('?') &&
                !/^(dp|gp|product|ref|sspa|tag)$/i.test(slug)
            ) {
                productTitle = slug
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase())
                    .replace(/\s+/g, ' ')
                    .trim();
            }
        }
    } catch (e) {
        console.warn("Error parseando URL para slug:", e);
    }

    // 2. Usar caché solo si es válido
    const cache = getTitleCache();
    if (cache[entry.asin]) {
        const cached = cache[entry.asin];
        if (
            cached &&
            cached.length > 0 &&
            !cached.includes('amazon') &&
            !cached.includes('http') &&
            !cached.includes('.es') &&
            !cached.includes('.com')
        ) {
            productTitle = cached;
        }
    }

    // 3. Forzar título seguro
    if (!productTitle || productTitle.includes('amazon') || productTitle.length < 3) {
        productTitle = `Producto ${entry.asin}`;
    }

    // === GUARDAR ENTRADA INICIAL ===
    const newEntry = {
        ...entry,
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        productTitle: productTitle.slice(0, 120),
    };

    history.unshift(newEntry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

    // === GUARDAR EN CACHÉ INICIAL ===
    const newCache = { ...cache, [entry.asin]: productTitle.slice(0, 120) };
    saveTitleCache(newCache);

    // === 4. OBTENER TÍTULO REAL DESDE AMAZON (en segundo plano) ===
    // === 4. OBTENER TÍTULO REAL DESDE AMAZON (proxy FIABLE) ===
    const fetchRealTitle = async () => {
        try {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(entry.originalUrl)}`;
            const response = await fetch(proxyUrl);

            if (!response.ok) return null;

            const data = await response.json();
            const html = data.contents;
            if (!html) return null;

            // Extraer <title>
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (!titleMatch || !titleMatch[1]) return null;

            let realTitle = titleMatch[1]
                .replace(/ - Amazon\.(es|com|de|fr|it|co\.uk).*$/i, '')
                .replace(/:.*$/, '')
                .replace(/\|.*$/, '')
                .replace(/\s+/g, ' ')
                .trim();

            // Validar que sea un título real
            if (
                realTitle.length > 5 &&
                realTitle.length < 200 &&
                !realTitle.includes('Amazon') &&
                !realTitle.includes('dp/') &&
                !realTitle.includes('ref=')
            ) {
                return realTitle;
            }
        } catch (e) {
            console.warn("Error fetching título real:", e);
        }
        return null;
    };

    // Ejecutar en segundo plano (no bloquea UI)
    setTimeout(async () => {
        const realTitle = await fetchRealTitle();
        if (realTitle) {
            // Actualizar caché
            const updatedCache = { ...getTitleCache(), [entry.asin]: realTitle.slice(0, 120) };
            saveTitleCache(updatedCache);

            // Actualizar historial en tiempo real
            const currentHistory = getHistory();
            const updatedHistory = currentHistory.map(h =>
                h.asin === entry.asin && h.domain === entry.domain
                    ? { ...h, productTitle: realTitle.slice(0, 120) }
                    : h
            );
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
        }
    }, 0);
};

export const removeFromHistory = (id) => {
    const history = getHistory().filter((h) => h.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
};

export const clearHistory = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TITLE_CACHE_KEY);
};

export const exportHistory = () => {
    const history = getHistory();
    const data = JSON.stringify(history, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amazon-affiliate-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

export const importHistory = (file, callback) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data)) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                callback(true);
            } else {
                callback(false);
            }
        } catch {
            callback(false);
        }
    };
    reader.readAsText(file);
};