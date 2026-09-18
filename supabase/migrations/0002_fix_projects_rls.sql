-- =====================================================================
-- Parche: corrige/reafirma las políticas RLS de creación de proyectos
-- y tablas relacionadas.
--
-- Motivo: al crear un proyecto (incluido el proyecto de demostración)
-- aparecía el error:
--   "new row violates row-level security policy for table \"projects\""
--
-- Este script es IDEMPOTENTE y seguro de volver a ejecutar: solo hace
-- DROP POLICY IF EXISTS + CREATE POLICY y CREATE OR REPLACE FUNCTION.
-- No borra tablas, no borra datos, no desactiva RLS en ningún momento.
--
-- Cómo aplicar:
--   1. Abre el SQL Editor de tu proyecto en https://supabase.com/dashboard
--   2. Pega el contenido completo de este archivo y ejecútalo (RUN).
--   3. Verifica con las consultas de diagnóstico al final del archivo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Reafirma las funciones de apoyo para RLS (SECURITY DEFINER).
--    Sin cambios de lógica; se reemplazan para garantizar que existan
--    exactamente así en la base de datos, sin importar qué se haya
--    ejecutado antes.
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
-- 2. projects — SELECT / INSERT / UPDATE / DELETE
--    La política clave para el error reportado es la de INSERT: un
--    usuario autenticado solo puede insertar un proyecto si el propio
--    `owner_id` de la fila que intenta crear coincide con su auth.uid().
-- ---------------------------------------------------------------------
alter table public.projects enable row level security;

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

-- ---------------------------------------------------------------------
-- 3. project_members — SELECT / INSERT / UPDATE / DELETE
--    Se añade una política nueva: permite que un usuario inserte SU
--    PROPIA fila de membresía cuando existe una invitación PENDING
--    válida (mismo proyecto, mismo correo, mismo rol, no expirada).
--    Sin esta política, aceptar una invitación fallaría con el mismo
--    tipo de error de RLS que "projects" (el invitado todavía no es
--    OWNER/ADMIN del proyecto al momento de aceptar).
-- ---------------------------------------------------------------------
alter table public.project_members enable row level security;

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

drop policy if exists "members_insert_self_via_invitation" on public.project_members;
create policy "members_insert_self_via_invitation"
  on public.project_members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.invitations i
      where i.project_id = project_members.project_id
        and i.role = project_members.role
        and i.status = 'PENDING'
        and i.expires_at > now()
        and lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

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

-- ---------------------------------------------------------------------
-- 4. areas — SELECT (miembros) / ALL (OWNER/ADMIN)
-- ---------------------------------------------------------------------
alter table public.areas enable row level security;

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

-- ---------------------------------------------------------------------
-- 5. tasks — SELECT (miembros) / INSERT+UPDATE (OWNER/ADMIN/MEMBER) /
--    DELETE (OWNER/ADMIN). Necesario para que el proyecto demo pueda
--    insertar sus ~20 tareas justo después de crear el proyecto.
-- ---------------------------------------------------------------------
alter table public.tasks enable row level security;

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

-- ---------------------------------------------------------------------
-- 6. task_assignments — sigue el rol del proyecto de la tarea.
--    Necesario para que el proyecto demo pueda asignarse a sí mismo
--    cada tarea recién creada.
-- ---------------------------------------------------------------------
alter table public.task_assignments enable row level security;

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

-- =====================================================================
-- 7. DIAGNÓSTICO — ejecuta esto por separado (seleccionado) para
--    confirmar qué políticas quedaron activas después de correr este
--    script. Debe listar exactamente las políticas creadas arriba.
-- =====================================================================
-- select tablename, policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('projects','project_members','areas','tasks','task_assignments')
-- order by tablename, cmd;

-- Para confirmar que RLS sigue ACTIVADO (nunca debe estar en "false"):
-- select relname, relrowsecurity
-- from pg_class
-- where relname in ('projects','project_members','areas','tasks','task_assignments');
-- =====================================================================
