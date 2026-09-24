-- =====================================================================
-- Protección de la propiedad del proyecto (hallazgo de la Fase 12-13).
--
-- PROBLEMA (probado en vivo): las políticas de project_members de 0001
-- solo exigían ser OWNER o ADMIN; no miraban el rol de la fila afectada
-- ni el rol que se asigna. Un ADMIN podía, llamando a la API directamente:
--   - insertar a cualquiera como OWNER,
--   - autopromoverse a OWNER,
--   - eliminar la membresía del OWNER original.
-- Rutas relacionadas que esta migración también cierra:
--   - crear una invitación con rol OWNER y aceptarla (la función
--     accept_invitation_by_token inserta como SECURITY DEFINER),
--   - cambiar projects.owner_id.
--
-- QUÉ HACE:
--   1. project_members / RLS
--        INSERT : no se puede crear una membresía con rol OWNER.
--        UPDATE : la fila del OWNER solo puede tocarla el propio OWNER
--                 (p. ej. su área); un ADMIN ya no puede modificarla.
--        DELETE : no se puede borrar la fila del OWNER.
--   2. Trigger en project_members (respaldo que también cubre funciones
--      SECURITY DEFINER y la política de auto-alta por invitación):
--        - solo puede existir un OWNER por proyecto (el que crea el
--          trigger on_project_created);
--        - el rol OWNER no se puede otorgar ni quitar mediante UPDATE, y la
--          fila de un OWNER no puede cambiar de usuario ni de proyecto.
--   3. invitations: el rol OWNER no se puede invitar (CHECK ... NOT VALID:
--      se aplica a filas nuevas o modificadas, no revisa las existentes).
--      accept_invitation_by_token rechaza además cualquier invitación OWNER
--      que pudiera existir (única modificación respecto a 0004).
--   4. projects: owner_id no se puede cambiar (no hay transferencia de
--      propiedad en la aplicación).
--
-- LO QUE NO CAMBIA:
--   - Crear un proyecto sigue creando al creador como OWNER: el trigger
--     handle_new_project() es SECURITY DEFINER e inserta cuando todavía no
--     hay ningún OWNER.
--   - Eliminar un proyecto sigue funcionando: la cascada de claves foráneas
--     no pasa por RLS ni por las políticas nuevas, y los triggers nuevos
--     no intervienen en DELETE.
--   - Cuando se borra un área, el ON DELETE SET NULL sobre
--     project_members.area_id sigue funcionando (no cambia rol, usuario ni
--     proyecto).
--   - OWNER conserva: gestionar miembros no-OWNER, tareas, áreas,
--     documentos, invitaciones, configuración, archivar y borrar el
--     proyecto. ADMIN conserva lo que tenía salvo tocar al OWNER.
--   - MEMBER y VIEWER no obtienen ningún permiso adicional.
--
-- AFECTA DATOS EXISTENTES: No borra ni modifica filas. IDEMPOTENTE.
-- COMPATIBLE con 0001-0006. No desactiva RLS ni usa service_role.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. project_members: políticas RLS
-- ---------------------------------------------------------------------
drop policy if exists "members_insert_owner_admin" on public.project_members;
create policy "members_insert_owner_admin"
  on public.project_members for insert
  to authenticated
  with check (
    public.has_project_role(project_members.project_id, array['OWNER','ADMIN']::public.project_role[])
    and project_members.role <> 'OWNER'
  );

drop policy if exists "members_update_owner_admin" on public.project_members;
create policy "members_update_owner_admin"
  on public.project_members for update
  to authenticated
  using (
    public.has_project_role(project_members.project_id, array['OWNER','ADMIN']::public.project_role[])
    and (project_members.role <> 'OWNER' or project_members.user_id = auth.uid())
  )
  with check (
    public.has_project_role(project_members.project_id, array['OWNER','ADMIN']::public.project_role[])
  );

drop policy if exists "members_delete_owner_admin" on public.project_members;
create policy "members_delete_owner_admin"
  on public.project_members for delete
  to authenticated
  using (
    public.has_project_role(project_members.project_id, array['OWNER','ADMIN']::public.project_role[])
    and project_members.role <> 'OWNER'
  );

