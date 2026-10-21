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

// Map Heatmap Types
export interface ShelfMetadata {
  id: string;
  name: string;
  isle: string;
  area: string;
  cad_centroid: [number, number];
  svg_centroid: [number, number];
  svg_points: string;
  bounds_svg: [number, number, number, number];
}

export interface MajorLabel {
  text: string;
  pos_svg: [number, number];
  area: string;
  type: string;
  size: number;
}

export interface StoreAreaInfo {
  id: string;
  name: string;
  description: string;
  shelf_count: number;
  zone_count: number;
  color: string;
}

export interface ZoneMetadata {
  id: string;
  name: string;
  area: number;
  parent_area?: string;
  area_id?: string;
  is_delica?: boolean;
  is_entrance?: boolean;
  svg_points: string;
  centroid_svg: [number, number];
  cad_centroid?: [number, number];
}

export interface MapLayout {
  viewbox_full: string;
  viewbox_focused: string;
  viewbox_delica?: string;
  store_boundary?: string;
  areas?: StoreAreaInfo[];
  major_labels?: MajorLabel[];
  total_shelves: number;
  total_zones: number;
  shelves: ShelfMetadata[];
  zones: ZoneMetadata[];
}

export interface TopShelfInfo {
  id: string;
  name: string;
  isle: string;
  area: string;
  count: number;
  percentage: number;
}

export interface AreaStat {
  total_events: number;
  shelves_with_events: number;
  total_shelves: number;
  description?: string;
  status?: string;
}

export interface IsleStat {
  total_events: number;
  shelves_with_events: number;
  total_shelves: number;
  area: string;
}

export interface DailyHeatmap {
  date: string;
  total_events: number;
  mapped_events: number;
  unmapped_events: number;
  mapped_percentage: number;
  shelves_total: number;
  shelves_with_events: number;
  isles_count: number;
  areas_count: number;
  top_shelf: TopShelfInfo | null;
  action_breakdown?: Record<string, number>;
  shelf_counts: Record<string, number>;
  area_summary: Record<string, AreaStat>;
  isle_summary: Record<string, IsleStat>;
  processed_at?: string;
  duration_seconds?: number;
}

export interface HeatmapDateSummary {
  date: string;
  total_events: number;
  mapped_events: number;
  unmapped_events: number;
  top_shelf_name: string;
  top_shelf_count: number;
  shelves_with_events: number;
}

export interface HeatmapManifest {
  available_dates: string[];
  total_days: number;
  dates_summary: HeatmapDateSummary[];
  last_updated: string;
}

