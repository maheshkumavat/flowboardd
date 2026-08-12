const { callMultiProviderLLM } = require('./aiEngine');

const SKILL_CATEGORIES = {
  'Frontend': ['React', 'Vue.js', 'Angular', 'Svelte', 'Next.js', 'TypeScript', 'JavaScript', 'HTML/CSS', 'Tailwind CSS'],
  'Backend': ['Node.js', 'Python', 'Java', 'Go', 'Rust', 'C#', 'Express', 'Django', 'Spring Boot', 'PHP', 'Ruby'],
  'Database': ['PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'Supabase', 'SQL', 'Prisma'],
  'DevOps/Infra': ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Terraform', 'Linux', 'Cloudflare'],
  'Mobile': ['React Native', 'Flutter', 'iOS / Swift', 'Android / Kotlin'],
  'Design/UI': ['Figma', 'UI/UX Design', 'Design Systems', 'Tailwind/CSS', 'Wireframing']
};

/**
 * Normalizes any skill profile (flat or categorized) into a consistent multi-category structure:
 * { "Frontend": { "React": 0.85 }, "Backend": { "Node.js": 0.80 }, ... }
 */
function normalizeSkillProfile(rawProfile, defaultSource = 'github') {
  const result = {
    'Frontend': {},
    'Backend': {},
    'Database': {},
    'DevOps/Infra': {},
    'Mobile': {},
    'Design/UI': {}
  };

  if (!rawProfile || typeof rawProfile !== 'object') return result;

  // Helper to map an individual skill name to category
  const mapSkillToCategory = (skillName) => {
    const sLower = skillName.toLowerCase();
    if (sLower.includes('react native') || sLower.includes('flutter') || sLower.includes('swift') || sLower.includes('kotlin') || sLower.includes('ios') || sLower.includes('android')) return 'Mobile';
    if (sLower.includes('figma') || sLower.includes('ui/ux') || sLower.includes('design') || sLower.includes('wireframe')) return 'Design/UI';
    if (sLower.includes('react') || sLower.includes('vue') || sLower.includes('angular') || sLower.includes('svelte') || sLower.includes('next') || sLower.includes('html') || sLower.includes('css') || sLower.includes('tailwind') || sLower.includes('frontend')) return 'Frontend';
    if (sLower.includes('postgres') || sLower.includes('mongo') || sLower.includes('mysql') || sLower.includes('redis') || sLower.includes('sql') || sLower.includes('supabase') || sLower.includes('database')) return 'Database';
    if (sLower.includes('docker') || sLower.includes('k8s') || sLower.includes('kubernetes') || sLower.includes('aws') || sLower.includes('devops') || sLower.includes('ci/cd') || sLower.includes('terraform') || sLower.includes('linux')) return 'DevOps/Infra';
    return 'Backend';
  };

  const parseVal = (val) => {
    if (typeof val === 'object' && val !== null) {
      const numW = typeof val.weight === 'number' ? val.weight : parseFloat(val.weight) || 0.5;
      return {
        weight: parseFloat(numW.toFixed(2)),
        source: val.source || defaultSource,
      };
    }
    const numW = typeof val === 'number' ? val : parseFloat(val) || 0.5;
    return {
      weight: parseFloat(numW.toFixed(2)),
      source: defaultSource,
    };
  };

  Object.entries(rawProfile).forEach(([key, value]) => {
    if (Object.keys(result).includes(key) && typeof value === 'object' && value !== null) {
      Object.entries(value).forEach(([subSkill, val]) => {
        result[key][subSkill] = parseVal(val);
      });
    } else if (typeof value === 'number' || typeof value === 'string' || typeof value === 'object') {
      const cat = mapSkillToCategory(key);
      result[cat][key] = parseVal(value);
    }
  });

  return result;
}

/**
 * Fetch GitHub user public repos & language distribution
 */
async function fetchGitHubData(username, accessToken = null) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'FlowBoard-AI-App',
  };
  if (accessToken) {
    headers['Authorization'] = `token ${accessToken}`;
  }

  try {
    const reposRes = await fetch(`https://api.github.com/users/${username}/repos?per_page=20&sort=updated`, { headers });
    if (!reposRes.ok) {
      throw new Error(`GitHub API HTTP ${reposRes.status}`);
    }
    const repos = await reposRes.json();

    const languageCounts = {};
    let totalRepos = 0;

    for (const repo of repos) {
      if (repo.fork) continue;
      totalRepos++;
      if (repo.language) {
        languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
      }
    }

    return {
      username,
      totalRepos,
      languageCounts,
      repos: repos.slice(0, 10).map((r) => ({
        name: r.name,
        language: r.language,
        stargazers_count: r.stargazers_count,
        description: r.description,
        topics: r.topics || [],
      })),
    };
  } catch (err) {
    console.warn(`[GitHub API Warning] Could not fetch live data for ${username}: ${err.message}.`);
    return null;
  }
}

