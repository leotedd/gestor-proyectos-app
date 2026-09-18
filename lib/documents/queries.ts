import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AttachmentRow } from "@/lib/types/database";

export interface AttachmentWithUploader extends AttachmentRow {
  uploader: { full_name: string; email: string } | null;
}

export async function listProjectAttachments(
  projectId: string
): Promise<AttachmentWithUploader[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attachments")
    .select("*, uploader:profiles(full_name, email)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as unknown as AttachmentWithUploader[];
}
