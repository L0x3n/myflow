-- MyFlow databas-schema (MASTERPLAN §4)
-- Kör i Supabase: SQL Editor → klistra in allt → Run.
-- Idempotent nog att köra en gång per nytt projekt.

-- Ärenden (större saker med delsteg, t.ex. "Fixa körkortstillstånd")
create table errands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  status text not null default 'active', -- active | waiting | done
  deadline date,
  created_at timestamptz default now()
);

-- Uppgifter (fristående todos OCH delsteg i ärenden)
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  errand_id uuid references errands on delete cascade, -- null = fristående
  title text not null,
  status text not null default 'todo', -- todo | doing | waiting | done
  deadline date,
  estimated_minutes int,
  is_top3 boolean default false,       -- ingår i dagens tre
  top3_date date,                      -- vilket datum den var top3
  flow_order int,                      -- FlowPlan-position
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Mediciner
create table medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  times time[] not null,               -- t.ex. {08:00, 20:00}
  active boolean default true
);

-- on delete cascade tillagt (avvikelse från masterplan): utan den går det
-- inte att ta bort en medicin som redan har loggar.
create table medication_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  medication_id uuid references medications on delete cascade not null,
  scheduled_at timestamptz not null,
  taken_at timestamptz                 -- null = ej tagen (visas aldrig som "missad")
);

-- Energiloggar (dagens "Hur mår du?")
create table energy_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  date date not null,
  level int not null check (level between 1 and 3), -- 1 låg, 2 ok, 3 bra
  unique (user_id, date)
);

-- Aktiviteter (manuell minikalender — INGEN sync i MVP)
create table activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  starts_at timestamptz not null,
  location text
);

-- Friktionsindex (feedbackknapp i appen)
create table frictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  description text not null,
  frequency int check (frequency between 1 and 5),
  load int check (load between 1 and 5),
  created_at timestamptz default now()
);

-- Flow-konversationer
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  role text not null,                  -- user | assistant
  content text not null,
  created_at timestamptz default now()
);

-- RLS: användaren ser och rör bara sina egna rader.
alter table errands enable row level security;
alter table tasks enable row level security;
alter table medications enable row level security;
alter table medication_logs enable row level security;
alter table energy_logs enable row level security;
alter table activities enable row level security;
alter table frictions enable row level security;
alter table chat_messages enable row level security;

create policy "own errands" on errands for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tasks" on tasks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own medications" on medications for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own medication_logs" on medication_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own energy_logs" on energy_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own activities" on activities for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own frictions" on frictions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own chat_messages" on chat_messages for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Index för de vanligaste frågorna
create index tasks_user_status_idx on tasks (user_id, status);
create index medication_logs_user_scheduled_idx on medication_logs (user_id, scheduled_at);
create index chat_messages_user_created_idx on chat_messages (user_id, created_at);
create index activities_user_starts_idx on activities (user_id, starts_at);
