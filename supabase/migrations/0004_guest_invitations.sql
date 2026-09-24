-- =====================================================================
-- Invitados temporales sin contraseña (Fase 4-6 del plan multiusuario).
--
-- QUÉ HACE:
--   1. Agrega columnas nuevas a `profiles` (username, is_guest) y a
--      `invitations` (accepted_at). Todas con DEFAULT / NULL permitido:
--      no rompe filas existentes.
--   2. Reemplaza `handle_new_user()` para que también funcione con
--      sesiones anónimas de Supabase Auth (auth.users.email puede venir
--      NULL en ese caso). Los usuarios reales (con email) no cambian de
--      comportamiento: siguen recibiendo su email/nombre normalmente.
--   3. Crea dos funciones nuevas SECURITY DEFINER:
--        - get_invitation_preview(token): permite mostrar el proyecto,
--          rol y correo de una invitación a alguien que TODAVÍA no tiene
--          sesión, sin exponer la tabla `invitations` completa (nunca se
--          listan invitaciones, solo se resuelve la que corresponde al
--          token exacto que el llamador ya conoce).
--        - accept_invitation_by_token(token, full_name, username):
--          valida la invitación (existe, pendiente, no expirada), valida
--          la identidad de auth.uid() con datos de auth.users (NO con
--          parámetros del cliente) y agrega al usuario a project_members
--          con el rol que definió quien invitó. Es atómica (una sola
--          transacción; cualquier RAISE revierte todo) y no depende de
--          políticas RLS adicionales de INSERT en project_members: es su
--          propia frontera de autorización, acotada a la fila de
--          invitación que recibe.
--            * Sesión ANÓNIMA (auth.users.is_anonymous = true): el token
--              es la credencial. Se completa su profile (nombre, usuario
--              y, si aún tiene el correo provisional, el correo de la
--              invitación). is_guest queda en true.
--            * Cuenta REAL (is_anonymous = false): su auth.users.email
--              debe estar confirmado y coincidir (sin distinguir
--              mayúsculas) con el de la invitación; si no, se rechaza.
--              Su profile NO se modifica (ni email ni nombre).
--
-- POR QUÉ:
--   Los invitados sin contraseña usan un inicio de sesión anónimo real
--   de Supabase Auth (auth.uid() válido) para que TODAS las políticas
--   RLS existentes sigan protegiendo sus datos sin excepciones ni uso
--   de la service_role key. Ver decisión registrada en la conversación
--   con el usuario (2026-09-20).
--
-- AFECTA DATOS EXISTENTES: No. Es 100% aditivo (ALTER ... ADD COLUMN IF
-- NOT EXISTS, CREATE OR REPLACE FUNCTION). No borra ni modifica filas.
--
-- REQUIERE ADEMÁS (fuera de SQL): habilitar "Anonymous sign-ins" en
-- Supabase Dashboard > Authentication > Providers > Anonymous.
--
-- Cómo aplicar: pega este archivo completo en el SQL Editor de Supabase
-- y ejecútalo (RUN). Es seguro volver a ejecutarlo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columnas nuevas
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists username text,
  add column if not exists is_guest boolean not null default false;

alter table public.invitations
  add column if not exists accepted_at timestamptz;

-- ---------------------------------------------------------------------
-- 2. handle_new_user(): ahora tolera auth.users.email NULL (anónimo).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, is_guest)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.email, 'invitado+' || replace(new.id::text, '-', '') || '@flowbase.local'),
    coalesce(new.is_anonymous, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. get_invitation_preview: lectura pública acotada por token exacto.
-- ---------------------------------------------------------------------
create or replace function public.get_invitation_preview(p_token uuid)
returns table (
  project_name text,
  project_key text,
  role public.project_role,
  email text,
  status public.invitation_status,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select p.name, p.key, i.role, i.email, i.status, i.expires_at
  from public.invitations i
  join public.projects p on p.id = i.project_id
  where i.token = p_token;
$$;

revoke execute on function public.get_invitation_preview(uuid) from public;
grant execute on function public.get_invitation_preview(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. accept_invitation_by_token: acepta la invitación para auth.uid().
--    El tipo de sesión (anónima / cuenta real) y su correo se leen de
--    auth.users con auth.uid(); NUNCA de un parámetro del cliente.
-- ---------------------------------------------------------------------
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
  -- 4 (auth.uid() existe)
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

  -- 5 (existe el profile de auth.uid())
  select exists (select 1 from public.profiles p where p.id = v_uid) into v_has_profile;
  if not v_has_profile then
    raise exception 'No existe un perfil para tu sesión.';
  end if;

  -- 1-3 (token existe, PENDING, no expirada). FOR UPDATE serializa
  -- intentos concurrentes con el mismo token.
  -- Nota: un RAISE revierte la función completa, por eso aquí NO se
  -- intenta marcar la invitación como EXPIRED antes de rechazar.
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

  if v_is_anonymous then
    -- Invitado: el token es la credencial. Completa su profile. El correo
    -- solo se fija si todavía es el provisional generado por
    -- handle_new_user(), para que un invitado que acepta una segunda
    -- invitación no cambie la identidad con la que ya entró.
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
    -- Cuenta real: solo puede aceptar una invitación dirigida a su propio
    -- correo (confirmado). Su profile no se toca.
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

-- Solo usuarios con sesión (reales o anónimos); nunca el rol anon/public.
revoke execute on function public.accept_invitation_by_token(uuid, text, text) from public, anon;
grant execute on function public.accept_invitation_by_token(uuid, text, text) to authenticated;

-- =====================================================================
-- DIAGNÓSTICO — ejecuta por separado para confirmar el resultado.
-- =====================================================================
-- select column_name from information_schema.columns
-- where table_schema='public' and table_name='profiles' and column_name in ('username','is_guest');
--
-- select column_name from information_schema.columns
-- where table_schema='public' and table_name='invitations' and column_name='accepted_at';
--
-- select proname from pg_proc
-- where pronamespace = 'public'::regnamespace
--   and proname in ('get_invitation_preview','accept_invitation_by_token');
-- =====================================================================
