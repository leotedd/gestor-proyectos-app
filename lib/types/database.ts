// Tipos manuales que reflejan supabase/migrations/0001_init.sql.
// Si el esquema cambia, actualiza este archivo (o genera con `supabase gen types`).

export type ProjectRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type ProjectStatus = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type InvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";

export interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  username: string | null;
  is_guest: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  key: string;
  description: string;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  owner_id: string;
  next_task_number: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface ProjectMemberRow {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  area_id: string | null;
  invited_by: string | null;
  created_at: string;
}

export interface AreaRow {
  id: string;
  project_id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface TaskRow {
  id: string;
  project_id: string;
  code: string;
  title: string;
  description: string;
  area_id: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  start_date: string | null;
  due_date: string | null;
  progress: number;
  labels: string[];
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskAssignmentRow {
  id: string;
  task_id: string;
  user_id: string;
  assigned_by: string | null;
  assigned_at: string;
}

export interface TaskCommentRow {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export interface AttachmentRow {
  id: string;
  project_id: string;
  task_id: string | null;
  uploaded_by: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size: number | null;
  created_at: string;
}

export interface InvitationRow {
  id: string;
  project_id: string;
  email: string;
  role: ProjectRole;
  token: string;
  status: InvitationStatus;
  expires_at: string;
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
}

export interface InvitationPreview {
  project_name: string;
  project_key: string;
  role: ProjectRole;
  email: string;
  status: InvitationStatus;
  expires_at: string;
}

export interface ActivityLogRow {
  id: string;
  project_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

type TableDef<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<
        ProfileRow,
        Partial<ProfileRow> & { id: string; email: string },
        Partial<ProfileRow>
      >;
      projects: TableDef<
        ProjectRow,
        Partial<ProjectRow> & { name: string; key: string; owner_id: string },
        Partial<ProjectRow>
      >;
      project_members: TableDef<
        ProjectMemberRow,
        Partial<ProjectMemberRow> & {
          project_id: string;
          user_id: string;
          role: ProjectRole;
        },
        Partial<ProjectMemberRow>
      >;
      areas: TableDef<
        AreaRow,
        Partial<AreaRow> & { project_id: string; name: string },
        Partial<AreaRow>
      >;
      tasks: TableDef<
        TaskRow,
        Partial<TaskRow> & { project_id: string; title: string },
        Partial<TaskRow>
      >;
      task_assignments: TableDef<
        TaskAssignmentRow,
        Partial<TaskAssignmentRow> & { task_id: string; user_id: string },
        Partial<TaskAssignmentRow>
      >;
      task_comments: TableDef<
        TaskCommentRow,
        Partial<TaskCommentRow> & { task_id: string; body: string },
        Partial<TaskCommentRow>
      >;
      attachments: TableDef<
        AttachmentRow,
        Partial<AttachmentRow> & {
          project_id: string;
          file_name: string;
          storage_path: string;
        },
        Partial<AttachmentRow>
      >;
      invitations: TableDef<
        InvitationRow,
        Partial<InvitationRow> & {
          project_id: string;
          email: string;
          role: ProjectRole;
        },
        Partial<InvitationRow>
      >;
      activity_logs: TableDef<
        ActivityLogRow,
        Partial<ActivityLogRow> & {
          project_id: string;
          action: string;
          entity_type: string;
        },
        Partial<ActivityLogRow>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      is_project_member: {
        Args: { p_project_id: string; p_user_id?: string };
        Returns: boolean;
      };
      get_project_role: {
        Args: { p_project_id: string; p_user_id?: string };
        Returns: ProjectRole;
      };
      has_project_role: {
        Args: { p_project_id: string; p_roles: ProjectRole[] };
        Returns: boolean;
      };
      get_invitation_preview: {
        Args: { p_token: string };
        Returns: InvitationPreview[];
      };
      accept_invitation_by_token: {
        Args: { p_token: string; p_full_name: string; p_username?: string | null };
        Returns: string;
      };
    };
    Enums: {
      project_role: ProjectRole;
      project_status: ProjectStatus;
      task_priority: TaskPriority;
      task_status: TaskStatus;
      invitation_status: InvitationStatus;
    };
  };
}
