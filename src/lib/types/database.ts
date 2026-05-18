export type UserRole = "admin" | "staff";

/** Legacy `activity_log.entity_type` values (historical rows may still use pursuit_record). */
export type ActivityEntityType = "opportunity" | "pursuit_record";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type ActivityLogRow = {
  id: string;
  entity_type: ActivityEntityType;
  entity_id: string;
  user_id: string | null;
  action_type: string;
  details: Record<string, unknown>;
  created_at: string;
};
