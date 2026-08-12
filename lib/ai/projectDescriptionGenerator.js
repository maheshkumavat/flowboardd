const { callMultiProviderLLM } = require('./aiEngine');

/**
 * 3-Tier Multi-Provider Project Description Generator:
 * Priority 1: Groq LLM (5.5s timeout)
 * Priority 2: Gemini LLM (5.5s timeout)
 * Priority 3: Rule-Based Template Generator
 */
async function generateProjectDescription({ title, keyPoints = '', projectType = 'Web', complexity = 'MVP' }) {
  const cleanTitle = title ? title.trim() : 'Project Initiative';
  const cleanPoints = keyPoints ? keyPoints.trim() : '';

  // --- PRIORITY 1 & 2: Multi-Provider LLM Chain (Groq -> Gemini) ---
  try {
    const systemPrompt = `You are an expert technical project architect AI. Given a project title, optional key points, project type, and target complexity/scope, synthesize a well-structured, professional project specification brief tailored specifically to those requirements.

CRITICAL INSTRUCTION: If the user has provided existing notes/bullet points, incorporate and expand upon them — don't ignore or override their specific ideas. Add relevant details, suggest 2-3 additional features they may not have considered, and structure it into a polished project description.

Even if the user input is sparse (e.g. only a title with no key points), infer sensible, coherent technical defaults for ALL 5 required sections. Do NOT omit any section.

Your JSON response MUST follow this exact schema:
{
  "overview": "A concise 1-2 sentence description of what the project is and its core purpose, incorporating and expanding upon any user-provided notes.",
  "keyFeatures": [
    "Feature 1 title & brief description (incorporating user notes)",
    "Feature 2 title & brief description (incorporating user notes)",
    "Feature 3 title & brief description (suggested additional feature)",
    "Feature 4 title & brief description (suggested additional feature)"
  ],
  "techStack": {
    "frontend": "e.g. Next.js, React, Tailwind CSS",
    "backend": "e.g. Node.js, Express, Supabase, REST API",
    "database": "e.g. PostgreSQL, Supabase, Redis",
    "integrations": "e.g. Google Maps API, GitHub OAuth, OpenAI API, WebSockets"
  },
  "targetUsers": "1 sentence describing who this application is for.",
  "scope": "Scope indicator (e.g. Small Internal Tool, Medium Team App, Enterprise SaaS Platform)",
  "suggestedSkills": [
    "Next.js",
    "React",
    "Express",
    "Supabase",
    "PostgreSQL",
    "GitHub OAuth",
    "Tailwind CSS"
  ]
}

CRITICAL: The 'suggestedSkills' array MUST include 6 to 10 distinct, specific technology tags derived directly from ALL categories in your 'techStack' section: frontend, backend frameworks/services, database, and third-party APIs/integrations (e.g. Google Maps API, GitHub OAuth, Stripe, Express, Supabase, OpenAI API).

Formatting Instructions for the final 'description' text:
Format the sections as clean Markdown:
**Overview:**
[overview]

**Key Features:**
• [keyFeature 1]
• [keyFeature 2]
• [keyFeature 3]
• [keyFeature 4]

**Tech Stack:**
• Frontend: [techStack.frontend]
• Backend: [techStack.backend]
• Database: [techStack.database]
• Integrations: [techStack.integrations]

**Target Users:** [targetUsers]

**Scope:** [scope]

Return valid JSON ONLY matching the schema.`;

    const reqContext = [];
    if (projectType) reqContext.push(`Project Type: ${projectType}`);
    if (complexity) reqContext.push(`Scope & Complexity: ${complexity}`);
    const reqContextStr = reqContext.length > 0 ? `\nTarget Requirements: ${reqContext.join(' | ')}` : '';

    const userPrompt = `Project Title: "${cleanTitle}"\nExisting Notes / Bullet Points: "${cleanPoints || 'None provided — infer from title'}"${reqContextStr}`;

    const { provider, content } = await callMultiProviderLLM({ systemPrompt, userPrompt, timeoutMs: 7000 });
    const parsed = JSON.parse(content);

    if (parsed) {
      let finalDescription = parsed.description;

      // Build structured markdown description if LLM returned individual JSON fields
      if (!finalDescription && parsed.overview) {
        const features = Array.isArray(parsed.keyFeatures) ? parsed.keyFeatures.map((f) => `• ${f}`).join('\n') : '• Core Dashboard & Management\n• Real-Time Collaboration';
        const ts = parsed.techStack || {};
        const techStr = `• Frontend: ${ts.frontend || 'React / Next.js'}\n• Backend: ${ts.backend || 'Node.js / Express'}\n• Database: ${ts.database || 'PostgreSQL / Supabase'}\n• Integrations: ${ts.integrations || 'OAuth / WebSockets / Third-Party APIs'}`;

        finalDescription = `**Overview:**\n${parsed.overview}\n\n**Key Features:**\n${features}\n\n**Tech Stack:**\n${techStr}\n\n**Target Users:** ${parsed.targetUsers || 'Development teams and project managers.'}\n\n**Scope:** ${parsed.scope || complexity || 'Medium Team Application'}`;
      }

      if (finalDescription && finalDescription.trim() !== '') {
        let skills = Array.isArray(parsed.suggestedSkills) && parsed.suggestedSkills.length > 0
          ? parsed.suggestedSkills.map((s) => String(s).trim())
          : [];

        // Combine technologies from techStack across frontend, backend, database, and integrations
        if (parsed.techStack) {
          const combinedTech = [
            ...(parsed.techStack.frontend ? parsed.techStack.frontend.split(/[,/|]/) : []),
            ...(parsed.techStack.backend ? parsed.techStack.backend.split(/[,/|]/) : []),
            ...(parsed.techStack.database ? parsed.techStack.database.split(/[,/|]/) : []),
            ...(parsed.techStack.integrations ? parsed.techStack.integrations.split(/[,/|]/) : [])
          ].map((s) => s.trim()).filter((s) => s.length > 1);

          const existingSkillsLower = new Set(skills.map((s) => s.toLowerCase()));
          combinedTech.forEach((tech) => {
            if (!existingSkillsLower.has(tech.toLowerCase())) {
              skills.push(tech);
              existingSkillsLower.add(tech.toLowerCase());
            }
          });
        }

        if (skills.length === 0) {
          skills = ['Next.js', 'React', 'Express', 'PostgreSQL', 'Supabase', 'Tailwind CSS'];
        }

        return {
          description: finalDescription.trim(),
          suggestedSkills: skills.slice(0, 10),
          isFallback: false,
        };
      }
    }
  } catch (err) {
    console.warn(`[AI Engine] LLM provider error (${err.message}). Triggering Rule-Based Synthesis Fallback...`);
  }

  // --- PRIORITY 3: Rule-Based Structured Synthesis Fallback ---
  const fallbackOverview = cleanPoints
    ? `${cleanTitle} is a ${projectType.toLowerCase()} project designed to deliver ${cleanPoints}.`
    : `${cleanTitle} is a high-performance ${projectType.toLowerCase()} application designed to streamline core team workflows.`;

  const fallbackDesc = `**Overview:**\n${fallbackOverview}\n\n**Key Features:**\n• Interactive Dashboard & Analytics\n• Multi-User Real-Time Collaboration\n• Automated Workflow Management\n• Role-Based Access Control & Security\n\n**Tech Stack:**\n• Frontend: Next.js, React, Tailwind CSS\n• Backend: Node.js, Express API\n• Database: PostgreSQL / Supabase\n• Integrations: OAuth, WebSockets\n\n**Target Users:** Product managers, software engineers, and cross-functional teams.\n\n**Scope:** ${complexity || 'MVP / Team Application'}`;

  const defaultSkills = ['Next.js', 'React', 'Node.js', 'PostgreSQL', 'Tailwind CSS', 'REST API'];
  return {
    description: fallbackDesc,
    suggestedSkills: defaultSkills,
    isFallback: true,
  };
}

module.exports = { generateProjectDescription };
