// Verificación de aislamiento multiproyecto / RLS contra el Supabase REAL.
//
// Uso:  node --env-file=.env.local scripts/rls-isolation-check.mjs
//
// - Solo usa NEXT_PUBLIC_SUPABASE_URL y la clave pública (nunca service_role).
// - Crea 4 sesiones ANÓNIMAS (A, B, C, D) y 2 proyectos de prueba (clave ZT*).
// - Al final borra los proyectos de prueba (cascada: áreas, tareas, enlaces,
//   miembros, invitaciones, actividad). Los usuarios anónimos NO se pueden
//   borrar sin service_role: quedan 4 filas en auth.users/profiles con
//   is_guest = true.
// - No toca ningún dato existente.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  process.exit(2);
}

const results = [];
const rand = () => Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z0-9]/g, "X");
const mk = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// expect: "ok" = debe funcionar; "deny" = debe ser rechazado (error o 0 filas);
// "info" = solo se registra el comportamiento observado.
function record(name, expect, outcome, detail = "") {
  const allowed = outcome === "allowed";
  const pass = expect === "info" ? null : expect === "ok" ? allowed : !allowed;
  results.push({ name, expect, outcome, pass, detail });
  const tag = pass === null ? "INFO" : pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${name} -> ${outcome}${detail ? ` (${detail})` : ""}`);
}

// Convierte una respuesta de PostgREST en "allowed" / "denied".
function outcomeOf({ data, error }) {
  if (error) return { outcome: "denied", detail: error.message.slice(0, 90) };
  if (Array.isArray(data)) return data.length > 0 ? { outcome: "allowed", detail: `${data.length} fila(s)` } : { outcome: "denied", detail: "0 filas" };
  return data ? { outcome: "allowed", detail: "" } : { outcome: "denied", detail: "sin datos" };
}
const check = async (name, expect, promise) => {
  const { outcome, detail } = outcomeOf(await promise);
  record(name, expect, outcome, detail);
};

async function guest(label) {
  const c = mk();
  const { data, error } = await c.auth.signInAnonymously();
  if (error || !data.user) {
    console.error(`No se pudo crear la sesión anónima ${label}: ${error?.message}`);
    process.exit(2);
  }
  return { c, id: data.user.id, label };
}

const A = await guest("A");
const B = await guest("B");
const C = await guest("C");
const D = await guest("D");
const E = await guest("E");
const createdProjects = [];

try {
  // --- Perfil del invitado (trigger 0004) --------------------------------
  const { data: profA } = await A.c.from("profiles").select("*").eq("id", A.id).maybeSingle();
  record("Sesión anónima tiene profile con is_guest=true", "ok", profA?.is_guest === true ? "allowed" : "denied", profA?.email ?? "sin profile");

  // --- Creación de proyectos --------------------------------------------
  const mkProject = async (u, name) => {
    const { data, error } = await u.c.from("projects").insert({ name, key: `Z${rand()}`, owner_id: u.id }).select("id").single();
    if (data) createdProjects.push({ u, id: data.id });
    return { data, error };
  };
  const pa = await mkProject(A, "ZZ prueba A");
  const pb = await mkProject(B, "ZZ prueba B");
  record("INFO: una sesión ANÓNIMA puede crear proyectos propios", "info", pa.data ? "allowed" : "denied", pa.error?.message ?? "");
  if (!pa.data || !pb.data) throw new Error("No se pudieron crear los proyectos de prueba; no se puede continuar.");
  const PA = pa.data.id;
  const PB = pb.data.id;

  // --- Aislamiento de lectura -------------------------------------------
  await check("B no puede leer el proyecto A por UUID", "deny", B.c.from("projects").select("id").eq("id", PA));
  const { data: bList } = await B.c.from("projects").select("id");
  record("B solo lista sus proyectos (no ve PA)", "ok", bList?.every((p) => p.id !== PA) ? "allowed" : "denied", `${bList?.length ?? 0} visibles`);
  await check("B no ve miembros de A", "deny", B.c.from("project_members").select("id").eq("project_id", PA));
  await check("B no ve invitaciones de A", "deny", B.c.from("invitations").select("id").eq("project_id", PA));
  await check("B no ve actividad de A", "deny", B.c.from("activity_logs").select("id").eq("project_id", PA));

  // --- Datos de A -------------------------------------------------------
  const { data: area } = await A.c.from("areas").insert({ project_id: PA, name: "Área A" }).select("id").single();
  const { data: task, error: taskErr } = await A.c.from("tasks").insert({ project_id: PA, title: "Tarea de A", area_id: area?.id, created_by: A.id }).select("id").single();
  record("A (OWNER) crea área y tarea en su proyecto", "ok", task ? "allowed" : "denied", taskErr?.message ?? "");
  if (!task) throw new Error("No se pudo crear la tarea de prueba.");
  await check("A (OWNER) crea un enlace en su tarea", "ok", A.c.from("task_links").insert({ task_id: task.id, title: "Doc", url: "https://example.com/doc", created_by: A.id }).select("id"));
  await A.c.from("task_assignments").insert({ task_id: task.id, user_id: A.id, assigned_by: A.id });

  // --- Ataques de B contra PA -------------------------------------------
  await check("B no lee tareas de A", "deny", B.c.from("tasks").select("id").eq("project_id", PA));
  await check("B no lee áreas de A", "deny", B.c.from("areas").select("id").eq("project_id", PA));
  await check("B no lee task_assignments de A", "deny", B.c.from("task_assignments").select("id").eq("task_id", task.id));
  await check("B no lee enlaces de A", "deny", B.c.from("task_links").select("id").eq("task_id", task.id));
  await check("B no puede insertar tareas en PA", "deny", B.c.from("tasks").insert({ project_id: PA, title: "intruso" }).select("id"));
  await check("B no puede actualizar tareas de A", "deny", B.c.from("tasks").update({ title: "hack" }).eq("id", task.id).select("id"));
  await check("B no puede borrar tareas de A", "deny", B.c.from("tasks").delete().eq("id", task.id).select("id"));
  await check("B no puede insertar enlaces en tarea de A", "deny", B.c.from("task_links").insert({ task_id: task.id, title: "x", url: "https://evil.example", created_by: B.id }).select("id"));
  await check("B no puede añadirse a PA como OWNER", "deny", B.c.from("project_members").insert({ project_id: PA, user_id: B.id, role: "OWNER" }).select("id"));
  await check("B no puede crear invitaciones en PA", "deny", B.c.from("invitations").insert({ project_id: PA, email: "x@example.com", role: "ADMIN" }).select("id"));
  await check("B no puede insertar actividad en PA", "deny", B.c.from("activity_logs").insert({ project_id: PA, user_id: B.id, action: "x", entity_type: "x" }).select("id"));
  await check("B no puede actualizar el proyecto A", "deny", B.c.from("projects").update({ name: "hack" }).eq("id", PA).select("id"));
  await check("B no puede borrar el proyecto A", "deny", B.c.from("projects").delete().eq("id", PA).select("id"));

  // --- Filtración de perfiles (política profiles_select_authenticated) ---
  const { data: seen } = await B.c.from("profiles").select("id,email,full_name");
  const seesA = seen?.some((p) => p.id === A.id);
  record("B NO debería poder leer el profile de A (no comparten proyecto)", "deny", seesA ? "allowed" : "denied", `B ve ${seen?.length ?? 0} profiles en total`);

  // --- Referencias cruzadas (asignar a no-miembro / área de otro proyecto)
  const { data: areaB } = await B.c.from("areas").insert({ project_id: PB, name: "Área B" }).select("id").single();
  await check("A NO debería poder asignar su tarea a B (no es miembro de PA)", "deny", A.c.from("task_assignments").insert({ task_id: task.id, user_id: B.id, assigned_by: A.id }).select("id"));
  await check("A NO debería poder usar el área de PB en una tarea de PA", "deny", A.c.from("tasks").update({ area_id: areaB?.id }).eq("id", task.id).select("id"));

  // --- Flujo de invitación (invitado C, rol MEMBER) ---------------------
  const mkInv = async (email, role, extra = {}) => {
    const { data } = await A.c.from("invitations").insert({ project_id: PA, email, role, invited_by: A.id, ...extra }).select("id,token").single();
    return data;
  };
  const invC = await mkInv(`zt-c-${rand()}@example.com`, "MEMBER");
  const preview = await C.c.rpc("get_invitation_preview", { p_token: invC.token });
  record("Vista previa por token muestra proyecto/rol", "ok", preview.data?.[0]?.role === "MEMBER" ? "allowed" : "denied", preview.error?.message ?? "");
  const anon = mk(); // sin sesión
  await check("Sin sesión: get_invitation_preview funciona (página pública)", "ok", anon.rpc("get_invitation_preview", { p_token: invC.token }));
  await check("Sin sesión: NO puede leer la tabla invitations", "deny", anon.from("invitations").select("id"));
  await check("Sin sesión: NO puede ejecutar accept_invitation_by_token", "deny", anon.rpc("accept_invitation_by_token", { p_token: invC.token, p_full_name: "x" }));
  await check("Sin sesión: NO puede leer proyectos ni profiles", "deny", anon.from("profiles").select("id"));

  await check("C acepta la invitación con token válido", "ok", C.c.rpc("accept_invitation_by_token", { p_token: invC.token, p_full_name: "Invitado C", p_username: "invc" }));
  const { data: profC } = await C.c.from("profiles").select("*").eq("id", C.id).maybeSingle();
  record("Profile de C: nombre/usuario actualizados, is_guest=true, correo de la invitación", "ok", profC?.full_name === "Invitado C" && profC?.username === "invc" && profC?.is_guest === true && profC?.email?.startsWith("zt-c-") ? "allowed" : "denied", JSON.stringify({ n: profC?.full_name, u: profC?.username, g: profC?.is_guest }));
  await check("C ve PA tras aceptar", "ok", C.c.from("projects").select("id").eq("id", PA));
  await check("C NO ve PB", "deny", C.c.from("projects").select("id").eq("id", PB));
  await check("C ve las tareas de PA", "ok", C.c.from("tasks").select("id").eq("project_id", PA));
  await check("C NO ve tareas de PB", "deny", C.c.from("tasks").select("id").eq("project_id", PB));
  await check("C (MEMBER) crea tarea en PA", "ok", C.c.from("tasks").insert({ project_id: PA, title: "Tarea de C", created_by: C.id }).select("id"));
  await check("C (MEMBER) actualiza tarea de PA", "ok", C.c.from("tasks").update({ progress: 50 }).eq("id", task.id).select("id"));
  await check("C (MEMBER) NO borra tareas", "deny", C.c.from("tasks").delete().eq("id", task.id).select("id"));
  await check("C (MEMBER) NO crea áreas", "deny", C.c.from("areas").insert({ project_id: PA, name: "x" }).select("id"));
  await check("C (MEMBER) NO crea invitaciones", "deny", C.c.from("invitations").insert({ project_id: PA, email: "y@example.com", role: "ADMIN" }).select("id"));
  await check("C NO puede cambiar su propio rol a OWNER", "deny", C.c.from("project_members").update({ role: "OWNER" }).eq("project_id", PA).eq("user_id", C.id).select("id"));
  await check("C NO puede unirse a PB", "deny", C.c.from("project_members").insert({ project_id: PB, user_id: C.id, role: "MEMBER" }).select("id"));
  await check("C (MEMBER) NO puede asignar una tarea a B (no miembro de PA)", "deny", C.c.from("task_assignments").insert({ task_id: task.id, user_id: B.id, assigned_by: C.id }).select("id"));
  await check("C (MEMBER) NO puede usar el área de PB en una tarea de PA", "deny", C.c.from("tasks").update({ area_id: areaB?.id }).eq("id", task.id).select("id"));
  await check("C (MEMBER) NO puede crear una tarea de PA con el área de PB", "deny", C.c.from("tasks").insert({ project_id: PA, title: "x", area_id: areaB?.id }).select("id"));
  const lc = await C.c.from("task_links").insert({ task_id: task.id, title: "Enlace de C", url: "https://example.com/c", created_by: C.id }).select("id").single();
  record("C (MEMBER) crea enlace", "ok", lc.data ? "allowed" : "denied", lc.error?.message ?? "");
  if (lc.data) {
    await check("C (MEMBER) edita su enlace", "ok", C.c.from("task_links").update({ title: "Editado" }).eq("id", lc.data.id).select("id"));
    await check("C (MEMBER) NO puede mover el enlace a otra tarea (task_id)", "deny", C.c.from("task_links").update({ task_id: "00000000-0000-0000-0000-000000000000" }).eq("id", lc.data.id).select("id"));
    await check("C (MEMBER) NO puede guardar URL javascript:", "deny", C.c.from("task_links").update({ url: "javascript:alert(1)" }).eq("id", lc.data.id).select("id"));
    await check("C (MEMBER) NO puede guardar URL ftp:", "deny", C.c.from("task_links").update({ url: "ftp://example.com/x" }).eq("id", lc.data.id).select("id"));
    await check("C (MEMBER) NO borra enlaces", "deny", C.c.from("task_links").delete().eq("id", lc.data.id).select("id"));
    await check("A (OWNER) borra el enlace de C", "ok", A.c.from("task_links").delete().eq("id", lc.data.id).select("id"));
  }
  await check("C NO puede suplantar created_by en un enlace", "deny", C.c.from("task_links").insert({ task_id: task.id, title: "x", url: "https://example.com", created_by: A.id }).select("id"));

  // --- Lo que la política de profiles NO debe romper --------------------
  await check("C ve el profile de A (comparten PA)", "ok", C.c.from("profiles").select("id").eq("id", A.id));
  const { data: emb } = await C.c.from("project_members").select("id, role, profile:profiles!project_members_user_id_fkey(id, full_name, email)").eq("project_id", PA);
  record("Lista de miembros de PA trae el profile de cada miembro (embed)", "ok", emb?.length >= 2 && emb.every((m) => m.profile) ? "allowed" : "denied", `${emb?.length ?? 0} miembros`);
  await check("A asigna una tarea a C (miembro de PA)", "ok", A.c.from("task_assignments").insert({ task_id: task.id, user_id: C.id, assigned_by: A.id }).select("id"));
  await check("A usa un área de su propio proyecto en una tarea", "ok", A.c.from("tasks").update({ area_id: area.id }).eq("id", task.id).select("id"));

  // --- Reutilización / estados inválidos --------------------------------
  await check("Segundo intento con el mismo token (C)", "deny", C.c.rpc("accept_invitation_by_token", { p_token: invC.token, p_full_name: "x" }));
  await check("Otro usuario (B) reutiliza el token ya aceptado", "deny", B.c.rpc("accept_invitation_by_token", { p_token: invC.token, p_full_name: "x" }));
  await check("Token inexistente", "deny", B.c.rpc("accept_invitation_by_token", { p_token: "11111111-1111-4111-8111-111111111111", p_full_name: "x" }));
  const invExp = await mkInv(`zt-exp-${rand()}@example.com`, "MEMBER", { expires_at: new Date(Date.now() - 86400000).toISOString() });
  await check("Token expirado", "deny", D.c.rpc("accept_invitation_by_token", { p_token: invExp.token, p_full_name: "x" }));
  const invCan = await mkInv(`zt-can-${rand()}@example.com`, "MEMBER");
  await A.c.from("invitations").update({ status: "CANCELLED" }).eq("id", invCan.id);
  await check("Token cancelado", "deny", D.c.rpc("accept_invitation_by_token", { p_token: invCan.token, p_full_name: "x" }));

  // --- Invitado VIEWER (D) ---------------------------------------------
  const invD = await mkInv(`zt-d-${rand()}@example.com`, "VIEWER");
  await check("D acepta invitación VIEWER", "ok", D.c.rpc("accept_invitation_by_token", { p_token: invD.token, p_full_name: "Invitado D" }));
  await check("D (VIEWER) lee tareas", "ok", D.c.from("tasks").select("id").eq("project_id", PA));
  await check("D (VIEWER) lee enlaces", "ok", D.c.from("task_links").select("id").eq("task_id", task.id));
  await check("D (VIEWER) NO crea tareas", "deny", D.c.from("tasks").insert({ project_id: PA, title: "x" }).select("id"));
  await check("D (VIEWER) NO actualiza tareas", "deny", D.c.from("tasks").update({ title: "x" }).eq("id", task.id).select("id"));
  await check("D (VIEWER) NO crea enlaces", "deny", D.c.from("task_links").insert({ task_id: task.id, title: "x", url: "https://example.com", created_by: D.id }).select("id"));

  // --- ADMIN (E) --------------------------------------------------------
  const invE = await mkInv(`zt-e-${rand()}@example.com`, "ADMIN");
  await check("E acepta invitación ADMIN", "ok", E.c.rpc("accept_invitation_by_token", { p_token: invE.token, p_full_name: "Invitado E" }));
  await check("E (ADMIN) ve las tareas y el proyecto", "ok", E.c.from("tasks").select("id").eq("project_id", PA));
  await check("E (ADMIN) NO ve PB", "deny", E.c.from("projects").select("id").eq("id", PB));
  await check("E (ADMIN) crea áreas", "ok", E.c.from("areas").insert({ project_id: PA, name: "Área de E" }).select("id"));
  await check("E (ADMIN) crea invitaciones", "ok", E.c.from("invitations").insert({ project_id: PA, email: `zt-e2-${rand()}@example.com`, role: "MEMBER", invited_by: E.id }).select("id"));
  await check("E (ADMIN) crea y actualiza tareas", "ok", E.c.from("tasks").update({ progress: 60 }).eq("id", task.id).select("id"));
  const te = await E.c.from("tasks").insert({ project_id: PA, title: "Tarea a borrar", created_by: E.id }).select("id").single();
  await check("E (ADMIN) borra tareas", "ok", E.c.from("tasks").delete().eq("id", te.data?.id ?? "00000000-0000-0000-0000-000000000000").select("id"));
  const le = await A.c.from("task_links").insert({ task_id: task.id, title: "Para E", url: "https://example.com/e", created_by: A.id }).select("id").single();
  await check("E (ADMIN) borra enlaces", "ok", E.c.from("task_links").delete().eq("id", le.data?.id ?? "00000000-0000-0000-0000-000000000000").select("id"));
  await check("E (ADMIN) asigna una tarea a un miembro (C)", "ok", E.c.from("task_assignments").upsert({ task_id: task.id, user_id: C.id, assigned_by: E.id }, { onConflict: "task_id,user_id" }).select("id"));
  await check("E (ADMIN) NO puede borrar el proyecto (solo OWNER)", "deny", E.c.from("projects").delete().eq("id", PA).select("id"));
  await check("E (ADMIN) NO puede leer proyectos ni tareas de PB", "deny", E.c.from("tasks").select("id").eq("project_id", PB));

  // --- Perfiles: solo propio + co-miembros ------------------------------
  const { data: bSees } = await B.c.from("profiles").select("id");
  record("B (sin co-miembros) solo ve su propio profile", "ok", bSees?.length === 1 && bSees[0].id === B.id ? "allowed" : "denied", `${bSees?.length ?? 0} profiles visibles`);
  const { data: eSees } = await E.c.from("profiles").select("id");
  const eIds = new Set(eSees?.map((p) => p.id));
  record("E (ADMIN de PA) ve a los miembros de PA y a nadie más", "ok", [A.id, C.id, D.id, E.id].every((i) => eIds.has(i)) && !eIds.has(B.id) ? "allowed" : "denied", `${eSees?.length ?? 0} profiles visibles`);

  // --- Segunda invitación para un invitado que ya es miembro ------------
  const { data: bProj } = await B.c.from("projects").select("id").eq("id", PB);
  const invB2 = await B.c.from("invitations").insert({ project_id: PB, email: `zt-c2-${rand()}@example.com`, role: "MEMBER", invited_by: B.id }).select("token").single();
  await check("C (ya miembro de PA) acepta una segunda invitación a PB", "ok", C.c.rpc("accept_invitation_by_token", { p_token: invB2.data.token, p_full_name: "Invitado C" }));
  await check("C conserva PA y suma PB", "ok", C.c.from("projects").select("id").in("id", [PA, PB]));
  const { data: cProjects } = await C.c.from("projects").select("id").in("id", [PA, PB]);
  record("C ve exactamente 2 proyectos (PA y PB)", "ok", cProjects?.length === 2 ? "allowed" : "denied", `${cProjects?.length}`);
  void bProj;

  // --- Protección del OWNER (migración 0007) ----------------------------
  // Ataques de ADMIN/MEMBER/VIEWER contra la propiedad. Se ejecutan al final:
  // si 0007 no estuviera aplicada, varios tendrían éxito y el bloque `finally`
  // intenta limpiar el proyecto con cualquier miembro que haya quedado OWNER.
  const roleOf = async (uid) => (await A.c.from("project_members").select("role").eq("project_id", PA).eq("user_id", uid).maybeSingle()).data?.role ?? "(sin fila)";
  await check("E (ADMIN) NO puede insertar a B como OWNER", "deny", E.c.from("project_members").insert({ project_id: PA, user_id: B.id, role: "OWNER" }).select("id"));
  await check("E (ADMIN) NO puede autopromoverse a OWNER", "deny", E.c.from("project_members").update({ role: "OWNER" }).eq("project_id", PA).eq("user_id", E.id).select("id"));
  await check("E (ADMIN) NO puede promover a C (MEMBER) a OWNER", "deny", E.c.from("project_members").update({ role: "OWNER" }).eq("project_id", PA).eq("user_id", C.id).select("id"));
  await check("E (ADMIN) NO puede modificar la membresía del OWNER (área)", "deny", E.c.from("project_members").update({ area_id: area.id }).eq("project_id", PA).eq("user_id", A.id).select("id"));
  await check("E (ADMIN) NO puede degradar al OWNER", "deny", E.c.from("project_members").update({ role: "MEMBER" }).eq("project_id", PA).eq("user_id", A.id).select("id"));
  await check("E (ADMIN) NO puede crear una invitación con rol OWNER", "deny", E.c.from("invitations").insert({ project_id: PA, email: `zt-o-${rand()}@example.com`, role: "OWNER", invited_by: E.id }).select("id"));
  await check("A (OWNER) NO puede crear una invitación con rol OWNER", "deny", A.c.from("invitations").insert({ project_id: PA, email: `zt-o2-${rand()}@example.com`, role: "OWNER", invited_by: A.id }).select("id"));
  await check("E (ADMIN) NO puede cambiar projects.owner_id", "deny", E.c.from("projects").update({ owner_id: E.id }).eq("id", PA).select("id"));
  await check("C (MEMBER) NO puede autopromoverse a OWNER ni a ADMIN", "deny", C.c.from("project_members").update({ role: "ADMIN" }).eq("project_id", PA).eq("user_id", C.id).select("id"));
  await check("D (VIEWER) NO puede autopromoverse", "deny", D.c.from("project_members").update({ role: "OWNER" }).eq("project_id", PA).eq("user_id", D.id).select("id"));
  await check("C (MEMBER) NO puede insertar OWNER", "deny", C.c.from("project_members").insert({ project_id: PA, user_id: B.id, role: "OWNER" }).select("id"));
  await check("E (ADMIN) NO puede eliminar al OWNER", "deny", E.c.from("project_members").delete().eq("project_id", PA).eq("user_id", A.id).select("id"));
  record("A sigue siendo OWNER tras los ataques", "ok", (await roleOf(A.id)) === "OWNER" ? "allowed" : "denied", await roleOf(A.id));
  record("E sigue siendo ADMIN y C MEMBER tras los ataques", "ok", (await roleOf(E.id)) === "ADMIN" && (await roleOf(C.id)) === "MEMBER" ? "allowed" : "denied", `${await roleOf(E.id)}/${await roleOf(C.id)}`);

  // Lo que OWNER y ADMIN SÍ deben seguir pudiendo hacer
  await check("A (OWNER) puede actualizar su propia membresía (área)", "ok", A.c.from("project_members").update({ area_id: area.id }).eq("project_id", PA).eq("user_id", A.id).select("id"));
  await check("A (OWNER) NO puede degradarse a sí mismo (no hay transferencia)", "deny", A.c.from("project_members").update({ role: "MEMBER" }).eq("project_id", PA).eq("user_id", A.id).select("id"));
  await check("A (OWNER) cambia el rol de un miembro no-OWNER (C → ADMIN)", "ok", A.c.from("project_members").update({ role: "ADMIN" }).eq("project_id", PA).eq("user_id", C.id).select("id"));
  await check("A (OWNER) devuelve a C a MEMBER", "ok", A.c.from("project_members").update({ role: "MEMBER" }).eq("project_id", PA).eq("user_id", C.id).select("id"));
  await check("E (ADMIN) cambia el rol de un miembro no-OWNER (D → MEMBER)", "ok", E.c.from("project_members").update({ role: "MEMBER" }).eq("project_id", PA).eq("user_id", D.id).select("id"));
  await check("E (ADMIN) elimina a un miembro no-OWNER (D)", "ok", E.c.from("project_members").delete().eq("project_id", PA).eq("user_id", D.id).select("id"));
  await check("A (OWNER) vuelve a añadir a D como VIEWER", "ok", A.c.from("project_members").insert({ project_id: PA, user_id: D.id, role: "VIEWER", invited_by: A.id }).select("id"));
  await check("A (OWNER) elimina a otro miembro no-OWNER (C)", "ok", A.c.from("project_members").delete().eq("project_id", PA).eq("user_id", C.id).select("id"));

  // Creación de proyecto + borrado en cascada con OWNER, ADMIN y miembros
  const pd = await mkProject(A, "ZZ prueba cascada");
  record("Crear un proyecto sigue funcionando", "ok", pd.data ? "allowed" : "denied", pd.error?.message ?? "");
  if (pd.data) {
    const PD = pd.data.id;
    const { data: own } = await A.c.from("project_members").select("role").eq("project_id", PD).eq("user_id", A.id).maybeSingle();
    record("El creador queda como OWNER del proyecto nuevo", "ok", own?.role === "OWNER" ? "allowed" : "denied", own?.role ?? "(sin fila)");
    await A.c.from("project_members").insert([{ project_id: PD, user_id: E.id, role: "ADMIN" }, { project_id: PD, user_id: D.id, role: "MEMBER" }]);
    const { data: ar } = await A.c.from("areas").insert({ project_id: PD, name: "Área cascada" }).select("id").single();
    await A.c.from("project_members").update({ area_id: ar.id }).eq("project_id", PD).eq("user_id", A.id);
    const { data: tk } = await A.c.from("tasks").insert({ project_id: PD, title: "Tarea cascada", area_id: ar.id }).select("id").single();
    await A.c.from("task_links").insert({ task_id: tk.id, title: "l", url: "https://example.com/l", created_by: A.id });
    await check("Borrar un área asignada a miembros (SET NULL) sigue funcionando", "ok", A.c.from("areas").delete().eq("id", ar.id).select("id"));
    await check("E (ADMIN) NO puede borrar el proyecto nuevo", "deny", E.c.from("projects").delete().eq("id", PD).select("id"));
    await check("A (OWNER) borra el proyecto con miembros, tareas y enlaces (cascada)", "ok", A.c.from("projects").delete().eq("id", PD).select("id"));
    const gone = await Promise.all([A, D, E].map(async (u) => (await u.c.from("projects").select("id").eq("id", PD)).data?.length ?? 0));
    record("El proyecto y sus membresías desaparecen para todos", "ok", gone.every((n) => n === 0) ? "allowed" : "denied", gone.join("/"));
    const { data: orphanTasks } = await A.c.from("tasks").select("id").eq("project_id", PD);
    record("No quedan tareas huérfanas del proyecto borrado", "ok", (orphanTasks?.length ?? 0) === 0 ? "allowed" : "denied");
    createdProjects.splice(createdProjects.findIndex((p) => p.id === PD), 1);
  }
} catch (e) {
  console.error("\nERROR durante la ejecución:", e.message);
  results.push({ name: "ejecución", expect: "ok", outcome: "denied", pass: false, detail: e.message });
} finally {
  for (const p of createdProjects) {
    let deleted = false;
    // Primero el creador; si un ataque (0007 ausente) le quitó el rol, prueba con cualquier otro miembro.
    for (const u of [p.u, A, B, C, D, E]) {
      const { data } = await u.c.from("projects").delete().eq("id", p.id).select("id");
      if (data?.length) { deleted = true; break; }
    }
    console.log(`Limpieza: proyecto ${p.id} ${deleted ? "borrado" : "NO borrado — revisar manualmente"}`);
  }
}

const fails = results.filter((r) => r.pass === false);
console.log(`\nResumen: ${results.filter((r) => r.pass === true).length} PASS, ${fails.length} FAIL, ${results.filter((r) => r.pass === null).length} INFO`);
if (fails.length) {
  console.log("\nFALLOS (comportamiento distinto al esperado):");
  for (const f of fails) console.log(` - ${f.name} -> ${f.outcome} ${f.detail}`);
}
process.exit(fails.length ? 1 : 0);
