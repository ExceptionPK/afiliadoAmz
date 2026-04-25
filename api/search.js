// =========================
// ROTACIÓN KEYS
// =========================
const keys = [
  process.env.TAVILY_API_KEY_1,
  process.env.TAVILY_API_KEY_2,
  process.env.TAVILY_API_KEY_3,
].filter(Boolean);

let keyIndex = 0;

function getNextKey() {
  if (!keys.length) return process.env.TAVILY_API_KEY_1;

  const key = keys[keyIndex % keys.length];
  keyIndex++;
  return key;
}

// =========================
// AMAZON CLEANER
// =========================
function cleanAmazonUrl(url = "") {
  return url
    .replace(/amazon\.[a-z.]+/g, "amazon.es")
    .split("?")[0]
    .replace(/\/ref=.*/, "");
}

// =========================
// FORZAR ESPAÑA
// =========================
function forceESQuery(q = "") {
  const lower = q.toLowerCase();

  if (lower.includes("amazon")) {
    return `${q} site:amazon.es`;
  }

  return `${q} amazon españa site:amazon.es`;
}

// =========================
// DETECTAR CALIDAD / PRECIO
// =========================
function scoreProduct(item) {
  let score = item.score || 0;

  const text = (item.title + item.content).toLowerCase();

  if (text.includes("pro")) score += 0.5;
  if (text.includes("5g")) score += 0.3;
  if (text.includes("nuevo")) score += 0.2;
  if (text.includes("oferta")) score += 0.4;
  if (text.includes("descuento")) score += 0.4;

  return score;
}

// =========================
// LINK COMPRA DIRECTA
// =========================
function makeBuyLink(url = "") {
  if (!url) return "";

  const clean = cleanAmazonUrl(url);

  // si ya es producto amazon
  if (clean.includes("/dp/") || clean.includes("/gp/product/")) {
    return clean;
  }

  return clean;
}

export default async function handler(req, res) {
  const { q } = req.query;

  // =========================
  // VALIDACIÓN
  // =========================
  if (!q || typeof q !== "string") {
    return res.status(200).json({
      success: false,
      result: "Falta query válida",
      best: null,
      results: [],
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: getNextKey(),
        query: forceESQuery(q),

        search_depth: "advanced",
        include_answer: true,
        include_results: true,
        max_results: 7,
        include_raw_content: false,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(200).json({
        success: false,
        result: "Error en búsqueda externa",
        best: null,
        results: [],
      });
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      return res.status(200).json({
        success: false,
        result: "Error parseando respuesta",
        best: null,
        results: [],
      });
    }

    // =========================
    // LIMPIEZA DE RESULTADOS
    // =========================
    const resultsRaw = (data?.results || []).map((r) => ({
      title: r?.title || "Sin título",
      url: cleanAmazonUrl(r?.url || ""),
      content: (r?.content || "").slice(0, 200),
      score: r?.score || 0,
    }));

    const results = resultsRaw
      .map((r) => ({
        ...r,
        score: scoreProduct(r),
        buyLink: makeBuyLink(r.url),
      }))
      .filter((r) => r.url.includes("amazon.es"))
      .sort((a, b) => b.score - a.score);

    // =========================
    // MEJOR PRODUCTO
    // =========================
    const best = results[0]
      ? {
          title: results[0].title,
          url: results[0].buyLink,
          reason: "Mejor relación calidad/precio estimada",
        }
      : null;

    // =========================
    // OUTPUT LLM
    // =========================
    const llmText = results.length
      ? results
          .map(
            (r) =>
              `Título: ${r.title}
Precio/Info: ${r.content}
Link: ${r.buyLink}`
          )
          .join("\n\n")
      : "No se encontraron productos en Amazon España";

    // =========================
    // RESPUESTA FINAL
    // =========================
    return res.status(200).json({
      success: true,
      answer: data?.answer || null,
      best,
      results,
      result: llmText,
    });
  } catch (error) {
    clearTimeout(timeout);

    console.error("Search error:", error);

    return res.status(200).json({
      success: false,
      result: "Error interno en búsqueda",
      best: null,
      results: [],
    });
  }
}