/**
 * 3-Tier Multi-Provider Categorized Skill Profile Generator
 */
async function generateSkillProfile(githubData) {
  if (!githubData) return null;

  try {
    const systemPrompt = `You are a technical recruiter AI. Analyze a developer's GitHub repository summary and output a JSON object grouping skills into 6 categories: "Frontend", "Backend", "Database", "DevOps/Infra", "Mobile", "Design/UI". Each category maps sub-skills/technologies to proficiency weight decimal values between 0.10 and 0.95. Output JSON format only:
{
  "Frontend": {"React": 0.85, "TypeScript": 0.70},
  "Backend": {"Node.js": 0.80},
  "Database": {"PostgreSQL": 0.75},
  "DevOps/Infra": {"Docker": 0.65},
  "Mobile": {},
  "Design/UI": {}
}`;
    const userPrompt = JSON.stringify({
      username: githubData.username,
      totalRepos: githubData.totalRepos,
      languageCounts: githubData.languageCounts,
      repos: githubData.repos,
    });

    const { provider, content } = await callMultiProviderLLM({ systemPrompt, userPrompt, timeoutMs: 5500 });
    const parsed = JSON.parse(content);

    if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
      return normalizeSkillProfile(parsed, 'github');
    }
  } catch (err) {
    console.warn(`[AI Engine] LLM provider unavailable (${err.message}). Triggering Rule-Based Fallback...`);
  }

  const counts = githubData.languageCounts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const fallbackCategorized = {
    'Frontend': {},
    'Backend': {},
    'Database': {},
    'DevOps/Infra': {},
    'Mobile': {},
    'Design/UI': {}
  };

  if (total === 0) {
    fallbackCategorized['Backend']['Software Engineering'] = { weight: 0.60, source: 'github' };
    fallbackCategorized['DevOps/Infra']['GitHub Integration'] = { weight: 0.50, source: 'github' };
    return fallbackCategorized;
  }

  Object.entries(counts).forEach(([lang, count]) => {
    const weight = parseFloat((count / total).toFixed(2));
    const langLower = lang.toLowerCase();
    const entryObj = { weight, source: 'github' };

    if (['javascript', 'typescript', 'vue', 'html', 'css', 'svelte'].includes(langLower)) {
      fallbackCategorized['Frontend'][lang] = entryObj;
    } else if (['sql', 'plpgsql'].includes(langLower)) {
      fallbackCategorized['Database'][lang] = entryObj;
    } else if (['dockerfile', 'shell', 'makefile', 'hcl'].includes(langLower)) {
      fallbackCategorized['DevOps/Infra'][lang] = entryObj;
    } else if (['swift', 'kotlin', 'dart'].includes(langLower)) {
      fallbackCategorized['Mobile'][lang] = entryObj;
    } else if (['scss', 'less'].includes(langLower)) {
      fallbackCategorized['Design/UI'][lang] = entryObj;
    } else {
      fallbackCategorized['Backend'][lang] = entryObj;
    }
  });

  return fallbackCategorized;
}

/**
 * Rank project members by required skill (category or specific skill) + project tech stack
 */
