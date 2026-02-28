// api/scraper-utils.js

const API_KEYS = [
  process.env.VITE_SCRAPERAPI_KEY_1?.trim(),
  process.env.VITE_SCRAPERAPI_KEY_2?.trim(),
  // puedes añadir más si las defines en Vercel
].filter(Boolean);

if (API_KEYS.length === 0) {
  console.error("[scraper-utils] No se encontraron claves VITE_SCRAPERAPI_KEY_* en las variables de entorno");
}

let lastGoodKeyIndex = 0; // en memoria (reinicia en cold start, aceptable)

async function fetchWithScraperApi(targetUrl) {
  if (API_KEYS.length === 0) {
    throw new Error("No hay claves de ScraperAPI configuradas (VITE_SCRAPERAPI_KEY_*)");
  }

  let startIdx = lastGoodKeyIndex;
  let lastError = null;

  for (let i = 0; i < API_KEYS.length; i++) {
    const keyIdx = (startIdx + i) % API_KEYS.length;
    const key = API_KEYS[keyIdx];

    const scraperUrl = `https://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(targetUrl)}&render=true`;

    console.log(`[ScraperAPI server] Probando clave #${keyIdx + 1} → ${targetUrl}`);

    try {
      const res = await fetch(scraperUrl, {
        headers: { 'Accept': 'text/html' },
      });

      if (res.ok) {
        lastGoodKeyIndex = keyIdx;
        const html = await res.text();
        console.log(`[ScraperAPI server] Éxito con clave #${keyIdx + 1} - longitud: ${html.length}`);
        return html;
      }

      let errText = '';
      try { errText = await res.text(); } catch {}

      const status = res.status;

      const isQuotaOrAuthError =
        status === 401 || status === 429 || status === 403 ||
        errText.toLowerCase().includes('credit') ||
        errText.toLowerCase().includes('quota') ||
        errText.toLowerCase().includes('exceeded') ||
        errText.toLowerCase().includes('limit') ||
        errText.toLowerCase().includes('no credits');

      if (isQuotaOrAuthError) {
        console.warn(`[ScraperAPI] Clave #${keyIdx + 1} → problema cuota/autorización (${status})`);
        lastError = new Error(`Problema con clave #${keyIdx + 1}: ${status}`);
        continue;
      }

      throw new Error(`ScraperAPI error ${status}: ${errText.slice(0, 180)}`);

    } catch (err) {
      lastError = err;
      console.warn(`[ScraperAPI server] Fallo clave #${keyIdx + 1}: ${err.message}`);
    }
  }

  throw lastError || new Error("Todas las claves de ScraperAPI fallaron");
}

module.exports = { fetchWithScraperApi };