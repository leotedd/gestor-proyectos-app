import type { ProfileRow, TaskRow } from "@/lib/types/database";

export interface TaskWithRelations extends TaskRow {
  area: { id: string; name: string } | null;
  assignee: Pick<ProfileRow, "id" | "full_name" | "email" | "avatar_url"> | null;
}