function rankMembersForSkill(requiredSkill, members = [], techStack = []) {
  if (!members || members.length === 0) return [];

  const normSkill = (requiredSkill || '').toLowerCase().trim();
  const normTechStack = (techStack || []).map((t) => t.toLowerCase().trim());

  const scoredMembers = [];

  for (const member of members) {
    const user = member.user || {};
    const rawProfile = user.skillProfile || user.skill_profile || {};
    const githubUsername = user.githubUsername || user.github_username;
    
    const defaultSrc = githubUsername ? 'github' : 'manual';
    const categorizedProfile = normalizeSkillProfile(rawProfile, defaultSrc);

    // Flatten all skills with category & source context
    const flatSkillEntries = [];
    Object.entries(categorizedProfile).forEach(([cat, subMap]) => {
      Object.entries(subMap).forEach(([skill, valObj]) => {
        const numW = typeof valObj === 'object' ? valObj.weight : (typeof valObj === 'number' ? valObj : parseFloat(valObj) || 0.5);
        const src = typeof valObj === 'object' ? (valObj.source || defaultSrc) : defaultSrc;
        flatSkillEntries.push({ category: cat, skill, weight: numW, source: src });
      });
    });

    if (flatSkillEntries.length === 0) {
      continue;
    }

    let taskMatchScore = 0;
    let techStackScoreSum = 0;
    let techStackMatchesCount = 0;

    // 1. Task Required Skill Match (Category match or Sub-skill match)
    flatSkillEntries.forEach(({ category, skill, weight }) => {
      const catLower = category.toLowerCase();
      const sLower = skill.toLowerCase();
      const numWeight = typeof weight === 'number' ? weight : parseFloat(weight) || 0;

      if (normSkill) {
        if (catLower === normSkill || sLower === normSkill) {
          taskMatchScore = Math.max(taskMatchScore, numWeight);
        } else if (sLower.includes(normSkill) || normSkill.includes(sLower) || catLower.includes(normSkill) || normSkill.includes(catLower)) {
          taskMatchScore = Math.max(taskMatchScore, numWeight * 0.85);
        }
      }

      // 2. Tech Stack Match Overlap
      normTechStack.forEach((tSkill) => {
        if (sLower === tSkill || sLower.includes(tSkill) || tSkill.includes(sLower) || catLower.includes(tSkill)) {
          techStackScoreSum += numWeight;
          techStackMatchesCount++;
        }
      });
    });

    const avgTechStackScore = techStackMatchesCount > 0 ? techStackScoreSum / techStackMatchesCount : 0;

    let finalScore = normSkill ? (taskMatchScore * 0.7) + (avgTechStackScore * 0.3) : avgTechStackScore || 0.5;

    if (finalScore === 0 && flatSkillEntries.length > 0) {
      const avgWeight = flatSkillEntries.reduce((acc, item) => acc + item.weight, 0) / flatSkillEntries.length;
      finalScore = parseFloat(Math.max(0.35, avgWeight * 0.5).toFixed(2));
    }

    // Determine Candidate Provenance: GitHub-verified vs Self-reported vs Mixed
    const sourcesSet = new Set(flatSkillEntries.map((e) => e.source));
    let sourceType = 'GitHub-verified';
    if (sourcesSet.has('github') && sourcesSet.has('manual')) {
      sourceType = 'Mixed';
    } else if (sourcesSet.has('manual') && !sourcesSet.has('github')) {
      sourceType = 'Self-reported';
    }

    if (finalScore > 0) {
      scoredMembers.push({
        ...member,
        matchScore: finalScore,
        matchPercentage: Math.round(finalScore * 100),
        sourceType: sourceType,
        categorizedProfile,
      });
    }
  }

  return scoredMembers.sort((a, b) => b.matchScore - a.matchScore);
}

module.exports = {
  SKILL_CATEGORIES,
  normalizeSkillProfile,
  fetchGitHubData,
  generateSkillProfile,
  rankMembersForSkill,
};

