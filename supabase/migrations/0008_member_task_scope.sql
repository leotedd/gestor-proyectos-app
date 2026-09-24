-- =====================================================================
-- Alcance de MIEMBRO sobre tareas (Fase 2 del rediseño de permisos).
--
-- PROBLEMA: las Server Actions ya restringen esto (createTaskAction exige
-- OWNER/ADMIN; updateTaskAction/moveTaskAction verifican que el MIEMBRO sea
-- el responsable y solo dejan tocar estado/progreso/fecha límite), pero la
-- RLS de "tasks" y "task_assignments" seguía permitiendo a CUALQUIER
-- MIEMBRO, llamando a la API de Supabase directamente (sin pasar por la
-- app), crear tareas, editar cualquier campo de cualquier tarea del
-- proyecto, o reasignar el responsable de una tarea ajena.
--
-- QUÉ HACE:
--   1. tasks_insert_editors: ya NO incluye MEMBER (solo OWNER/ADMIN crean).
--   2. assignments_write_editors: ya NO incluye MEMBER (solo OWNER/ADMIN
--      asignan o reasignan responsables). Cierra además "MIEMBRO no puede
--      asignarse tareas por sí mismo".
--   3. Trigger enforce_task_write_rules en tasks (BEFORE INSERT OR UPDATE):
--        - Consistencia estado/progreso para CUALQUIER rol: si status
--          pasa a 'DONE', progress siempre queda en 100.
--        - Para UPDATE de un MIEMBRO: exige que sea el responsable
--          asignado (task_assignments) y que NO cambie ninguna columna
--          fuera de status/progress/due_date/position (position se
--          permite porque el propio Kanban la usa para reordenar la
--          tarjeta al moverla, algo que la Fase 2 pide conservar).
--        - OWNER/ADMIN: sin restricciones adicionales (igual que hoy).
--
-- LO QUE NO CAMBIA: tasks_update_editors sigue permitiendo UPDATE a
-- OWNER/ADMIN/MEMBER a nivel de fila (ya lo hacía desde 0001/0006); el
-- trigger es quien decide, fila por fila, qué le está permitido a un
-- MEMBER. tasks_delete_owner_admin ya era solo OWNER/ADMIN, sin cambios.
--
-- AFECTA DATOS EXISTENTES: No borra ni modifica filas. IDEMPOTENTE.
-- COMPATIBLE con 0001-0007. No desactiva RLS ni usa service_role. No toca
-- ninguna policy de "projects".
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. tasks: solo OWNER/ADMIN insertan
-- ---------------------------------------------------------------------
drop policy if exists "tasks_insert_editors" on public.tasks;
create policy "tasks_insert_editors"
  on public.tasks for insert
  to authenticated
  with check (
    public.has_project_role(tasks.project_id, array['OWNER','ADMIN']::public.project_role[])
    and (
      tasks.area_id is null
      or exists (
        select 1 from public.areas a
        where a.id = tasks.area_id and a.project_id = tasks.project_id
      )
    )
  );

-- ---------------------------------------------------------------------
-- 2. task_assignments: solo OWNER/ADMIN asignan/reasignan/quitan
-- ---------------------------------------------------------------------
drop policy if exists "assignments_write_editors" on public.task_assignments;
create policy "assignments_write_editors"
  on public.task_assignments for all
  to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignments.task_id
        and public.has_project_role(t.project_id, array['OWNER','ADMIN']::public.project_role[])
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignments.task_id
        and public.has_project_role(t.project_id, array['OWNER','ADMIN']::public.project_role[])
        and public.is_project_member(t.project_id, task_assignments.user_id)
    )
  );

-- ---------------------------------------------------------------------
-- 3. tasks: consistencia estado/progreso + alcance de columnas para MEMBER
-- ---------------------------------------------------------------------
create or replace function public.enforce_task_write_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.project_role;
begin
  -- Universal: al completar una tarea, el progreso siempre queda en 100.
  if new.status = 'DONE' then
    new.progress := 100;
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  v_role := public.get_project_role(new.project_id, auth.uid());

  if v_role in ('OWNER','ADMIN') then
    return new;
  end if;

  if v_role = 'MEMBER' then
    if not exists (
      select 1 from public.task_assignments ta
      where ta.task_id = old.id and ta.user_id = auth.uid()
    ) then
      raise exception 'Solo puedes modificar tareas que tengas asignadas.' using errcode = '42501';
    end if;

    if new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.area_id is distinct from old.area_id
       or new.priority is distinct from old.priority
       or new.labels is distinct from old.labels
       or new.start_date is distinct from old.start_date
       or new.code is distinct from old.code
       or new.project_id is distinct from old.project_id
       or new.created_by is distinct from old.created_by
    then
      raise exception 'Como miembro solo puedes modificar estado, progreso y fecha límite.' using errcode = '42501';
    end if;

    return new;
  end if;

  raise exception 'No tienes permisos para modificar esta tarea.' using errcode = '42501';
end;
$$;

drop trigger if exists enforce_task_write_rules on public.tasks;
create trigger enforce_task_write_rules
  before insert or update on public.tasks
  for each row execute function public.enforce_task_write_rules();

commit;

-- =====================================================================
-- DIAGNÓSTICO (ejecutar por separado, opcional):
-- select policyname, cmd from pg_policies
-- where schemaname='public' and tablename in ('tasks','task_assignments') order by tablename, cmd;
--
-- select tgname from pg_trigger where tgname = 'enforce_task_write_rules';
-- =====================================================================
