// api/search.js

const { fetchWithScraperApi } = require('./scraper-utils');

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({ result: 'Método no permitido' });
  }

  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    return res.status(400).json({ result: 'Falta o consulta inválida: ?q=' });
  }

  const query = q.trim();

  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    const html = await fetchWithScraperApi(searchUrl);

    // Extracción básica (puedes mejorarla después)
    const titleMatches = html.match(/<h3[^>]*>(.*?)<\/h3>/g) || [];
    const snippetMatches = html.match(/<div class="VwiC3b[^>]*>(.*?)<\/div>/g) || [];

    let results = [];
    for (let i = 0; i < Math.min(6, titleMatches.length); i++) {
      const title = titleMatches[i]?.replace(/<[^>]+>/g, '').trim() || '';
      const snippet = snippetMatches[i]?.replace(/<[^>]+>/g, '').trim() || '';
      if (title) results.push(`${title}\n${snippet}`);
    }

    const summary = results.length > 0
      ? results.join('\n\n')
      : 'No pude extraer resultados claros.';

    return res.status(200).json({ result: summary });

  } catch (err) {
    console.error('[search] Error:', err.message);
    return res.status(200).json({
      result: `No pude buscar "${query}" ahora mismo (problema con ScraperAPI). Intenta otra vez en unos minutos.`
    });
  }
}