const { callMultiProviderLLM } = require('./aiEngine');

/**
 * 3-Tier Multi-Provider Task Breakdown Generator:
 * Priority 1: Groq LLM (5.5s timeout)
 * Priority 2: Gemini LLM (5.5s timeout)
 * Priority 3: Template Breakdown Fallback
 */
async function generateTaskBreakdown(goalDescription) {
  const goal = goalDescription ? goalDescription.trim() : 'Project feature';

  // --- PRIORITY 1 & 2: Multi-Provider LLM Chain (Groq -> Gemini) ---
  try {
    const systemPrompt = `You are a Senior Technical Project Lead and Principal Software Architect. Decompose the user's high-level goal into 4-6 specific, highly actionable, realistic engineering subtasks. Avoid generic filler. Each subtask title must state the concrete feature/module being built (e.g. "Implement JWT Refresh Token API & Auth Cookie Handler"). Each subtask MUST be classified into one of these EXACT requiredSkill categories: ["Frontend", "Backend", "Database", "DevOps/Infra", "Mobile", "Design/UI"]. Output JSON format ONLY: {"subtasks": [{"title": "Concrete Title", "description": "Specific 1-2 sentence implementation details", "requiredSkill": "Frontend"|"Backend"|"Database"|"DevOps/Infra"|"Mobile"|"Design/UI", "priority": "HIGH"|"MEDIUM"|"LOW", "estimatedDays": 2}]}`;
    const userPrompt = `High-Level Engineering Goal: "${goal}"`;

    const { provider, content } = await callMultiProviderLLM({ systemPrompt, userPrompt, timeoutMs: 5500 });
    const parsed = JSON.parse(content);

    if (parsed && Array.isArray(parsed.subtasks) && parsed.subtasks.length > 0) {
      if (provider === 'Groq') {
        console.log(`[AI Engine] Task Breakdown generated via Groq LLM (llama-3.3-70b-versatile) for goal: "${goal.slice(0, 30)}..."`);
      } else {
        console.log(`[AI Engine] Task Breakdown generated via Gemini LLM (gemini-flash-latest) for goal: "${goal.slice(0, 30)}..."`);
      }
      return parsed.subtasks;
    }
  } catch (err) {
    console.warn(`[AI Engine] Both LLM providers unavailable (${err.message}). Triggering Template Fallback...`);
  }

  // --- PRIORITY 3: Template Breakdown Fallback ---
  console.log(`[AI Engine] Task Breakdown generated via Template Fallback for goal: "${goal.slice(0, 30)}..."`);
  return [
    {
      title: `Plan & Architecture: ${goal}`,
      description: 'Define exact architectural scope, API endpoints, and user acceptance criteria.',
      requiredSkill: 'Backend',
      priority: 'HIGH',
      estimatedDays: 1,
    },
    {
      title: `Schema & Database Design`,
      description: 'Implement database tables, indexes, and security policies.',
      requiredSkill: 'Database',
      priority: 'HIGH',
      estimatedDays: 2,
    },
    {
      title: `Core Implementation: ${goal}`,
      description: 'Build components, business logic handlers, and state bindings.',
      requiredSkill: 'Frontend',
      priority: 'MEDIUM',
      estimatedDays: 3,
    },
    {
      title: `Automated Testing & QA`,
      description: 'Run unit tests, verify edge cases, and validate real-time updates.',
      requiredSkill: 'Frontend',
      priority: 'MEDIUM',
      estimatedDays: 1,
    },
    {
      title: `Code Review & CI/CD Deployment`,
      description: 'Perform peer review, verify security boundaries, and deploy to production.',
      requiredSkill: 'DevOps/Infra',
      priority: 'LOW',
      estimatedDays: 1,
    },
  ];
}

module.exports = { generateTaskBreakdown };
