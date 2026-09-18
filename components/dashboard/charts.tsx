"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { TaskWithRelations } from "@/lib/tasks/types";
import type { AreaRow } from "@/lib/types/database";

const STATUS_COLORS: Record<string, string> = {
  "Por hacer": "#64748b",
  "En progreso": "#2563eb",
  "En revisión": "#d97706",
  Completado: "#059669",
};

const PRIORITY_COLORS: Record<string, string> = {
  Baja: "#94a3b8",
  Media: "#3b82f6",
  Alta: "#f59e0b",
  Crítica: "#dc2626",
};

const statusLabel: Record<string, string> = {
  TODO: "Por hacer",
  IN_PROGRESS: "En progreso",
  REVIEW: "En revisión",
  DONE: "Completado",
};
const priorityLabel: Record<string, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

function tooltipStyle() {
  return {
    contentStyle: {
      borderRadius: 8,
      border: "1px solid #e2e8f0",
      fontSize: 13,
    },
  };
}

export function TasksByStatusChart({ tasks }: { tasks: TaskWithRelations[] }) {
  const counts = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"].map((s) => ({
    name: statusLabel[s],
    value: tasks.filter((t) => t.status === s).length,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tareas por estado</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={counts}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
            >
              {counts.map((entry) => (
                <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle()} />
            <Legend verticalAlign="bottom" height={32} iconType="circle" iconSize={8} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function TasksByPriorityChart({ tasks }: { tasks: TaskWithRelations[] }) {
  const data = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => ({
    name: priorityLabel[p],
    value: tasks.filter((t) => t.priority === p).length,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tareas por prioridad</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip {...tooltipStyle()} cursor={{ fill: "#f1f5f9" }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ProgressByAreaChart({
  tasks,
  areas,
}: {
  tasks: TaskWithRelations[];
  areas: AreaRow[];
}) {
  const data = areas.map((area) => {
    const areaTasks = tasks.filter((t) => t.area?.id === area.id);
    const avg = areaTasks.length
      ? Math.round(areaTasks.reduce((sum, t) => sum + t.progress, 0) / areaTasks.length)
      : 0;
    return { name: area.name, progreso: avg };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avance por área</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={90}
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip {...tooltipStyle()} cursor={{ fill: "#f1f5f9" }} formatter={(v) => `${v}%`} />
            <Bar dataKey="progreso" radius={[0, 6, 6, 0]} fill="#4f46e5" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function TasksByMemberChart({
  tasks,
  members,
}: {
  tasks: TaskWithRelations[];
  members: { id: string; name: string }[];
}) {
  const data = members
    .map((m) => ({
      name: m.name.split(" ")[0],
      asignadas: tasks.filter((t) => t.assignee?.id === m.id).length,
    }))
    .filter((d) => d.asignadas > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tareas por integrante</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Aún no hay tareas asignadas.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle()} cursor={{ fill: "#f1f5f9" }} />
              <Bar dataKey="asignadas" radius={[6, 6, 0, 0]} fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