-- ---------------------------------------------------------------------
-- 2. project_members: trigger de respaldo sobre el rol OWNER
-- ---------------------------------------------------------------------
create or replace function public.protect_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.role = 'OWNER' and exists (
      select 1 from public.project_members m
      where m.project_id = new.project_id and m.role = 'OWNER'
    ) then
      raise exception 'El proyecto ya tiene un propietario.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE: el rol OWNER no se otorga ni se quita; la fila del OWNER no se reasigna.
  if new.role is distinct from old.role and (old.role = 'OWNER' or new.role = 'OWNER') then
    raise exception 'El rol de propietario no se puede cambiar.' using errcode = '42501';
  end if;
  if old.role = 'OWNER' and (
    new.user_id is distinct from old.user_id or new.project_id is distinct from old.project_id
  ) then
    raise exception 'La membresía del propietario no se puede reasignar.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_owner_membership on public.project_members;
create trigger protect_owner_membership
  before insert or update on public.project_members
  for each row execute function public.protect_owner_membership();

-- ---------------------------------------------------------------------
-- 3. invitations: no se puede invitar como OWNER
-- ---------------------------------------------------------------------
alter table public.invitations drop constraint if exists invitations_role_not_owner;
alter table public.invitations
  add constraint invitations_role_not_owner check (role <> 'OWNER') not valid;

-- accept_invitation_by_token: igual que en 0004 + rechazo de invitaciones OWNER.
create or replace function public.accept_invitation_by_token(
  p_token uuid,
  p_full_name text,
  p_username text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invitation public.invitations%rowtype;
  v_auth_email text;
  v_auth_confirmed timestamptz;
  v_is_anonymous boolean;
  v_has_profile boolean;
begin
  if v_uid is null then
    raise exception 'No hay sesión activa.';
  end if;

  select u.email, u.email_confirmed_at, coalesce(u.is_anonymous, false)
    into v_auth_email, v_auth_confirmed, v_is_anonymous
  from auth.users u
  where u.id = v_uid;

  if not found then
    raise exception 'No hay sesión activa.';
  end if;

  select exists (select 1 from public.profiles p where p.id = v_uid) into v_has_profile;
  if not v_has_profile then
    raise exception 'No existe un perfil para tu sesión.';
  end if;

  select * into v_invitation
  from public.invitations
  where token = p_token
  for update;

  if not found then
    raise exception 'Invitación no encontrada.';
  end if;

  if v_invitation.status <> 'PENDING' then
    raise exception 'Esta invitación ya no está disponible.';
  end if;

  if v_invitation.expires_at < now() then
    raise exception 'Esta invitación ha expirado.';
  end if;

  if v_invitation.role = 'OWNER' then
    raise exception 'Las invitaciones no pueden otorgar el rol de propietario.';
  end if;

  if v_is_anonymous then
    update public.profiles
       set full_name = coalesce(nullif(left(btrim(p_full_name), 120), ''), full_name),
           username = coalesce(nullif(left(btrim(p_username), 40), ''), username),
           email = case
                     when email like 'invitado+%@flowbase.local' then v_invitation.email
                     else email
                   end,
           is_guest = true
     where id = v_uid;
  else
    if v_auth_email is null
       or v_auth_confirmed is null
       or lower(v_auth_email) <> lower(v_invitation.email) then
      raise exception 'Esta invitación no corresponde a tu cuenta.';
    end if;
  end if;

  insert into public.project_members (project_id, user_id, role, invited_by)
  values (v_invitation.project_id, v_uid, v_invitation.role, v_invitation.invited_by)
  on conflict (project_id, user_id) do nothing;

  update public.invitations
     set status = 'ACCEPTED', accepted_at = now()
   where id = v_invitation.id;

  insert into public.activity_logs (project_id, user_id, action, entity_type, entity_id, metadata)
  values (
    v_invitation.project_id, v_uid, 'invitation.accepted', 'invitation', v_invitation.id,
    jsonb_build_object('guest', v_is_anonymous)
  );

  return v_invitation.project_id;
end;
$$;

revoke execute on function public.accept_invitation_by_token(uuid, text, text) from public, anon;
grant execute on function public.accept_invitation_by_token(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. projects: owner_id inmutable (no hay transferencia de propiedad)
-- ---------------------------------------------------------------------
create or replace function public.protect_project_owner_id()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'El propietario del proyecto no se puede cambiar.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_project_owner_id on public.projects;
create trigger protect_project_owner_id
  before update of owner_id on public.projects
  for each row execute function public.protect_project_owner_id();

commit;

-- =====================================================================
-- DIAGNÓSTICO (ejecutar por separado, opcional):
-- select policyname, cmd from pg_policies
-- where schemaname='public' and tablename='project_members' order by cmd, policyname;
--
-- select tgname, tgrelid::regclass from pg_trigger
-- where tgname in ('protect_owner_membership','protect_project_owner_id');
--
-- select conname, convalidated from pg_constraint where conname='invitations_role_not_owner';
-- =====================================================================
