import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "danger" | "success" | "info" | "warning";

const toneStyles: Record<Tone, { wrap: string; icon: typeof Info }> = {
  danger: { wrap: "bg-red-50 text-red-800 border-red-200", icon: AlertTriangle },
  success: { wrap: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  info: { wrap: "bg-blue-50 text-blue-800 border-blue-200", icon: Info },
  warning: { wrap: "bg-amber-50 text-amber-800 border-amber-200", icon: AlertTriangle },
};

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  const { wrap, icon: Icon } = toneStyles[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
        wrap,
        className
      )}
      role="alert"
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
