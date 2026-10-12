create extension if not exists pgcrypto;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  email text primary key,
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_email text not null references public.users(email) on delete cascade,
  type text not null check (type in ('main', 'side')),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_email text not null references public.users(email) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  toolkit_slug text not null,
  description text,
  category text,
  logo_url text,
  icon_url text,
  logo_key text,
  actions jsonb not null default '[]'::jsonb,
  composio_auth_config_id text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tools
  add column if not exists icon text,
  add column if not exists url text,
  add column if not exists slug text,
  add column if not exists toolkit_slug text,
  add column if not exists logo_url text,
  add column if not exists icon_url text,
  add column if not exists logo_key text,
  add column if not exists actions jsonb not null default '[]'::jsonb,
  add column if not exists composio_auth_config_id text,
  add column if not exists is_active boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.tools
set slug = case lower(trim(name))
  when 'gmail' then 'gmail'
  when 'slack' then 'slack'
  when 'google calendar' then 'googlecalendar'
  else trim(both '-' from regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g'))
end
where slug is null or trim(slug) = '';

update public.tools
set toolkit_slug = slug
where toolkit_slug is null or trim(toolkit_slug) = '';

create unique index if not exists tools_slug_key on public.tools (slug);

alter table public.tools
  alter column slug set not null,
  alter column toolkit_slug set not null;

create table if not exists public.user_tool_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  status text not null default 'not_connected'
    check (status in ('not_connected', 'pending', 'connected', 'failed', 'revoked')),
  composio_connected_account_id text,
  composio_connection_request_id text,
  connected_label text,
  connected_email text,
  metadata jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tool_id)
);

