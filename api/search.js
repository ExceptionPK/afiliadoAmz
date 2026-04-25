export default async function handler(req, res) {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ result: "Falta query" });
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: q,

        search_depth: "advanced",
        include_answer: true,
        include_results: true,

        max_results: 5,

        include_raw_content: false,
      }),
    });

    const data = await response.json();

    const results = data.results?.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content?.slice(0, 200),
      score: r.score || 0,
    })) || [];

    // 🔥 ordenamos por relevancia
    const sorted = results.sort((a, b) => b.score - a.score);

    return res.status(200).json({
      answer: data.answer || null,
      results: sorted,
      // 🔥 string “listo para LLM”
      result: sorted
        .map(
          (r) =>
            `Título: ${r.title}\nURL: ${r.url}\nInfo: ${r.content}`
        )
        .join("\n\n"),
    });
  } catch (error) {
    console.error("Tavily error:", error);
    return res.status(500).json({ result: "Error buscando información" });
  }
}