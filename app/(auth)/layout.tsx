import { LayoutGrid } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold text-foreground">Flowbase</span>
        </div>
        <div className="rounded-xl border border-border bg-surface p-8 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
