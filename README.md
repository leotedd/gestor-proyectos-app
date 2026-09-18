# Flowbase — Plataforma de gestión de proyectos

Plataforma multiproyecto (estilo Jira/ClickUp) construida con Next.js 16 (App
Router), Supabase (Auth + Postgres + Storage), Tailwind CSS v4 y dnd-kit.

Un mismo usuario puede administrar varios proyectos independientes entre sí
(miembros, roles, tareas, áreas, documentos, cronograma e historial propios
por proyecto).

## 1. Requisitos

- Node.js 20.9+
- Un proyecto de Supabase (gratuito sirve)

## 2. Variables de entorno

Copia `.env.example` a `.env.local` y completa:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# Opcional, para invitaciones por correo:
RESEND_API_KEY=...
```

`.env.local` nunca se sube al repositorio. Si `RESEND_API_KEY` no está
configurada, las invitaciones se siguen creando en la base de datos, solo que
el correo no se envía (la UI lo indica).

## 3. Base de datos (obligatorio, hazlo tú en el panel de Supabase)

1. Abre tu proyecto en https://supabase.com/dashboard
2. Ve a **SQL Editor** → **New query**
3. Pega el contenido completo de `supabase/migrations/0001_init.sql`
4. Ejecuta (**RUN**). Es seguro volver a ejecutarlo si algo falla a mitad de
   camino: usa `if not exists` / `or replace` en casi todo.
5. Verifica en **Storage** que exista el bucket `project-documents` marcado
   como **privado**. El script intenta crearlo por SQL; si tu plan no lo
   permite, créalo manualmente (Storage → New bucket → `project-documents`,
   Public **OFF**).
6. (Opcional pero recomendado) En **Authentication → URL Configuration**,
   agrega `http://localhost:3000/auth/callback` a las Redirect URLs, para que
   la confirmación de correo y la recuperación de contraseña funcionen.
7. Pega y ejecuta también `supabase/migrations/0002_fix_projects_rls.sql`
   (reafirma las políticas de `projects`/`project_members`/`areas`/`tasks`/
   `task_assignments` y agrega el permiso que faltaba para aceptar
   invitaciones). Es idempotente: no borra tablas ni datos.

Todo el aislamiento entre proyectos y los roles (OWNER/ADMIN/MEMBER/VIEWER)
están implementados con Row Level Security — no dependen de ocultar botones
en el frontend.

## 4. Instalar y correr

```bash
npm install
npm run dev
```

Abre http://localhost:3000, crea una cuenta y confirma el correo (si tu
proyecto de Supabase tiene la confirmación de email activada).

## 5. Datos de demostración

Dentro de **Mis proyectos**, el botón **"Crear proyecto de demostración"**
genera un proyecto de ejemplo ("Sistema Integral de Gestión Sacramental y
Pastoral") con áreas y ~20 tareas repartidas en todos los estados, prioridades
y fechas, para que el Kanban, el dashboard, el cronograma y la vista de
miembros tengan contenido real de inmediato. La parroquia es únicamente el
contenido de ese proyecto de ejemplo; la plataforma es genérica.

Para probar el rol **VIEWER** (solo lectura): invita a un segundo correo
(puedes registrar una segunda cuenta tú mismo) con rol "Observador" desde
**Miembros → Invitar miembro**, inicia sesión con esa cuenta y abre el enlace
de invitación que aparece en la consola/correo.

## 6. Estructura relevante

```
app/(auth)/...              Login, registro, recuperación de contraseña
app/(app)/projects/...      Shell autenticado: selector de proyecto + sidebar
app/(app)/projects/[id]/    Dashboard, tablero, tareas, cronograma, miembros,
                             áreas, documentos, actividad, configuración
app/actions/                 Server Actions (mutaciones, validadas con zod)
lib/supabase/                Clientes de Supabase (browser/server) y sesión
lib/projects/access.ts       Verificación de rol por proyecto (server-side)
supabase/migrations/         SQL de esquema, RLS, triggers, Storage
```

## 7. Scripts

```bash
npm run dev     # Next dev (Turbopack)
npm run build   # Build de producción
npm run lint    # ESLint
```
