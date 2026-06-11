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

    // Limpar as mensagens para garantir que apenas 'role' e 'content' são enviados,
    // e remover quaisquer mensagens que não tenham conteúdo válido.
    const cleanedMessages = (messages || [])
      .filter(msg => msg && msg.content && msg.content.trim() !== '')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content.trim()
      }));

    if (cleanedMessages.length === 0) {
      return res.status(400).json({ error: 'O histórico de mensagens não pode estar vazio.' });
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
        system: system,
        messages: cleanedMessages,
      }),
    });

    const data = await response.json();

    // Se a Anthropic devolver um erro, repassamos o erro para conseguirmos ler na consola do React
    if (!response.ok) {
      console.error("Erro da API Anthropic:", data);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error("Erro no proxy:", error);
    return res.status(500).json({ error: 'Erro interno no servidor proxy' });
  }
}
