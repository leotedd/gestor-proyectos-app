import { requireProfile } from "@/lib/auth/dal";
import { listUserProjects } from "@/lib/projects/queries";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const projects = await listUserProjects();

  return (
    <AppShell profile={profile} projects={projects}>
      {children}
    </AppShell>
  );
}
