// =========================
// ROTACIÓN DE KEYS (GLOBAL)
// =========================
const keys = [
  process.env.TAVILY_API_KEY_1,
  process.env.TAVILY_API_KEY_2,
  process.env.TAVILY_API_KEY_3,
].filter(Boolean);

// IMPORTANTE: fuera del handler para persistencia en runtime
let keyIndex = 0;

function getNextKey() {
  if (!keys.length) return process.env.TAVILY_API_KEY_1;

  const key = keys[keyIndex % keys.length];
  keyIndex++;
  return key;
}

// =========================
// FORZAR AMAZON ESPAÑA
// =========================
function forceAmazonSpain(url = "") {
  return url
    .replace(/amazon\.[a-z.]+/g, "amazon.es")
    .split("?")[0]; // elimina tracking
}

// =========================
// FORZAR QUERY A ESPAÑA
// =========================
function forceESQuery(q = "") {
  const lower = q.toLowerCase();

  if (lower.includes("amazon")) {
    return `${q} site:amazon.es`;
  }

  return `${q} amazon españa site:amazon.es`;
}

export default async function handler(req, res) {
  const { q } = req.query;

  // =========================
  // VALIDACIÓN
  // =========================
  if (!q || typeof q !== "string") {
    return res.status(400).json({
      result: "Falta query válida",
      results: [],
      answer: null,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    // =========================
    // PETICIÓN A TAVILY
    // =========================
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
        max_results: 6,
        include_raw_content: false,
      }),
    });

    clearTimeout(timeout);

    // =========================
    // ERROR HTTP
    // =========================
    if (!response.ok) {
      const text = await response.text();
      console.error("Tavily error:", text);

      return res.status(200).json({
        result: "Error en búsqueda externa",
        results: [],
        answer: null,
      });
    }

    // =========================
    // PARSE JSON SEGURO
    // =========================
    let data;
    try {
      data = await response.json();
    } catch (err) {
      console.error("JSON parse error:", err);

      return res.status(200).json({
        result: "Respuesta inválida de búsqueda",
        results: [],
        answer: null,
      });
    }

    // =========================
    // SANITIZAR RESULTADOS
    // =========================
    const results = (data?.results || [])
      .map((r) => ({
        title: r?.title || "Sin título",
        url: forceAmazonSpain(r?.url || ""),
        content: (r?.content || "").slice(0, 220),
        score: r?.score || 0,
      }))
      .filter((r) => r.url.includes("amazon.es")); // SOLO ESPAÑA

    // =========================
    // ORDENAR POR RELEVANCIA
    // =========================
    const sorted = results.sort((a, b) => b.score - a.score);

    // =========================
    // FORMATO PARA LLM
    // =========================
    const llmText = sorted.length
      ? sorted
          .map(
            (r) =>
              `Título: ${r.title}\nURL: ${r.url}\nInfo: ${r.content}`
          )
          .join("\n\n")
      : "Sin resultados relevantes en Amazon España";

    // =========================
    // RESPUESTA FINAL
    // =========================
    return res.status(200).json({
      answer: data?.answer || null,
      results: sorted,
      result: llmText,
    });
  } catch (error) {
    clearTimeout(timeout);

    console.error("Tavily exception:", error);

    return res.status(200).json({
      result: "Error interno en búsqueda",
      results: [],
      answer: null,
    });
  }
}