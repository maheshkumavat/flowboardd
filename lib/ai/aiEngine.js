const { callGroqLLM } = require('./groqEngine');
const { callGeminiLLM } = require('./geminiEngine');

/**
 * Master Multi-Provider AI LLM Caller
 * Priority 1: Groq LLM (llama-3.3-70b-versatile)
 * Priority 2: Gemini LLM (gemini-1.5-flash)
 * Throws error if both fail, allowing caller to trigger Priority 3 Rule-Based Fallback.
 */
async function callMultiProviderLLM({ systemPrompt, userPrompt, temperature = 0.2, timeoutMs = 5500 }) {
  // --- PRIORITY 1: Groq LLM ---
  try {
    const content = await callGroqLLM({ systemPrompt, userPrompt, temperature, timeoutMs });
    return { provider: 'Groq', content };
  } catch (groqErr) {
    console.warn(`[AI Engine] Groq LLM unavailable (${groqErr.message}). Trying Gemini LLM (gemini-flash-latest)...`);
  }

  // --- PRIORITY 2: Gemini LLM ---
  try {
    const content = await callGeminiLLM({ systemPrompt, userPrompt, temperature, timeoutMs });
    return { provider: 'Gemini', content };
  } catch (geminiErr) {
    console.warn(`[AI Engine] Gemini LLM unavailable (${geminiErr.message}). Both LLM providers failed.`);
    throw new Error(`Both Groq and Gemini LLM providers failed or timed out.`);
  }
}

module.exports = { callMultiProviderLLM };
