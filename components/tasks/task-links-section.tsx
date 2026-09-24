"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { listTaskLinksAction, createTaskLinkAction, updateTaskLinkAction, deleteTaskLinkAction } from "@/app/actions/task-links";
import { taskLinkUrlSchema, type TaskLink } from "@/lib/task-links/validations";

export function TaskLinksSection({ projectId, taskId }: { projectId: string; taskId: string }) {
  const fieldId = useId();
  const [loaded, setLoaded] = useState(false);
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [permissions, setPermissions] = useState({ canEdit: false, canDelete: false });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState<TaskLink | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    listTaskLinksAction({ projectId, taskId }).then((result) => {
      if (!active) return;
      if (result.error !== undefined) setError(result.error);
      else {
        setLinks(result.data.links);
        setPermissions(result.data);
        setLoaded(true);
      }
    }).catch(() => {
      if (active) setError("No se pudieron cargar los enlaces. Verifica tu conexión.");
    });
    return () => { active = false; };
  }, [projectId, taskId, retry]);

  function resetEditor() {
    setEditing(null);
    setTitle("");
    setUrl("");
  }

  function save() {
    setError("");
    setNotice("");
    startTransition(async () => {
      try {
        const input = { projectId, taskId, title, url, linkId: editing?.id };
        const result = editing ? await updateTaskLinkAction(input) : await createTaskLinkAction(input);
        if (result.error !== undefined) { setError(result.error); return; }
        setLinks((current) => editing ? current.map((link) => link.id === result.data.id ? result.data : link) : [...current, result.data]);
        resetEditor();
        setNotice("Enlace guardado.");
      } catch { setError("No se pudo guardar el enlace. Verifica tu conexión y vuelve a cargar los enlaces antes de reintentar."); }
    });
  }

  function remove(linkId: string) {
    setError("");
    setNotice("");
    startTransition(async () => {
      try {
        const result = await deleteTaskLinkAction({ projectId, taskId, linkId });
        if (result.error !== undefined) { setError(result.error); return; }
        setLinks((current) => current.filter((link) => link.id !== linkId));
        if (editing?.id === linkId) resetEditor();
        setDeleting(null);
        setNotice("Enlace eliminado.");
      } catch { setError("No se pudo eliminar el enlace. Verifica tu conexión."); }
    });
  }

  return (
    <section className="mt-5 space-y-3 border-t border-border pt-4" aria-label="Enlaces de la tarea" aria-busy={pending || (!loaded && !error)}>
      <h3 className="text-sm font-semibold">Enlaces de la tarea</h3>
      <p className="text-xs text-muted-foreground">Los cambios en enlaces se guardan por separado de los datos de la tarea.</p>
      {error && <Alert tone="danger">{error}</Alert>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {!loaded && !error && <p role="status" className="text-sm text-muted-foreground">Cargando enlaces…</p>}
      {(loaded || error) && <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => { setError(""); setLoaded(false); setRetry((value) => value + 1); }}>Volver a cargar enlaces</Button>}
      {loaded && <>
        {links.length === 0 && <p className="text-sm text-muted-foreground">Esta tarea todavía no tiene enlaces.</p>}
        <ul className="space-y-2">
          {links.map((link) => (
            <li key={link.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {taskLinkUrlSchema.safeParse(link.url).success ? <a href={link.url} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-primary underline inline-flex items-center gap-1">{link.title}<ExternalLink className="h-3.5 w-3.5 shrink-0" /><span className="sr-only"> (abre en una pestaña nueva)</span></a> : <span>{link.title} (URL inválida)</span>}
                  <p className="break-all text-xs text-muted-foreground">{link.url}</p>
                </div>
                <div className="flex shrink-0">
                  {permissions.canEdit && <Button type="button" variant="ghost" size="icon" disabled={pending} aria-label={`Editar ${link.title}`} onClick={() => { setEditing(link); setTitle(link.title); setUrl(link.url); setDeleting(null); setNotice(""); }}><Pencil className="h-4 w-4" /></Button>}
                  {permissions.canDelete && <Button type="button" variant="ghost" size="icon" disabled={pending} aria-label={`Eliminar ${link.title}`} onClick={() => setDeleting(link.id)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </div>
              {deleting === link.id && <div className="space-y-2"><p className="text-sm">¿Eliminar este enlace?</p><Button type="button" variant="danger" size="sm" loading={pending} onClick={() => remove(link.id)}>Eliminar enlace</Button>{" "}<Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setDeleting(null)}>Cancelar</Button></div>}
            </li>
          ))}
        </ul>
        {permissions.canEdit && <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); if (!pending) save(); }}>
          <fieldset disabled={pending} className="space-y-2">
            <legend className="text-sm font-medium">{editing ? "Editar enlace" : "Agregar enlace"}</legend>
            <Label htmlFor={`${fieldId}-title`}>Nombre del enlace</Label>
            <Input id={`${fieldId}-title`} value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} placeholder="Diseño en Figma" />
            <Label htmlFor={`${fieldId}-url`}>URL</Label>
            <Input id={`${fieldId}-url`} type="url" value={url} onChange={(event) => setUrl(event.target.value)} required maxLength={2048} placeholder="https://…" />
            <div className="flex gap-2"><Button type="submit" size="sm" loading={pending}>{editing ? "Guardar enlace" : "Agregar enlace"}</Button>{editing && <Button type="button" variant="outline" size="sm" onClick={resetEditor}>Cancelar edición</Button>}</div>
          </fieldset>
        </form>}
      </>}
    </section>
  );
}

/** Acceso de lectura para VIEWER: la tabla existente no les permite abrir el modal. */
export function TaskLinksViewer({ projectId, tasks }: { projectId: string; tasks: { id: string; code: string; title: string }[] }) {
  const [taskId, setTaskId] = useState("");
  const id = useId();
  return <div className="rounded-xl border border-border p-4 space-y-2">
    <Label htmlFor={id}>Consultar enlaces de una tarea</Label>
    <Select id={id} value={taskId} onChange={(event) => setTaskId(event.target.value)}><option value="">Selecciona una tarea</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.code} — {task.title}</option>)}</Select>
    {taskId && <TaskLinksSection key={taskId} projectId={projectId} taskId={taskId} />}
  </div>;
}
