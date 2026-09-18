-- =====================================================================
-- Parche: permite que el propietario de un proyecto pueda leer la fila
-- que acaba de insertar (RETURNING / .select() inmediato tras el INSERT),
-- sin depender de que la membresía OWNER creada por el trigger
-- on_project_created / handle_new_project() ya sea visible.
--
-- Motivo (diagnóstico técnico, ver auditoría de RLS del proyecto):
--   is_project_member(id) es una función `stable`. Las funciones STABLE
--   evalúan sobre la instantánea (snapshot) vigente al inicio de la
--   sentencia SQL en curso y NO ven los cambios hechos por un trigger
--   (BEFORE o AFTER) dentro de esa misma sentencia. Como
--   "INSERT INTO projects ... RETURNING id" revalida la política SELECT
--   para decidir qué se devuelve, y el trigger AFTER INSERT
--   on_project_created (handle_new_project) inserta la fila OWNER en
--   project_members DENTRO de esa misma sentencia, is_project_member(id)
--   no alcanza a ver esa membresía todavía → la política SELECT da
--   `false` → Postgres rechaza el RETURNING con:
--     "new row violates row-level security policy for table projects"
--   aunque el INSERT en sí (política projects_insert_self_owner,
--   owner_id = auth.uid()) sea perfectamente válido.
--
-- Corrección: añadir una condición adicional en la política SELECT que
-- no dependa de ninguna otra tabla ni de ningún trigger — el propio
-- owner_id de la fila que se está insertando/devolviendo. Esa columna
-- ya está disponible en la fila en el momento del RETURNING, así que es
-- inmune al problema de visibilidad STABLE/trigger.
--
-- Este script es IDEMPOTENTE y seguro de volver a ejecutar: solo hace
-- DROP POLICY IF EXISTS + CREATE POLICY dentro de una transacción.
-- No borra tablas, no borra datos, no desactiva RLS en ningún momento.
-- No modifica las políticas INSERT/UPDATE/DELETE de projects, no
-- modifica handle_new_project() ni ninguna otra función o trigger.
--
-- Cómo aplicar:
--   1. Abre el SQL Editor de tu proyecto en https://supabase.com/dashboard
--   2. Pega el contenido completo de este archivo y ejecútalo (RUN).
--   3. Verifica con las consultas de diagnóstico al final del archivo.
-- =====================================================================

BEGIN;

DROP POLICY IF EXISTS "projects_select_member"
ON public.projects;

CREATE POLICY "projects_select_member"
ON public.projects
FOR SELECT
TO authenticated
USING (
  public.is_project_member(id)
  OR owner_id = (SELECT auth.uid())
);

COMMIT;

-- =====================================================================
-- DIAGNÓSTICO — ejecuta esto por separado (seleccionado) para confirmar
-- que la política quedó como se espera.
-- =====================================================================
-- select tablename, policyname, cmd, roles, qual
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'projects'
--   and policyname = 'projects_select_member';

-- Para confirmar que RLS sigue ACTIVADO (nunca debe estar en "false"):
-- select relname, relrowsecurity
-- from pg_class
-- where relname = 'projects';
-- =====================================================================
