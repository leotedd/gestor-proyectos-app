-- =====================================================================
-- Enlaces / recursos de tareas (task_links).
--
-- QUÉ HACE: crea la tabla nueva public.task_links (varios enlaces por
--   tarea), su índice, trigger updated_at, grants por columna y RLS.
-- POR QUÉ: permitir adjuntar URLs (Drive, GitHub, etc.) a cada tarea sin
--   concatenarlas en un solo campo.
-- AFECTA DATOS EXISTENTES: No. 100% aditivo; no toca tablas existentes.
-- IDEMPOTENTE: seguro de volver a ejecutar.
-- DEPENDE DE: 0001 (tasks, profiles, set_updated_at, is_project_member,
--   has_project_role). No depende de 0004; se recomienda aplicarla después.
--
-- El proyecto se deriva de tasks; no hay project_id duplicado.
-- Roles: leer = cualquier miembro (incl. VIEWER e invitados anónimos, que
--   usan el rol Postgres "authenticated"); crear/editar = OWNER/ADMIN/MEMBER;
--   eliminar = OWNER/ADMIN.
-- =====================================================================
begin;

create table if not exists public.task_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  url text not null check (
    char_length(url) between 1 and 2048
    and url ~* '^https?://[^/?#@[:space:]]+([/?#][^[:space:]]*)?$'
    and url !~ '[[:cntrl:]]'
    and position(chr(92) in url) = 0
  ),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists task_links_task_created_idx on public.task_links(task_id, created_at, id);

drop trigger if exists set_task_links_updated_at on public.task_links;
create trigger set_task_links_updated_at before update on public.task_links
  for each row execute function public.set_updated_at();

alter table public.task_links enable row level security;

-- Solo título y URL pueden cambiar: no se pueden trasladar enlaces entre tareas.
revoke all on public.task_links from public, anon, authenticated;
grant select, delete on public.task_links to authenticated;
grant insert (task_id, title, url, created_by) on public.task_links to authenticated;
grant update (title, url) on public.task_links to authenticated;

drop policy if exists task_links_select_member on public.task_links;
create policy task_links_select_member on public.task_links for select to authenticated
using (exists (
  select 1 from public.tasks t where t.id = task_id
  and public.is_project_member(t.project_id)
));

drop policy if exists task_links_insert_editors on public.task_links;
create policy task_links_insert_editors on public.task_links for insert to authenticated
with check (created_by = auth.uid() and exists (
  select 1 from public.tasks t where t.id = task_id
  and public.has_project_role(t.project_id, array['OWNER','ADMIN','MEMBER']::public.project_role[])
));

drop policy if exists task_links_update_editors on public.task_links;
create policy task_links_update_editors on public.task_links for update to authenticated
using (exists (
  select 1 from public.tasks t where t.id = task_id
  and public.has_project_role(t.project_id, array['OWNER','ADMIN','MEMBER']::public.project_role[])
))
with check (exists (
  select 1 from public.tasks t where t.id = task_id
  and public.has_project_role(t.project_id, array['OWNER','ADMIN','MEMBER']::public.project_role[])
));

drop policy if exists task_links_delete_managers on public.task_links;
create policy task_links_delete_managers on public.task_links for delete to authenticated
using (exists (
  select 1 from public.tasks t where t.id = task_id
  and public.has_project_role(t.project_id, array['OWNER','ADMIN']::public.project_role[])
));

commit;
