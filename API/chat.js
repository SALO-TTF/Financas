export default async function handler(req, res) {
  // Evitar métodos que não sejam POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { system, messages } = req.body;
    const apiKey = process.env.REACT_APP_ANTHROPIC_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Chave API não configurada no painel da Vercel.' });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        system,
        messages,
      }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (error) {
    console.error("Erro no proxy:", error);
    return res.status(500).json({ error: 'Erro interno no servidor proxy' });
  }
}
