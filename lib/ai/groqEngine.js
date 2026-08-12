/**
 * Groq LLM API Engine (console.groq.com)
 * Model: llama-3.3-70b-versatile (Selected for ultra-fast inference & high accuracy)
 * API Endpoint: https://api.groq.com/openai/v1/chat/completions
 */

async function callGroqLLM({ systemPrompt, userPrompt, temperature = 0.2, timeoutMs = 5500 }) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('GROQ_API_KEY is not set or empty');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq API HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Groq returned empty response content');
    }

    return content;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Groq LLM call timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}

module.exports = { callGroqLLM };
