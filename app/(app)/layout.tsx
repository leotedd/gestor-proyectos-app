import { requireProfile } from "@/lib/auth/dal";
import { listUserProjects } from "@/lib/projects/queries";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, projects] = await Promise.all([requireProfile(), listUserProjects()]);

  return (
    <AppShell profile={profile} projects={projects}>
      {children}
    </AppShell>
  );
}
