-- =====================================================================
-- Endurecimiento de aislamiento multiproyecto (hallazgos Fase 12-13).
--
-- QUÉ HACE:
--   1. profiles: deja de ser legible por CUALQUIER usuario autenticado.
--      Ahora solo se ve el profile propio y los de personas con las que
--      compartes al menos un proyecto (función shares_project_with).
--   2. task_assignments: el responsable de una tarea debe ser miembro del
--      proyecto de esa tarea (comprobado en la base, no solo en la UI).
--   3. tasks: el área de una tarea debe pertenecer al mismo proyecto.
--
-- POR QUÉ (probado en vivo con scripts/rls-isolation-check.mjs):
--   - Con "Anonymous sign-ins" activo, cualquiera puede obtener una sesión
--     con rol "authenticated" sin invitación, y la política
--     profiles_select_authenticated (using true) le mostraba nombre y
--     correo de TODOS los usuarios de la plataforma.
--   - Un OWNER/ADMIN/MEMBER podía asignar una tarea a un usuario que no es
--     miembro del proyecto, y usar el área de otro proyecto.
--
-- AFECTA DATOS EXISTENTES: No borra ni modifica filas. Las nuevas reglas
--   solo se evalúan en escrituras nuevas (INSERT/UPDATE). Efecto visible en
--   lectura: el nombre/correo de alguien que YA NO comparte ningún proyecto
--   contigo deja de aparecer (p. ej. un miembro eliminado se ve como
--   "sin asignar"/"Alguien" en tareas y actividad antiguas).
-- IDEMPOTENTE: seguro de volver a ejecutar. No desactiva RLS.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------
create or replace function public.shares_project_with(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.project_members mine
    join public.project_members theirs on theirs.project_id = mine.project_id
    where mine.user_id = auth.uid()
      and theirs.user_id = p_user_id
  );
$$;

revoke execute on function public.shares_project_with(uuid) from public, anon;
grant execute on function public.shares_project_with(uuid) to authenticated;

drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_select_self_or_shared_project" on public.profiles;
create policy "profiles_select_self_or_shared_project"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.shares_project_with(id));

-- ---------------------------------------------------------------------
-- 2. task_assignments: el responsable debe ser miembro del proyecto
-- ---------------------------------------------------------------------
drop policy if exists "assignments_write_editors" on public.task_assignments;
create policy "assignments_write_editors"
  on public.task_assignments for all
  to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignments.task_id
        and public.has_project_role(t.project_id, array['OWNER','ADMIN','MEMBER']::public.project_role[])
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignments.task_id
        and public.has_project_role(t.project_id, array['OWNER','ADMIN','MEMBER']::public.project_role[])
        and public.is_project_member(t.project_id, task_assignments.user_id)
    )
  );

-- ---------------------------------------------------------------------
-- 3. tasks: el área debe ser del mismo proyecto
-- ---------------------------------------------------------------------
drop policy if exists "tasks_insert_editors" on public.tasks;
create policy "tasks_insert_editors"
  on public.tasks for insert
  to authenticated
  with check (
    public.has_project_role(tasks.project_id, array['OWNER','ADMIN','MEMBER']::public.project_role[])
    and (
      tasks.area_id is null
      or exists (
        select 1 from public.areas a
        where a.id = tasks.area_id and a.project_id = tasks.project_id
      )
    )
  );

drop policy if exists "tasks_update_editors" on public.tasks;
create policy "tasks_update_editors"
  on public.tasks for update
  to authenticated
  using (public.has_project_role(tasks.project_id, array['OWNER','ADMIN','MEMBER']::public.project_role[]))
  with check (
    public.has_project_role(tasks.project_id, array['OWNER','ADMIN','MEMBER']::public.project_role[])
    and (
      tasks.area_id is null
      or exists (
        select 1 from public.areas a
        where a.id = tasks.area_id and a.project_id = tasks.project_id
      )
    )
  );

commit;

-- =====================================================================
-- DIAGNÓSTICO (ejecutar por separado):
-- select tablename, policyname, cmd from pg_policies
-- where schemaname='public' and tablename in ('profiles','task_assignments','tasks')
-- order by tablename, cmd;
-- =====================================================================
