import { supabase } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    return headers;
  }

  private async request(path: string, options: RequestInit = {}) {
    const headers = await this.getAuthHeaders();

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
      throw new Error(error.error?.message || "API request failed");
    }

    return res.json();
  }

  // Clients
  async getClients() { return this.request("/api/admin/clients"); }
  async getClient(id: string) { return this.request(`/api/admin/clients/${id}`); }
  async createClient(data: any) { return this.request("/api/admin/clients", { method: "POST", body: JSON.stringify(data) }); }
  async updateClient(id: string, data: any) { return this.request(`/api/admin/clients/${id}`, { method: "PUT", body: JSON.stringify(data) }); }
  async deleteClient(id: string) { return this.request(`/api/admin/clients/${id}`, { method: "DELETE" }); }

  // Verticals
  async getVerticals() { return this.request("/api/admin/verticals"); }

  // Departments
  async getDepartments(clientId: string) { return this.request(`/api/admin/clients/${clientId}/departments`); }
  async createDepartment(clientId: string, data: any) { return this.request(`/api/admin/clients/${clientId}/departments`, { method: "POST", body: JSON.stringify(data) }); }
  async updateDepartment(clientId: string, id: string, data: any) { return this.request(`/api/admin/clients/${clientId}/departments/${id}`, { method: "PUT", body: JSON.stringify(data) }); }
  async deleteDepartment(clientId: string, id: string) { return this.request(`/api/admin/clients/${clientId}/departments/${id}`, { method: "DELETE" }); }

  // Directory
  async getDirectory(clientId: string) { return this.request(`/api/admin/clients/${clientId}/directory`); }
  async createDirectoryEntry(clientId: string, data: any) { return this.request(`/api/admin/clients/${clientId}/directory`, { method: "POST", body: JSON.stringify(data) }); }
  async updateDirectoryEntry(clientId: string, id: string, data: any) { return this.request(`/api/admin/clients/${clientId}/directory/${id}`, { method: "PUT", body: JSON.stringify(data) }); }
  async deleteDirectoryEntry(clientId: string, id: string) { return this.request(`/api/admin/clients/${clientId}/directory/${id}`, { method: "DELETE" }); }

  // Hours
  async getHours(clientId: string) { return this.request(`/api/admin/clients/${clientId}/hours`); }
  async upsertHours(clientId: string, data: any) { return this.request(`/api/admin/clients/${clientId}/hours`, { method: "POST", body: JSON.stringify(data) }); }

  // Holidays
  async getHolidays(clientId: string) { return this.request(`/api/admin/clients/${clientId}/holidays`); }
  async createHoliday(clientId: string, data: any) { return this.request(`/api/admin/clients/${clientId}/holidays`, { method: "POST", body: JSON.stringify(data) }); }
  async updateHoliday(clientId: string, id: string, data: any) { return this.request(`/api/admin/clients/${clientId}/holidays/${id}`, { method: "PUT", body: JSON.stringify(data) }); }
  async deleteHoliday(clientId: string, id: string) { return this.request(`/api/admin/clients/${clientId}/holidays/${id}`, { method: "DELETE" }); }

  // Routing
  async getRouting(clientId: string) { return this.request(`/api/admin/clients/${clientId}/routing`); }
  async createRoutingRule(clientId: string, data: any) { return this.request(`/api/admin/clients/${clientId}/routing`, { method: "POST", body: JSON.stringify(data) }); }
  async updateRoutingRule(clientId: string, id: string, data: any) { return this.request(`/api/admin/clients/${clientId}/routing/${id}`, { method: "PUT", body: JSON.stringify(data) }); }
  async deleteRoutingRule(clientId: string, id: string) { return this.request(`/api/admin/clients/${clientId}/routing/${id}`, { method: "DELETE" }); }

  // Intents
  async getIntents(clientId: string) { return this.request(`/api/admin/clients/${clientId}/intents`); }
  async createIntent(clientId: string, data: any) { return this.request(`/api/admin/clients/${clientId}/intents`, { method: "POST", body: JSON.stringify(data) }); }
  async updateIntent(clientId: string, id: string, data: any) { return this.request(`/api/admin/clients/${clientId}/intents/${id}`, { method: "PUT", body: JSON.stringify(data) }); }
  async deleteIntent(clientId: string, id: string) { return this.request(`/api/admin/clients/${clientId}/intents/${id}`, { method: "DELETE" }); }

  // Knowledge Base
  async getKb(clientId: string) { return this.request(`/api/admin/clients/${clientId}/kb`); }
  async createKbItem(clientId: string, data: any) { return this.request(`/api/admin/clients/${clientId}/kb`, { method: "POST", body: JSON.stringify(data) }); }
  async updateKbItem(clientId: string, id: string, data: any) { return this.request(`/api/admin/clients/${clientId}/kb/${id}`, { method: "PUT", body: JSON.stringify(data) }); }
  async deleteKbItem(clientId: string, id: string) { return this.request(`/api/admin/clients/${clientId}/kb/${id}`, { method: "DELETE" }); }

  // Deployments
  async getDeployments(clientId: string) { return this.request(`/api/admin/clients/${clientId}/deployments`); }
  async createDeployment(clientId: string, data: any) { return this.request(`/api/admin/clients/${clientId}/deployments`, { method: "POST", body: JSON.stringify(data) }); }
  async updateDeployment(clientId: string, id: string, data: any) { return this.request(`/api/admin/clients/${clientId}/deployments/${id}`, { method: "PUT", body: JSON.stringify(data) }); }
  async deleteDeployment(clientId: string, id: string) { return this.request(`/api/admin/clients/${clientId}/deployments/${id}`, { method: "DELETE" }); }

  // Publish
  async publish(clientId: string, notes?: string) { return this.request(`/api/admin/clients/${clientId}/publish`, { method: "POST", body: JSON.stringify({ notes }) }); }
  async getVersions(clientId: string) { return this.request(`/api/admin/clients/${clientId}/versions`); }

  // Preview
  async simulate(data: any) { return this.request("/api/admin/preview/simulate", { method: "POST", body: JSON.stringify(data) }); }

  // Audit
  async getAuditLogs(clientId: string) { return this.request(`/api/admin/clients/${clientId}/audit`); }

  // Imports
  async uploadImport(clientId: string, formData: FormData) {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
    const res = await fetch(`${this.baseUrl}/api/admin/clients/${clientId}/imports`, { method: "POST", headers, body: formData });
    if (!res.ok) throw new Error("Import failed");
    return res.json();
  }
  async getImports(clientId: string) { return this.request(`/api/admin/clients/${clientId}/imports`); }
  async getImport(clientId: string, id: string) { return this.request(`/api/admin/clients/${clientId}/imports/${id}`); }
  async approveImport(clientId: string, id: string) { return this.request(`/api/admin/clients/${clientId}/imports/${id}/approve`, { method: "POST" }); }
}

export const api = new ApiClient();
export default api;
