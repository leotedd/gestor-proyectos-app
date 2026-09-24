import * as z from "zod";

export const emailSchema = z.email({ error: "Ingresa un correo válido." });

export const passwordSchema = z
  .string()
  .min(8, { error: "Debe tener al menos 8 caracteres." });

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, { error: "Ingresa tu nombre completo." }),
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Ingresa tu contraseña." }),
});

export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export const projectRoles = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, { error: "El nombre es obligatorio." }),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, {
      error: "Usa de 2 a 10 letras/números en mayúsculas (ej. SEM, WEB01).",
    }),
  description: z.string().trim().max(2000).optional().default(""),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]).optional(),
});

export const taskPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const taskStatuses = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;

export const createTaskSchema = z.object({
  projectId: z.uuid(),
  title: z.string().trim().min(2, { error: "El título es obligatorio." }),
  description: z.string().trim().max(5000).optional().default(""),
  areaId: z.uuid().optional().nullable(),
  assigneeId: z.uuid().optional().nullable(),
  priority: z.enum(taskPriorities).default("MEDIUM"),
  status: z.enum(taskStatuses).default("TODO"),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  progress: z.coerce.number().min(0).max(100).default(0),
  labels: z.array(z.string()).optional().default([]),
});

export const updateTaskSchema = createTaskSchema
  .omit({ projectId: true })
  .partial()
  .extend({ taskId: z.uuid() });

/**
 * Campos que un MIEMBRO puede modificar en una tarea que tiene asignada:
 * estado, progreso y fecha límite. Nada más. `position` no se valida aquí
 * porque solo la mueve el Kanban (moveTaskAction), no este formulario.
 */
export const updateTaskAsMemberSchema = z.object({
  taskId: z.uuid(),
  status: z.enum(taskStatuses),
  progress: z.coerce.number().min(0).max(100).default(0),
  dueDate: z.string().optional().nullable(),
});

export const createAreaSchema = z.object({
  projectId: z.uuid(),
  name: z.string().trim().min(2, { error: "El nombre es obligatorio." }),
  description: z.string().trim().max(1000).optional().default(""),
});

// Roles que se pueden invitar desde la interfaz: PROPIETARIO no se invita
// (0007 ya lo bloquea también en base de datos) y ADMIN se mantiene
// técnicamente en el sistema pero no se ofrece ni se acepta al invitar.
export const invitableRoles = ["MEMBER", "VIEWER"] as const;

export const inviteMemberSchema = z.object({
  projectId: z.uuid(),
  email: emailSchema,
  role: z.enum(invitableRoles).default("MEMBER"),
});

export const acceptGuestInvitationSchema = z.object({
  token: z.uuid(),
  fullName: z.string().trim().min(2, { error: "Ingresa tu nombre completo." }),
  email: emailSchema,
  username: z
    .string()
    .trim()
    .min(2, { error: "Debe tener al menos 2 caracteres." })
    .max(40)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
});
