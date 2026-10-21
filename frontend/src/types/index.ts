export type UserRole = 'admin' | 'inspector' | 'supervisor';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export type CameraSystem = 'InaAI' | 'AEON';

export interface Camera {
  id: string;
  name: string;
  code: string;
  system: CameraSystem;
  nvr: string;
  channel_no?: number;
  status: 'online' | 'offline' | 'maintenance';
  created_at: string;
}

export type FieldType = 
  | 'number' 
  | 'text' 
  | 'dropdown' 
  | 'radio' 
  | 'checkbox' 
  | 'yes_no' 
  | 'date' 
  | 'photo' 
  | 'formula';

export interface ConditionalRule {
  field_key: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'contains';
  value: any;
}

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  min?: number;
  max?: number;
  options?: string[];
  placeholder?: string;
  default_value?: any;
  show_if?: ConditionalRule;
  formula?: string;
  help_text?: string;
}

export interface FormSchema {
  name: string;
  description: string;
  fields: FormField[];
}

export interface FormTemplate {
  id: string;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  latest_version?: number;
  created_at: string;
  versions?: FormTemplateVersion[];
}

export interface FormTemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  schema: FormSchema;
  created_by?: string;
  created_at: string;
}

export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'REVISION_NEEDED';

export interface InspectionTask {
  id: string;
  camera_id: string;
  assigned_user_id: string;
  template_version_id: string;
  status: TaskStatus;
  draft_data?: Record<string, any>;
  target_date?: string;
  target_time_slot?: string;
  due_date?: string;
  completed_at?: string;
  created_at: string;

  // Joined fields
  camera_name?: string;
  camera_code?: string;
  camera_system?: CameraSystem;
  camera_nvr?: string;
  camera_channel_no?: number;
  assigned_user_name?: string;
  template_name?: string;
  version_number?: number;
  schema?: FormSchema;
}

export interface InspectionRecord {
  id: string;
  task_id: string;
  camera_id: string;
  inspector_id: string;
  template_version_id: string;
  payload: Record<string, any>;
  notes?: string;
  target_date?: string;
  target_time_slot?: string;
  review_status: 'PENDING' | 'APPROVED' | 'REVISION_REQUESTED';
  review_notes?: string;
  reviewer_id?: string;
  submitted_at: string;
  reviewed_at?: string;

  camera_name?: string;
  camera_code?: string;
  camera_system?: CameraSystem;
  camera_nvr?: string;
  camera_channel_no?: number;
  inspector_name?: string;
  template_name?: string;
  version_number?: number;
  reviewer_name?: string;
}

export interface UserProgressStat {
  user_id: string;
  user_name: string;
  user_email: string;
  role: string;
  total_assigned: number;
  done_count: number;
  in_progress_count: number;
  not_started_count: number;
  revision_count: number;
  progress_pct: number;
}

export interface DashboardStats {
  total_tasks: number;
  done_tasks: number;
  in_progress_tasks: number;
  not_started_tasks: number;
  revision_tasks: number;
  overall_progress_pct: number;
  user_progress_stats: UserProgressStat[];
  camera_status_summary: Record<string, number>;
}

export interface ResultsSummary {
  total_inspections: number;
  total_people_counted: number;
  total_males_counted: number;
  total_females_counted: number;
  total_issues_found: number;
  category_breakdown: Record<string, number>;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  action: string;
  target_type: string;
  target_id?: string;
  details?: Record<string, any>;
  created_at: string;
}

export interface AuditStats {
  total_logs: number;
  today_logs: number;
  action_breakdown: Record<string, number>;
  category_breakdown: Record<string, number>;
}
