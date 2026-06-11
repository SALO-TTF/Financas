export const config = {
  runtime: 'edge', 
};

export default async function handler(req) {
  // Garantir que é um pedido POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Extração correta do body no ambiente Edge
    const { system, messages } = await req.json();
    const apiKey = process.env.REACT_APP_ANTHROPIC_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Chave API não configurada na Vercel.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Chamada segura para a Anthropic a partir do servidor da Vercel
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

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Erro interno no servidor proxy Edge' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
