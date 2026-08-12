-- ===================================================
-- FLOWBOARD SUPABASE DATABASE SCHEMA & RLS SECURITY POLICIES
-- ===================================================

-- 1. Profiles Table (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  avatar_url text,
  github_username text,
  primary_role text default 'Developer', -- 'Developer', 'Designer', 'Product Manager', 'Other'
  skill_profile jsonb default '{}'::jsonb,
  role text default 'MEMBER',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Projects Table
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  suggested_skills jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Project Members Table (Roles: 'ADMIN', 'MEMBER', 'VIEWER')
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'MEMBER', -- 'ADMIN', 'MEMBER', 'VIEWER'
  joined_at timestamptz default now(),
  unique (project_id, user_id)
);

-- 4. Columns Table
create table if not exists public.columns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,
  position integer default 0,
  created_at timestamptz default now()
);

-- 5. Tasks Table
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  column_id uuid references public.columns(id) on delete cascade not null,
  title text not null,
  description text,
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date timestamptz,
  priority text default 'MEDIUM',
  status text default 'To Do',
  required_skill text,
  risk_flag boolean default false,
  position integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 6. Comments Table
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

-- 7. Project Invite Codes Table
create table if not exists public.project_invite_codes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  code text not null unique,
  role text default 'MEMBER',
  expires_at timestamptz default (now() + interval '30 days'),
  created_by uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- 8. Activity Log Table
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  action text not null, -- 'task_created', 'task_moved', 'task_assigned', 'comment_added', 'member_joined'
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ===================================================
-- SECURITY DEFINER HELPER FUNCTION FOR RBAC
-- ===================================================
create or replace function public.get_project_role(p_id uuid, u_id uuid)
returns text as $$
  select case
    when exists (select 1 from public.projects where id = p_id and owner_id = u_id) then 'ADMIN'
    else (select role from public.project_members where project_id = p_id and user_id = u_id limit 1)
  end;
$$ language sql security definer stable;

-- ===================================================
-- AUTOMATIC PROFILE CREATION TRIGGER (BULLETPROOF)
-- ===================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_name text;
  user_email text;
begin
  user_email := coalesce(new.email, 'user_' || substr(new.id::text, 1, 8) || '@example.com');
  user_name := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    split_part(user_email, '@', 1),
    'User'
  );

  insert into public.profiles (
    id,
    name,
    email,
    avatar_url,
    github_username,
    primary_role,
    role,
    skill_profile
  )
  values (
    new.id,
    user_name,
    user_email,
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    coalesce(new.raw_user_meta_data->>'github_username', new.raw_user_meta_data->>'user_name'),
    coalesce(new.raw_user_meta_data->>'primary_role', 'Developer'),
    'MEMBER',
    '{}'::jsonb
  )
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    github_username = coalesce(excluded.github_username, public.profiles.github_username),
    updated_at = now();

  return new;
exception when others then
  raise warning 'handle_new_user trigger exception: %', SQLERRM;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ===================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ===================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.columns enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.project_invite_codes enable row level security;
alter table public.activity_log enable row level security;

-- Profiles RLS
drop policy if exists "Profiles viewable by authenticated users" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

create policy "Profiles viewable by authenticated users" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Projects RLS
drop policy if exists "Projects viewable by owner or members" on public.projects;
drop policy if exists "Authenticated users can create projects" on public.projects;
drop policy if exists "Only Admins can update projects" on public.projects;
drop policy if exists "Only Admins can delete projects" on public.projects;

create policy "Projects viewable by owner or members" on public.projects
  for select using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.project_members
      where project_id = public.projects.id
      and user_id = auth.uid()
    )
    or public.get_project_role(id, auth.uid()) is not null
  );

create policy "Authenticated users can create projects" on public.projects
  for insert with check (auth.uid() = owner_id);

create policy "Only Admins can update projects" on public.projects
  for update using (public.get_project_role(id, auth.uid()) = 'ADMIN');

create policy "Only Admins can delete projects" on public.projects
  for delete using (public.get_project_role(id, auth.uid()) = 'ADMIN');

-- Project Members RLS
drop policy if exists "Members viewable by project members" on public.project_members;
drop policy if exists "Only Admins can insert members" on public.project_members;
drop policy if exists "Only Admins can update members" on public.project_members;
drop policy if exists "Only Admins can delete members" on public.project_members;

create policy "Members viewable by project members" on public.project_members
  for select using (public.get_project_role(project_id, auth.uid()) is not null);

create policy "Only Admins can insert members" on public.project_members
  for insert with check (public.get_project_role(project_id, auth.uid()) = 'ADMIN' or auth.uid() = user_id);

create policy "Only Admins can update members" on public.project_members
  for update using (public.get_project_role(project_id, auth.uid()) = 'ADMIN');

create policy "Only Admins can delete members" on public.project_members
  for delete using (public.get_project_role(project_id, auth.uid()) = 'ADMIN');

-- Columns RLS
drop policy if exists "Columns viewable by project members" on public.columns;
drop policy if exists "Members can insert columns" on public.columns;
drop policy if exists "Members can update columns" on public.columns;
drop policy if exists "Admins can delete columns" on public.columns;

create policy "Columns viewable by project members" on public.columns
  for select using (public.get_project_role(project_id, auth.uid()) is not null);

