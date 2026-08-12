# FlowBoard — AI-Powered Project Management Tool (Supabase Edition)

**FlowBoard** is a full-stack, collaborative project management web application (Trello/Asana style) built with Next.js, pixel-perfect Stitch UI screens, and powered entirely by **Supabase** (Supabase Auth, Supabase Postgres with RLS, Supabase Realtime, and Serverless AI functions).

---

## 🚀 Supabase Architecture & Stack

- **Frontend & UI**: Next.js 14 App Router with Tailwind CSS implementing Google Stitch design system tokens (`#4648d4`, `#f8f9ff`, `#0b1c30`) and Material Symbols Outlined icons.
- **Authentication**: **Supabase Auth** (`@supabase/supabase-js`) supporting:
  - Email & password sign-up + login (`supabase.auth.signUp`, `signInWithPassword`).
  - GitHub OAuth provider (`supabase.auth.signInWithOAuth({ provider: 'github', options: { scopes: 'read:user public_repo' } })`).
- **Database & Security**: **Supabase Postgres** with **Row Level Security (RLS)** policies on all 6 tables (`profiles`, `projects`, `project_members`, `columns`, `tasks`, `comments`), ensuring users can only read/write projects they own or belong to.
- **Real-time Synchronization**: **Supabase Realtime** Postgres changes subscription (`supabase.channel('project-id').on('postgres_changes', ...)`). Live task moves, comments, and board updates reflect instantly across all connected users without a custom WebSocket server.
- **AI Functions**: Isolated serverless functions for GitHub repo skill extraction (saving weighted skill tags into `profiles.skill_profile` jsonb) and Gemini AI goal decomposition.

---

## 🛠️ Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure your Supabase project credentials in `.env`:

```env
# Supabase Configuration (Get from Supabase Dashboard -> Project Settings -> API)
NEXT_PUBLIC_SUPABASE_URL="https://your-supabase-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# Gemini LLM API Key (For AI skill parsing & task breakdown)
GEMINI_API_KEY="your-gemini-api-key"

# GitHub OAuth Credentials (Configure in Supabase Dashboard -> Auth -> Providers -> GitHub)
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

---

## 📋 Supabase Database & RLS Setup

1. Open your **Supabase Dashboard** -> **SQL Editor**.
2. Copy and execute the complete SQL script from `supabase/schema.sql`:
   - Creates `profiles`, `projects`, `project_members`, `columns`, `tasks`, and `comments` tables.
   - Installs automatic profile creation trigger `handle_new_user()` on `auth.users`.
   - Enables **Row Level Security (RLS)** and defines read/write policies for every table.
   - Enables **Supabase Realtime** publication on `tasks` and `comments`.

---

## 💻 How to Run Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Next.js Dev Server
```bash
npm run dev
```

Open your browser and navigate to **`http://localhost:3000`**.

---

## 📁 Directory Structure

```
collab/
├── app/
│   ├── api/                # AI serverless endpoints (github-skills, task-breakdown, recommend-assignees)
│   ├── login/              # Stitch Login page (Supabase Auth)
│   ├── signup/             # Stitch Signup page (Supabase Auth)
│   ├── profile/            # Member Profile page (GitHub Skill Profile jsonb)
│   ├── projects/[id]/      # Kanban Board workspace page (Supabase Realtime changes)
│   ├── globals.css         # Stitch Tailwind design system & Material Symbols icons
│   ├── layout.js           # Root layout
│   └── page.js             # Stitch Dashboard page (Active projects grid)
├── components/
│   ├── SideNavBar.js       # Reusable Stitch sidebar navigation
│   ├── TopAppBar.js        # Reusable Stitch header with search & notification counter
│   ├── TaskModal.js        # Stitch Task Details slide-out drawer + AI subtasks
│   ├── SkillMatchingModal.js # Stitch AI Skill Matching candidate ranking overlay
│   ├── NotificationsPanel.js # Slide-out notifications feed
│   └── GitHubConnectModal.js # GitHub repo profiling modal
├── lib/
│   ├── supabase.js         # Singleton Supabase Client (@supabase/supabase-js)
│   └── ai/                 # Isolated AI Modules (githubSkillMatcher, taskBreakdown, riskEvaluator)
├── supabase/
│   └── schema.sql          # Complete Postgres schema, RLS policies, trigger & Realtime setup
└── package.json
```
