-- =====================================================================
-- Gestor de Proyectos — Plataforma multiproyecto
-- Migración inicial: tipos, tablas, índices, funciones, triggers, RLS.
--
-- Cómo aplicar:
--   1. Abre el SQL Editor de tu proyecto en https://supabase.com/dashboard
--   2. Pega el contenido completo de este archivo y ejecútalo (RUN).
--   3. Verifica que no haya errores. Es seguro volver a ejecutarlo
--      (usa IF NOT EXISTS / OR REPLACE / ON CONFLICT en todo lo posible).
--   4. Crea el bucket de Storage "project-documents" — este script ya
--      lo intenta crear vía SQL (storage.buckets), pero si tu plan no
--      lo permite, créalo manualmente como bucket PRIVADO desde
--      Storage > New bucket > name: project-documents > Public: OFF.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONES
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- 1. TIPOS / ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type public.project_role as enum ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_status as enum ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_priority as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invitation_status as enum ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. TABLAS
-- ---------------------------------------------------------------------

-- Perfiles (1:1 con auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Proyectos
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null,
  description text not null default '',
  status public.project_status not null default 'ACTIVE',
  start_date date,
  end_date date,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  next_task_number integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint projects_key_format check (key ~ '^[A-Z0-9]{2,10}$')
);
create unique index if not exists projects_key_unique_idx on public.projects (key);
create index if not exists projects_owner_idx on public.projects (owner_id);

-- Miembros de proyecto (rol por proyecto)
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.project_role not null default 'MEMBER',
  area_id uuid,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);
create index if not exists project_members_project_idx on public.project_members (project_id);
create index if not exists project_members_user_idx on public.project_members (user_id);

-- Áreas / equipos
create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  unique (project_id, name)
);
create index if not exists areas_project_idx on public.areas (project_id);

alter table public.project_members
  add constraint project_members_area_fk
  foreign key (area_id) references public.areas (id) on delete set null;

-- Tareas
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  code text not null,
  title text not null,
  description text not null default '',
  area_id uuid references public.areas (id) on delete set null,
  priority public.task_priority not null default 'MEDIUM',
  status public.task_status not null default 'TODO',
  start_date date,
  due_date date,
  progress integer not null default 0 check (progress between 0 and 100),
  labels text[] not null default '{}',
  position double precision not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code)
);
create index if not exists tasks_project_idx on public.tasks (project_id);
create index if not exists tasks_status_idx on public.tasks (project_id, status);
create index if not exists tasks_area_idx on public.tasks (area_id);
create index if not exists tasks_due_date_idx on public.tasks (project_id, due_date);

-- Asignaciones de tarea (permite futura multi-asignación; hoy 1 responsable típico)
create table if not exists public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (task_id, user_id)
);
create index if not exists task_assignments_task_idx on public.task_assignments (task_id);
create index if not exists task_assignments_user_idx on public.task_assignments (user_id);

-- Comentarios de tarea
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists task_comments_task_idx on public.task_comments (task_id);

-- Adjuntos / evidencias (metadatos; el binario vive en Storage)
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  uploaded_by uuid references public.profiles (id) on delete set null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size bigint,
  created_at timestamptz not null default now()
);
create index if not exists attachments_project_idx on public.attachments (project_id);
create index if not exists attachments_task_idx on public.attachments (task_id);

-- Invitaciones
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  email text not null,
  role public.project_role not null default 'MEMBER',
  token uuid not null default gen_random_uuid(),
  status public.invitation_status not null default 'PENDING',
  expires_at timestamptz not null default (now() + interval '7 days'),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists invitations_token_unique_idx on public.invitations (token);
create index if not exists invitations_project_idx on public.invitations (project_id);
create index if not exists invitations_email_idx on public.invitations (lower(email));

-- Historial / auditoría
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_project_idx on public.activity_logs (project_id, created_at desc);

-- ---------------------------------------------------------------------
-- 3. FUNCIONES DE APOYO PARA RLS (SECURITY DEFINER, sin recursión)
-- ---------------------------------------------------------------------

create or replace function public.is_project_member(p_project_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = p_user_id
  );
$$;

create or replace function public.get_project_role(p_project_id uuid, p_user_id uuid default auth.uid())
returns public.project_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.project_members
  where project_id = p_project_id and user_id = p_user_id
  limit 1;
$$;

create or replace function public.has_project_role(p_project_id uuid, p_roles public.project_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid() and role = any(p_roles)
  );
$$;