create table if not exists public.agent_tool_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_id uuid references public.tools(id) on delete set null,
  action_name text not null,
  input_summary text not null,
  output_summary text,
  status text not null check (status in ('pending', 'completed', 'failed', 'cancelled')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.scheduled_agent_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  original_prompt text not null,
  task_type text not null default 'generic_prompt'
    check (task_type = 'generic_prompt'),
  task_payload jsonb not null default '{}'::jsonb,
  schedule_rule jsonb not null default '{}'::jsonb,
  timezone text not null default 'UTC',
  delivery text not null default 'chat' check (length(trim(delivery)) > 0),
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  last_run_status text check (last_run_status in ('completed', 'failed')),
  last_run_summary text,
  last_run_error text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_threads_user_email_created_at_idx
  on public.chat_threads (user_email, created_at desc);
create index if not exists chat_messages_thread_created_at_idx
  on public.chat_messages (thread_id, created_at);
create index if not exists user_tool_connections_user_id_idx
  on public.user_tool_connections (user_id);
create index if not exists agent_tool_runs_user_id_created_at_idx
  on public.agent_tool_runs (user_id, created_at desc);
create index if not exists scheduled_agent_tasks_user_id_idx
  on public.scheduled_agent_tasks (user_id);
create index if not exists scheduled_agent_tasks_due_idx
  on public.scheduled_agent_tasks (status, next_run_at)
  where status = 'active';

drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at
  before update on public.users
  for each row execute function public.update_updated_at_column();

drop trigger if exists chat_threads_updated_at on public.chat_threads;
create trigger chat_threads_updated_at
  before update on public.chat_threads
  for each row execute function public.update_updated_at_column();

drop trigger if exists tools_updated_at on public.tools;
create trigger tools_updated_at
  before update on public.tools
  for each row execute function public.update_updated_at_column();

drop trigger if exists user_tool_connections_updated_at on public.user_tool_connections;
create trigger user_tool_connections_updated_at
  before update on public.user_tool_connections
  for each row execute function public.update_updated_at_column();

drop trigger if exists scheduled_agent_tasks_updated_at on public.scheduled_agent_tasks;
create trigger scheduled_agent_tasks_updated_at
  before update on public.scheduled_agent_tasks
  for each row execute function public.update_updated_at_column();

alter table public.users enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.tools enable row level security;
alter table public.user_tool_connections enable row level security;
alter table public.agent_tool_runs enable row level security;
alter table public.scheduled_agent_tasks enable row level security;

drop policy if exists "Users can read their own profile" on public.users;
create policy "Users can read their own profile"
  on public.users for select to authenticated
  using (email = (select auth.jwt() ->> 'email'));
drop policy if exists "Users can create their own profile" on public.users;
create policy "Users can create their own profile"
  on public.users for insert to authenticated
  with check (email = (select auth.jwt() ->> 'email'));
drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile"
  on public.users for update to authenticated
  using (email = (select auth.jwt() ->> 'email'))
  with check (email = (select auth.jwt() ->> 'email'));

drop policy if exists "Users can manage their own chat threads" on public.chat_threads;
create policy "Users can manage their own chat threads"
  on public.chat_threads for all to authenticated
  using (user_email = (select auth.jwt() ->> 'email'))
  with check (user_email = (select auth.jwt() ->> 'email'));

drop policy if exists "Users can manage their own chat messages" on public.chat_messages;
create policy "Users can manage their own chat messages"
  on public.chat_messages for all to authenticated
  using (
    user_email = (select auth.jwt() ->> 'email')
    and exists (
      select 1 from public.chat_threads thread
      where thread.id = chat_messages.thread_id
        and thread.user_email = (select auth.jwt() ->> 'email')
    )
  )
  with check (
    user_email = (select auth.jwt() ->> 'email')
    and exists (
      select 1 from public.chat_threads thread
      where thread.id = chat_messages.thread_id
        and thread.user_email = (select auth.jwt() ->> 'email')
    )
  );

drop policy if exists "Anyone can read active tools" on public.tools;
create policy "Anyone can read active tools"
  on public.tools for select to anon, authenticated
  using (is_active);

drop policy if exists "Users can read their own tool connections" on public.user_tool_connections;
create policy "Users can read their own tool connections"
  on public.user_tool_connections for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Users can create their own tool connections" on public.user_tool_connections;
create policy "Users can create their own tool connections"
  on public.user_tool_connections for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "Users can update their own tool connections" on public.user_tool_connections;
create policy "Users can update their own tool connections"
  on public.user_tool_connections for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists "Users can delete their own tool connections" on public.user_tool_connections;
create policy "Users can delete their own tool connections"
  on public.user_tool_connections for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can read their own tool runs" on public.agent_tool_runs;
create policy "Users can read their own tool runs"
  on public.agent_tool_runs for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Users can create their own tool runs" on public.agent_tool_runs;
create policy "Users can create their own tool runs"
  on public.agent_tool_runs for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can manage their own scheduled tasks" on public.scheduled_agent_tasks;
create policy "Users can manage their own scheduled tasks"
  on public.scheduled_agent_tasks for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select on public.tools to anon, authenticated;
grant select, insert, update on public.users to authenticated;
grant select, insert, update, delete on public.chat_threads, public.chat_messages to authenticated;
grant select, insert, update, delete on public.user_tool_connections to authenticated;
grant select, insert on public.agent_tool_runs to authenticated;
grant select, insert, update, delete on public.scheduled_agent_tasks to authenticated;
grant all on public.users, public.chat_threads, public.chat_messages, public.tools,
  public.user_tool_connections, public.agent_tool_runs, public.scheduled_agent_tasks
  to service_role;

insert into public.tools (
  name, slug, toolkit_slug, description, category, logo_key, actions, sort_order
)
values
  ('Gmail', 'gmail', 'gmail', 'Connect and manage Gmail workflows.', 'Email', 'gmail',
    '[]'::jsonb, 10),
  ('Slack', 'slack', 'slack', 'Connect and manage Slack workflows.', 'Communication', 'slack',
    '[]'::jsonb, 20),
  ('Google Calendar', 'googlecalendar', 'googlecalendar',
    'Connect and manage Google Calendar workflows.', 'Productivity', 'googlecalendar',
    '[]'::jsonb, 30)
on conflict (slug) do update set
  name = excluded.name,
  toolkit_slug = excluded.toolkit_slug,
  description = excluded.description,
  category = excluded.category,
  logo_key = excluded.logo_key,
  sort_order = excluded.sort_order;
