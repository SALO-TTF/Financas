export const config = {
  runtime: 'edge', // Usa o Edge Runtime para evitar problemas de compatibilidade com o CRA
};

export default async function handler(req) {
  // 1. Bloquear métodos que não sejam POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 2. Extrair os dados do body com a API padrão do Edge (req.json())
    const { system, messages } = await req.json();
    const apiKey = process.env.REACT_APP_ANTHROPIC_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Chave API não configurada na Vercel.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Fazer a chamada à API da Anthropic
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

    // 4. Retornar a resposta para o React
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Erro no proxy Edge:", error);
    return new Response(JSON.stringify({ error: 'Erro interno no servidor proxy' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