grant execute on function public.is_project_member(uuid, uuid) to authenticated;
grant execute on function public.get_project_role(uuid, uuid) to authenticated;
grant execute on function public.has_project_role(uuid, public.project_role[]) to authenticated;

-- ---------------------------------------------------------------------
-- 4. TRIGGERS
-- ---------------------------------------------------------------------

-- 4.1 Crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4.2 updated_at genérico
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 4.3 Owner automático como miembro OWNER al crear proyecto
create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'OWNER')
  on conflict (project_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_project_created on public.projects;
create trigger on_project_created
  after insert on public.projects
  for each row execute function public.handle_new_project();

-- 4.4 Código legible de tarea (PREFIJO-001) autoincremental por proyecto
create or replace function public.handle_new_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_number integer;
begin
  if new.code is not null and length(new.code) > 0 then
    return new;
  end if;

  update public.projects
     set next_task_number = next_task_number + 1
   where id = new.project_id
   returning key, next_task_number - 1 into v_key, v_number;

  new.code := v_key || '-' || lpad(v_number::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists set_task_code on public.tasks;
create trigger set_task_code
  before insert on public.tasks
  for each row execute function public.handle_new_task();

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.areas enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.task_comments enable row level security;
alter table public.attachments enable row level security;
alter table public.invitations enable row level security;
alter table public.activity_logs enable row level security;

-- profiles: cualquier usuario autenticado puede ver perfiles (nombres/avatares
-- para listas de miembros/asignación); solo el dueño edita el suyo.
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- projects: solo miembros ven el proyecto.
drop policy if exists "projects_select_member" on public.projects;
create policy "projects_select_member"
  on public.projects for select
  to authenticated
  using (public.is_project_member(id));

drop policy if exists "projects_insert_self_owner" on public.projects;
create policy "projects_insert_self_owner"
  on public.projects for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "projects_update_owner_admin" on public.projects;
create policy "projects_update_owner_admin"
  on public.projects for update
  to authenticated
  using (public.has_project_role(id, array['OWNER','ADMIN']::public.project_role[]))
  with check (public.has_project_role(id, array['OWNER','ADMIN']::public.project_role[]));

drop policy if exists "projects_delete_owner" on public.projects;
create policy "projects_delete_owner"
  on public.projects for delete
  to authenticated
  using (public.has_project_role(id, array['OWNER']::public.project_role[]));

-- project_members
drop policy if exists "members_select_same_project" on public.project_members;
create policy "members_select_same_project"
  on public.project_members for select
  to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "members_insert_owner_admin" on public.project_members;
create policy "members_insert_owner_admin"
  on public.project_members for insert
  to authenticated
  with check (public.has_project_role(project_id, array['OWNER','ADMIN']::public.project_role[]));

drop policy if exists "members_update_owner_admin" on public.project_members;
create policy "members_update_owner_admin"
  on public.project_members for update
  to authenticated
  using (public.has_project_role(project_id, array['OWNER','ADMIN']::public.project_role[]))
  with check (public.has_project_role(project_id, array['OWNER','ADMIN']::public.project_role[]));

drop policy if exists "members_delete_owner_admin" on public.project_members;
create policy "members_delete_owner_admin"
  on public.project_members for delete
  to authenticated
  using (public.has_project_role(project_id, array['OWNER','ADMIN']::public.project_role[]));

-- areas: lectura para miembros, escritura OWNER/ADMIN
drop policy if exists "areas_select_member" on public.areas;
create policy "areas_select_member"
  on public.areas for select
  to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "areas_write_owner_admin" on public.areas;
create policy "areas_write_owner_admin"
  on public.areas for all
  to authenticated
  using (public.has_project_role(project_id, array['OWNER','ADMIN']::public.project_role[]))
  with check (public.has_project_role(project_id, array['OWNER','ADMIN']::public.project_role[]));

-- tasks: lectura para miembros (incluye VIEWER); escritura OWNER/ADMIN/MEMBER
drop policy if exists "tasks_select_member" on public.tasks;
create policy "tasks_select_member"
  on public.tasks for select
  to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "tasks_insert_editors" on public.tasks;
create policy "tasks_insert_editors"
  on public.tasks for insert
  to authenticated
  with check (public.has_project_role(project_id, array['OWNER','ADMIN','MEMBER']::public.project_role[]));

drop policy if exists "tasks_update_editors" on public.tasks;
create policy "tasks_update_editors"
  on public.tasks for update
  to authenticated
  using (public.has_project_role(project_id, array['OWNER','ADMIN','MEMBER']::public.project_role[]))
  with check (public.has_project_role(project_id, array['OWNER','ADMIN','MEMBER']::public.project_role[]));

drop policy if exists "tasks_delete_owner_admin" on public.tasks;
create policy "tasks_delete_owner_admin"
  on public.tasks for delete
  to authenticated
  using (public.has_project_role(project_id, array['OWNER','ADMIN']::public.project_role[]));

-- task_assignments: sigue el rol del proyecto de la tarea
drop policy if exists "assignments_select_member" on public.task_assignments;
create policy "assignments_select_member"
  on public.task_assignments for select
  to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_project_member(t.project_id)
    )
  );

