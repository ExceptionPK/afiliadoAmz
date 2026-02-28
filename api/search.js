// api/search.js

const { fetchWithScraperApi } = require('./scraper-utils');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ result: 'Método no permitido' });
  }

  const { q } = req.query;

  if (!q || q.trim().length < 3) {
    return res.status(400).json({ result: 'Falta o consulta demasiado corta: ?q=' });
  }

  const query = q.trim();

  try {
    // Estrategia simple: buscamos en Google con ScraperAPI + render=true
    // (puedes cambiar el motor si quieres: bing, duckduckgo, etc.)
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    const html = await fetchWithScraperApi(searchUrl);

    // Extracción muy básica (puedes mejorarla con cheerio o regex más inteligente)
    const titleMatches = html.match(/<h3[^>]*>(.*?)<\/h3>/g) || [];
    const snippetMatches = html.match(/<div class="VwiC3b[^>]*>(.*?)<\/div>/g) || [];

    let results = [];
    for (let i = 0; i < Math.min(6, titleMatches.length); i++) {
      const title = titleMatches[i]?.replace(/<[^>]+>/g, '').trim() || '';
      const snippet = snippetMatches[i]?.replace(/<[^>]+>/g, '').trim() || '';
      if (title) {
        results.push(`${title}\n${snippet}`);
      }
    }

    const summary = results.length > 0
      ? results.join('\n\n')
      : 'No pude extraer resultados claros de la búsqueda.';

    return res.status(200).json({ result: summary });

  } catch (err) {
    console.error('Error en /api/search:', err);
    return res.status(200).json({
      result: `No pude realizar la búsqueda ahora mismo.\n` +
              `Consulta: "${query}"\n` +
              `Error: ${err.message.slice(0, 120)}`
    });
  }
}