create policy "Members can insert columns" on public.columns
  for insert with check (public.get_project_role(project_id, auth.uid()) in ('ADMIN', 'MEMBER'));

create policy "Members can update columns" on public.columns
  for update using (public.get_project_role(project_id, auth.uid()) in ('ADMIN', 'MEMBER'));

create policy "Admins can delete columns" on public.columns
  for delete using (public.get_project_role(project_id, auth.uid()) = 'ADMIN');

-- Tasks RLS
drop policy if exists "Tasks viewable by project members" on public.tasks;
drop policy if exists "Members can create tasks" on public.tasks;
drop policy if exists "Members can update tasks" on public.tasks;
drop policy if exists "Only Admins can delete tasks" on public.tasks;

create policy "Tasks viewable by project members" on public.tasks
  for select using (public.get_project_role(project_id, auth.uid()) is not null);

create policy "Members can create tasks" on public.tasks
  for insert with check (public.get_project_role(project_id, auth.uid()) in ('ADMIN', 'MEMBER'));

create policy "Members can update tasks" on public.tasks
  for update using (public.get_project_role(project_id, auth.uid()) in ('ADMIN', 'MEMBER'));

create policy "Only Admins can delete tasks" on public.tasks
  for delete using (public.get_project_role(project_id, auth.uid()) = 'ADMIN');

-- Comments RLS
drop policy if exists "Comments viewable by project members" on public.comments;
drop policy if exists "Members can create comments" on public.comments;

create policy "Comments viewable by project members" on public.comments
  for select using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.get_project_role(t.project_id, auth.uid()) is not null
    )
  );

create policy "Members can create comments" on public.comments
  for insert with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.get_project_role(t.project_id, auth.uid()) in ('ADMIN', 'MEMBER')
    )
  );

-- Project Invite Codes RLS
drop policy if exists "Invite codes viewable by members" on public.project_invite_codes;
drop policy if exists "Invite codes viewable by authenticated users" on public.project_invite_codes;
drop policy if exists "Only Admins can create invite codes" on public.project_invite_codes;

create policy "Invite codes viewable by authenticated users" on public.project_invite_codes
  for select using (auth.role() = 'authenticated');

create policy "Only Admins can create invite codes" on public.project_invite_codes
  for insert with check (public.get_project_role(project_id, auth.uid()) = 'ADMIN');

-- Activity Log RLS
drop policy if exists "Activity log viewable by members" on public.activity_log;
drop policy if exists "Members can insert activity log" on public.activity_log;

create policy "Activity log viewable by members" on public.activity_log
  for select using (public.get_project_role(project_id, auth.uid()) is not null);

create policy "Members can insert activity log" on public.activity_log
  for insert with check (public.get_project_role(project_id, auth.uid()) in ('ADMIN', 'MEMBER'));

-- Realtime Publication Setup
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.activity_log;

-- 9. Join Requests Table
create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  invite_code text,
  role text default 'MEMBER',
  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.join_requests enable row level security;

drop policy if exists "Join requests viewable by owner, admin, or requester" on public.join_requests;
drop policy if exists "Users can insert own join request" on public.join_requests;
drop policy if exists "Admins can update join request status" on public.join_requests;

create policy "Join requests viewable by owner, admin, or requester" on public.join_requests
  for select using (
    auth.uid() = user_id or public.get_project_role(project_id, auth.uid()) = 'ADMIN'
  );

create policy "Users can insert own join request" on public.join_requests
  for insert with check (auth.uid() = user_id);

create policy "Admins can update join request status" on public.join_requests
  for update using (public.get_project_role(project_id, auth.uid()) = 'ADMIN');

-- 10. Project Email Invites Table
create table if not exists public.project_email_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  email text not null,
  role text default 'MEMBER',
  token text not null unique,
  expires_at timestamptz default (now() + interval '7 days'),
  created_by uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now()
);

alter table public.project_email_invites enable row level security;

drop policy if exists "Email invites viewable by admins" on public.project_email_invites;
drop policy if exists "Admins can create email invites" on public.project_email_invites;

create policy "Email invites viewable by admins" on public.project_email_invites
  for select using (public.get_project_role(project_id, auth.uid()) = 'ADMIN');

create policy "Admins can create email invites" on public.project_email_invites
  for insert with check (public.get_project_role(project_id, auth.uid()) = 'ADMIN');

-- 11. Project Messages Table (Team Chat & Discussions)
create table if not exists public.project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  image_url text,
  created_at timestamptz default now()
);

alter table public.project_messages enable row level security;

drop policy if exists "Messages viewable by project members" on public.project_messages;
drop policy if exists "Members can send messages" on public.project_messages;

create policy "Messages viewable by project members" on public.project_messages
  for select using (public.get_project_role(project_id, auth.uid()) is not null);

create policy "Members can send messages" on public.project_messages
  for insert with check (public.get_project_role(project_id, auth.uid()) in ('ADMIN', 'MEMBER'));

alter publication supabase_realtime add table public.project_messages;

-- 12. Notifications Table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  message text not null,
  read boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

drop policy if exists "Users can view own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "Users can delete own notifications" on public.notifications;

create policy "Users can view own notifications" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Users can update own notifications" on public.notifications
  for update using (auth.uid() = user_id);

create policy "Users can delete own notifications" on public.notifications
  for delete using (auth.uid() = user_id);