drop policy if exists "assignments_write_editors" on public.task_assignments;
create policy "assignments_write_editors"
  on public.task_assignments for all
  to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and public.has_project_role(t.project_id, array['OWNER','ADMIN','MEMBER']::public.project_role[])
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and public.has_project_role(t.project_id, array['OWNER','ADMIN','MEMBER']::public.project_role[])
    )
  );

-- task_comments
drop policy if exists "comments_select_member" on public.task_comments;
create policy "comments_select_member"
  on public.task_comments for select
  to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_project_member(t.project_id)
    )
  );

drop policy if exists "comments_insert_editors" on public.task_comments;
create policy "comments_insert_editors"
  on public.task_comments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and public.has_project_role(t.project_id, array['OWNER','ADMIN','MEMBER']::public.project_role[])
    )
  );

-- attachments: lectura miembros; escritura editores; borrado autor u OWNER/ADMIN
drop policy if exists "attachments_select_member" on public.attachments;
create policy "attachments_select_member"
  on public.attachments for select
  to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "attachments_insert_editors" on public.attachments;
create policy "attachments_insert_editors"
  on public.attachments for insert
  to authenticated
  with check (public.has_project_role(project_id, array['OWNER','ADMIN','MEMBER']::public.project_role[]));

drop policy if exists "attachments_delete_author_or_admin" on public.attachments;
create policy "attachments_delete_author_or_admin"
  on public.attachments for delete
  to authenticated
  using (
    uploaded_by = auth.uid()
    or public.has_project_role(project_id, array['OWNER','ADMIN']::public.project_role[])
  );

-- invitations: solo OWNER/ADMIN gestionan
drop policy if exists "invitations_select_owner_admin" on public.invitations;
create policy "invitations_select_owner_admin"
  on public.invitations for select
  to authenticated
  using (public.has_project_role(project_id, array['OWNER','ADMIN']::public.project_role[]));

drop policy if exists "invitations_write_owner_admin" on public.invitations;
create policy "invitations_write_owner_admin"
  on public.invitations for all
  to authenticated
  using (public.has_project_role(project_id, array['OWNER','ADMIN']::public.project_role[]))
  with check (public.has_project_role(project_id, array['OWNER','ADMIN']::public.project_role[]));

-- Un invitado (por email) puede leer SU invitación pendiente para poder aceptarla,
-- aunque todavía no sea miembro del proyecto.
drop policy if exists "invitations_select_own_email" on public.invitations;
create policy "invitations_select_own_email"
  on public.invitations for select
  to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- activity_logs: lectura miembros; inserción cualquier miembro (registra su propia acción)
drop policy if exists "activity_select_member" on public.activity_logs;
create policy "activity_select_member"
  on public.activity_logs for select
  to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "activity_insert_member" on public.activity_logs;
create policy "activity_insert_member"
  on public.activity_logs for insert
  to authenticated
  with check (public.is_project_member(project_id) and user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 6. STORAGE: bucket privado + políticas
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', false)
on conflict (id) do nothing;

-- Convención de ruta: projects/{project_id}/... (general o tasks/{task_id}/...)
drop policy if exists "documents_select_member" on storage.objects;
create policy "documents_select_member"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'project-documents'
    and public.is_project_member(nullif(split_part(name, '/', 2), '')::uuid)
  );

drop policy if exists "documents_insert_editors" on storage.objects;
create policy "documents_insert_editors"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'project-documents'
    and public.has_project_role(
      nullif(split_part(name, '/', 2), '')::uuid,
      array['OWNER','ADMIN','MEMBER']::public.project_role[]
    )
  );

drop policy if exists "documents_delete_author_or_admin" on storage.objects;
create policy "documents_delete_author_or_admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'project-documents'
    and (
      owner = auth.uid()
      or public.has_project_role(
        nullif(split_part(name, '/', 2), '')::uuid,
        array['OWNER','ADMIN']::public.project_role[]
      )
    )
  );

-- =====================================================================
-- Fin de la migración.
-- =====================================================================
