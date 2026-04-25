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
                search_depth: "basic",
                include_answer: true,
                include_results: true,
                max_results: 3,
            }),
        });

        const data = await response.json();

        const resultText = `
${data.answer || "Sin respuesta clara"}

${data.results
                ?.map((r) => `- ${r.title}: ${(r.content || "").slice(0, 150)}`)
                .join("\n")}
`;

        console.log("TAVILY RESULT:", resultText);

        return res.status(200).json({ result: resultText });
    } catch (error) {
        console.error("Tavily error:", error);
        return res.status(500).json({ result: "Error buscando información" });
    }
}