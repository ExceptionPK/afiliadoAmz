// api/browse.js

const { fetchWithScraperApi } = require('./scraper-utils');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ content: 'Método no permitido' });
  }

  const { url, instructions } = req.query;

  if (!url || !instructions) {
    return res.status(400).json({ content: 'Faltan url o instructions' });
  }

  try {
    const html = await fetchWithScraperApi(url);

    // Limitamos tamaño para no saturar el LLM
    const MAX_CHARS = 14000;
    let content = html.substring(0, MAX_CHARS) + (html.length > MAX_CHARS ? '… [truncado]' : '');

    // Intentamos extraer info útil según instructions (básico)
    const lowerInstr = instructions.toLowerCase();
    if (lowerInstr.includes('precio') || lowerInstr.includes('price') || lowerInstr.includes('oferta')) {
      const priceRegex = /(\d{1,3}(?:[.,\s]?\d{3})*[.,]\d{2})\s*€?/g;
      const prices = [...html.matchAll(priceRegex)].map(m => m[0]);
      if (prices.length > 0) {
        content = `Precios encontrados:\n${prices.slice(0, 10).join('\n')}\n\n` + content;
      }
    }

    content += `\n\nInstrucciones recibidas: ${instructions}`;

    return res.status(200).json({ content });

  } catch (err) {
    console.error('Error en /api/browse:', err);
    return res.status(200).json({
      content: `No pude leer la página.\nURL: ${url}\nError: ${err.message.slice(0, 150)}`
    });
  }
}