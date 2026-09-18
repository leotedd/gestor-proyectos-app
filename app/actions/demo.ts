"use server";

import { redirect } from "next/navigation";
import { requireUserClient } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Crea un proyecto de demostración completo (solo para presentaciones).
 * No se ejecuta automáticamente: el usuario debe pulsar el botón.
 * La parroquia es únicamente el contenido de este proyecto de ejemplo,
 * no una adaptación de la plataforma.
 *
 * Se invoca directamente como `<form action={seedDemoProjectAction}>`, por
 * lo que en caso de error lanza en vez de devolver un estado: cada ruta de
 * ejecución termina en `redirect()` (nunca retorna) o en una excepción, que
 * Next.js muestra a través del error boundary más cercano.
 */
export async function seedDemoProjectAction(): Promise<void> {
  // Un solo cliente para resolver el usuario y para todas las mutaciones:
  // el `owner_id`/`created_by` que insertamos y el `auth.uid()` que evalúan
  // las políticas RLS deben venir de la misma sesión verificada.
  const { supabase, user } = await requireUserClient();

  // Si el usuario ya tiene un proyecto demo (mismo prefijo), lo reutiliza en
  // vez de duplicarlo. RLS solo le mostrará el suyo, aunque otros usuarios
  // también hayan generado el suyo con el mismo prefijo base.
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .like("key", "SEM%")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existing) {
    redirect(`/projects/${existing.id}/dashboard`);
  }

  // `key` es único a nivel de toda la instancia (como en Jira). Si "SEM" ya
  // lo usó otro usuario, se prueba con sufijos hasta encontrar uno libre.
  let project: { id: string } | null = null;
  let lastError: string | undefined;

  for (let attempt = 0; attempt < 5 && !project; attempt++) {
    const key = attempt === 0 ? "SEM" : `SEM${attempt + 1}`;
    const { data, error: projectError } = await supabase
      .from("projects")
      .insert({
        name: "Sistema Integral de Gestión Sacramental y Pastoral",
        key,
        description:
          "Proyecto de demostración: plataforma para el seguimiento sacramental y pastoral de una parroquia.",
        status: "ACTIVE",
        start_date: addDays(-30),
        end_date: addDays(60),
        owner_id: user.id,
      })
      .select("id")
      .single();

    if (data) {
      project = data;
    } else if (projectError?.code === "23505") {
      lastError = projectError.message;
      continue; // prefijo ocupado, reintenta con el siguiente sufijo
    } else if (projectError?.code === "42501") {
      throw new Error(
        "No se pudo crear el proyecto demo por una política de seguridad (RLS). " +
          "Ejecuta la migración SQL más reciente (supabase/migrations/0002_fix_projects_rls.sql) " +
          "en el SQL Editor de Supabase y vuelve a intentar."
      );
    } else {
      throw new Error(projectError?.message ?? "No se pudo crear el proyecto demo.");
    }
  }

  if (!project) {
    throw new Error(lastError ?? "No se pudo crear el proyecto demo.");
  }

  const projectId = project.id;

  const areaNames = ["Gestión", "Desarrollo", "Documentación", "QA", "Diseño"] as const;
  const { data: areas, error: areasError } = await supabase
    .from("areas")
    .insert(
      areaNames.map((name) => ({
        project_id: projectId,
        name,
        description: `Área de ${name.toLowerCase()} del proyecto.`,
      }))
    )
    .select("id, name");

  if (areasError || !areas) {
    throw new Error(areasError?.message ?? "No se pudieron crear las áreas.");
  }

  const areaId = (name: (typeof areaNames)[number]) => areas.find((a) => a.name === name)!.id;

  await supabase
    .from("project_members")
    .update({ area_id: areaId("Gestión") })
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  type SeedTask = {
    title: string;
    description: string;
    area: (typeof areaNames)[number];
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
    progress: number;
    startOffset: number;
    dueOffset: number;
    labels?: string[];
  };

  const seedTasks: SeedTask[] = [
    { title: "Relevar requerimientos con la coordinación pastoral", description: "Reuniones con los responsables de cada sacramento para levantar necesidades.", area: "Gestión", priority: "HIGH", status: "DONE", progress: 100, startOffset: -28, dueOffset: -20, labels: ["descubrimiento"] },
    { title: "Definir alcance y cronograma general", description: "Documento de alcance con hitos por fase.", area: "Gestión", priority: "HIGH", status: "DONE", progress: 100, startOffset: -20, dueOffset: -14 },
    { title: "Diseñar modelo de datos sacramental", description: "Bautismos, confirmaciones, matrimonios, defunciones.", area: "Desarrollo", priority: "CRITICAL", status: "DONE", progress: 100, startOffset: -18, dueOffset: -10 },
    { title: "Configurar autenticación y roles", description: "Roles OWNER/ADMIN/MEMBER/VIEWER para el equipo pastoral.", area: "Desarrollo", priority: "HIGH", status: "DONE", progress: 100, startOffset: -14, dueOffset: -6 },
    { title: "Módulo de registro de bautismos", description: "Alta, edición y búsqueda de actas de bautismo.", area: "Desarrollo", priority: "HIGH", status: "IN_PROGRESS", progress: 65, startOffset: -10, dueOffset: 4, labels: ["backend", "frontend"] },
    { title: "Módulo de registro de matrimonios", description: "Formulario de actas matrimoniales con validaciones canónicas.", area: "Desarrollo", priority: "MEDIUM", status: "IN_PROGRESS", progress: 40, startOffset: -6, dueOffset: 8 },
    { title: "Generador de certificados en PDF", description: "Exportar certificados sacramentales con firma digital.", area: "Desarrollo", priority: "MEDIUM", status: "TODO", progress: 0, startOffset: 2, dueOffset: 12 },
    { title: "Panel de agenda pastoral", description: "Calendario de misas, catequesis y eventos parroquiales.", area: "Desarrollo", priority: "MEDIUM", status: "TODO", progress: 0, startOffset: 4, dueOffset: 16 },
    { title: "Manual de usuario para catequistas", description: "Guía paso a paso con capturas de pantalla.", area: "Documentación", priority: "LOW", status: "IN_PROGRESS", progress: 30, startOffset: -4, dueOffset: 10 },
    { title: "Política de privacidad de datos feligreses", description: "Documento conforme a protección de datos personales.", area: "Documentación", priority: "MEDIUM", status: "REVIEW", progress: 90, startOffset: -8, dueOffset: 2 },
    { title: "Diagrama de arquitectura del sistema", description: "Vista general de módulos y flujo de datos.", area: "Documentación", priority: "LOW", status: "DONE", progress: 100, startOffset: -16, dueOffset: -8 },
    { title: "Plan de pruebas funcionales", description: "Casos de prueba para los módulos sacramentales.", area: "QA", priority: "MEDIUM", status: "IN_PROGRESS", progress: 55, startOffset: -6, dueOffset: 6 },
    { title: "Pruebas de RLS multiproyecto", description: "Verificar aislamiento de datos entre proyectos y roles.", area: "QA", priority: "CRITICAL", status: "TODO", progress: 0, startOffset: 1, dueOffset: 9, labels: ["seguridad"] },
    { title: "Pruebas de carga del panel de reportes", description: "Validar tiempos de respuesta del dashboard con datos reales.", area: "QA", priority: "LOW", status: "TODO", progress: 0, startOffset: 10, dueOffset: 20 },
    { title: "Sistema de diseño y guía visual", description: "Paleta, tipografía y componentes reutilizables.", area: "Diseño", priority: "MEDIUM", status: "DONE", progress: 100, startOffset: -22, dueOffset: -12 },
    { title: "Wireframes del panel administrativo", description: "Flujos de alta de feligreses y reportes.", area: "Diseño", priority: "MEDIUM", status: "DONE", progress: 100, startOffset: -14, dueOffset: -4 },
    { title: "Diseño responsive del portal público", description: "Adaptación para consulta de horarios de misa desde el celular.", area: "Diseño", priority: "LOW", status: "REVIEW", progress: 80, startOffset: -5, dueOffset: 5 },
    { title: "Capacitación al equipo pastoral", description: "Sesión de entrenamiento sobre el uso del sistema.", area: "Gestión", priority: "MEDIUM", status: "TODO", progress: 0, startOffset: 15, dueOffset: 25 },
    { title: "Reporte mensual de avance a la diócesis", description: "Presentación ejecutiva del estado del proyecto.", area: "Gestión", priority: "HIGH", status: "TODO", progress: 0, startOffset: -2, dueOffset: -1, labels: ["vencida"] },
    { title: "Revisión de accesibilidad del portal", description: "Auditoría WCAG básica de las pantallas públicas.", area: "QA", priority: "LOW", status: "TODO", progress: 0, startOffset: 20, dueOffset: 30 },
  ];

  const { data: insertedTasks, error: tasksError } = await supabase
    .from("tasks")
    .insert(
      seedTasks.map((t) => ({
        project_id: projectId,
        title: t.title,
        description: t.description,
        area_id: areaId(t.area),
        priority: t.priority,
        status: t.status,
        start_date: addDays(t.startOffset),
        due_date: addDays(t.dueOffset),
        progress: t.progress,
        labels: t.labels ?? [],
        created_by: user.id,
      }))
    )
    .select("id");

  if (tasksError || !insertedTasks) {
    throw new Error(tasksError?.message ?? "No se pudieron crear las tareas.");
  }

  await supabase.from("task_assignments").insert(
    insertedTasks.map((t) => ({
      task_id: t.id,
      user_id: user.id,
      assigned_by: user.id,
    }))
  );

  await logActivity(supabase, {
    projectId,
    userId: user.id,
    action: "project.demo_seeded",
    entityType: "project",
    entityId: projectId,
    metadata: { tasks: insertedTasks.length, areas: areas.length },
  });

  redirect(`/projects/${projectId}/dashboard`);
}
