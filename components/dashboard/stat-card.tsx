import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "danger" | "success" | "warning";
}) {
  const toneClasses = {
    default: "bg-indigo-50 text-indigo-600",
    danger: "bg-red-50 text-red-600",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
  }[tone];

  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg shrink-0", toneClasses)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-semibold text-foreground leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </Card>
  );
}
