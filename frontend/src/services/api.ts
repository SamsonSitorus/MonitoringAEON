import {
  User,
  Camera,
  FormTemplate,
  FormTemplateVersion,
  FormSchema,
  InspectionTask,
  InspectionRecord,
  DashboardStats,
  ResultsSummary,
  UserRole,
  MapLayout,
  DailyHeatmap,
  HeatmapManifest
} from '../types';

const rawApiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const API_BASE = rawApiUrl ? `${rawApiUrl}/api/v1` : '/api/v1';

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('camtrack_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('camtrack_token', token);
    } else {
      localStorage.removeItem('camtrack_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        // ignore fallback
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // Auth & User
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.token);
    return res;
  }

  logout() {
    this.setToken(null);
  }

  async demoLogin(role?: UserRole, userId?: string): Promise<{ token: string; user: User }> {
    const res = await this.request<{ token: string; user: User }>('/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ role, user_id: userId }),
    });
    this.setToken(res.token);
    return res;
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async getUsers(role?: string): Promise<User[]> {
    const query = role ? `?role=${role}` : '';
    return this.request<User[]>(`/users${query}`);
  }

  async createUser(data: { name: string; email: string; password: string; role: UserRole }): Promise<User> {
    return this.request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: { name?: string; email?: string; role?: UserRole; password?: string }): Promise<User> {
    return this.request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string): Promise<void> {
    return this.request<void>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  async checkHealth(): Promise<{ status: string; system: string }> {
    const host = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${host}/health`);
    return res.json();
  }

  // Cameras
  async getCameras(search?: string, status?: string): Promise<Camera[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<Camera[]>(`/cameras${qs}`);
  }

  async getCamera(id: string): Promise<Camera> {
    return this.request<Camera>(`/cameras/${id}`);
  }

  async createCamera(camera: Partial<Camera>): Promise<Camera> {
    return this.request<Camera>('/cameras', {
      method: 'POST',
      body: JSON.stringify(camera),
    });
  }

  async updateCamera(id: string, camera: Partial<Camera>): Promise<Camera> {
    return this.request<Camera>(`/cameras/${id}`, {
      method: 'PUT',
      body: JSON.stringify(camera),
    });
  }

  async deleteCamera(id: string): Promise<void> {
    return this.request<void>(`/cameras/${id}`, {
      method: 'DELETE',
    });
  }

  // Form Templates & Versioning
  async getFormTemplates(): Promise<FormTemplate[]> {
    return this.request<FormTemplate[]>('/form-templates');
  }

  async getFormTemplate(id: string): Promise<FormTemplate> {
    return this.request<FormTemplate>(`/form-templates/${id}`);
  }

  async createFormTemplate(data: { name: string; code: string; description: string; schema: FormSchema }): Promise<any> {
    return this.request('/form-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createFormVersion(templateId: string, schema: FormSchema): Promise<FormTemplateVersion> {
    return this.request<FormTemplateVersion>(`/form-templates/${templateId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ schema }),
    });
  }

  async getFormVersion(templateId: string, versionId: string): Promise<FormTemplateVersion> {
    return this.request<FormTemplateVersion>(`/form-templates/${templateId}/versions/${versionId}`);
  }

  // Tasks
  async getTasks(params?: { assigned_to?: string; status?: string; camera_id?: string }): Promise<InspectionTask[]> {
    const q = new URLSearchParams();
    if (params?.assigned_to) q.append('assigned_to', params.assigned_to);
    if (params?.status) q.append('status', params.status);
    if (params?.camera_id) q.append('camera_id', params.camera_id);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request<InspectionTask[]>(`/inspection-tasks${qs}`);
  }

  async getTask(id: string): Promise<InspectionTask> {
    return this.request<InspectionTask>(`/inspection-tasks/${id}`);
  }

  async createTask(data: { camera_id: string; assigned_user_id: string; template_version_id: string; target_date?: string; target_time_slot?: string; due_date?: string }): Promise<InspectionTask> {
    return this.request<InspectionTask>('/inspection-tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async batchCreateTasks(data: { camera_ids: string[]; assigned_user_id: string; template_version_id: string; target_date?: string; target_time_slots?: string[]; due_date?: string }): Promise<any> {
    return this.request('/inspection-tasks/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async saveDraft(taskId: string, draftData: Record<string, any>): Promise<any> {
    return this.request(`/inspection-tasks/${taskId}/draft`, {
      method: 'POST',
      body: JSON.stringify({ draft_data: draftData }),
    });
  }

  async submitTask(taskId: string, payload: Record<string, any>, notes: string): Promise<any> {
    return this.request(`/inspection-tasks/${taskId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ payload, notes }),
    });
  }

  async reassignTask(taskId: string, assignedUserId: string): Promise<any> {
    return this.request(`/inspection-tasks/${taskId}/reassign`, {
      method: 'PUT',
      body: JSON.stringify({ assigned_user_id: assignedUserId }),
    });
  }

  async deleteTask(taskId: string): Promise<any> {
    return this.request(`/inspection-tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  // Records & Reviews
  async getRecords(params?: { camera_id?: string; inspector_id?: string; review_status?: string }): Promise<InspectionRecord[]> {
    const q = new URLSearchParams();
    if (params?.camera_id) q.append('camera_id', params.camera_id);
    if (params?.inspector_id) q.append('inspector_id', params.inspector_id);
    if (params?.review_status) q.append('review_status', params.review_status);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request<InspectionRecord[]>(`/inspection-records${qs}`);
  }

  async getRecord(id: string): Promise<InspectionRecord> {
    return this.request<InspectionRecord>(`/inspection-records/${id}`);
  }

  async reviewRecord(recordId: string, status: 'APPROVED' | 'REVISION_REQUESTED', notes: string): Promise<any> {
    return this.request(`/inspection-records/${recordId}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    });
  }

  // Dashboard Stats & Export
  async getDashboardStats(date?: string): Promise<DashboardStats> {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.request<DashboardStats>(`/dashboard/stats${query}`);
  }

  async getResultsSummary(): Promise<ResultsSummary> {
    return this.request<ResultsSummary>('/dashboard/results-summary');
  }

  async downloadExportCSV(): Promise<void> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const res = await fetch(`${API_BASE}/reports/export-csv`, { headers });
    if (!res.ok) throw new Error('Gagal mengunduh data CSV');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `camtrack_inspections_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  getExportCSVUrl(): string {
    return `${API_BASE}/reports/export-csv`;
  }

  // Map Heatmap API
  async getMapLayout(): Promise<MapLayout> {
    return this.request<MapLayout>('/map-heatmap/layout');
  }

  async getHeatmapManifest(): Promise<HeatmapManifest> {
    return this.request<HeatmapManifest>('/map-heatmap/manifest');
  }

  async getDailyHeatmap(date: string): Promise<DailyHeatmap> {
    return this.request<DailyHeatmap>(`/map-heatmap/daily?date=${encodeURIComponent(date)}`);
  }
}

export const api = new ApiService();

