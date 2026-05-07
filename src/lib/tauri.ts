import { invoke } from "@tauri-apps/api/core";
import type { DataSource, Dashboard, Widget, DataItem, AppSettings } from "../types";

// ---- DataSource ----
export const sourceApi = {
  list: () => invoke<DataSource[]>("list_sources"),
  create: (source: Omit<DataSource, "id" | "createdAt" | "updatedAt">) =>
    invoke<DataSource>("create_source", { source }),
  update: (id: string, source: Partial<DataSource>) =>
    invoke<DataSource>("update_source", { id, source }),
  delete: (id: string) => invoke<void>("delete_source", { id }),
  test: (id: string) => invoke<boolean>("test_source", { id }),
};

// ---- Dashboard ----
export const dashboardApi = {
  list: () => invoke<Dashboard[]>("list_dashboards"),
  create: (name: string) => invoke<Dashboard>("create_dashboard", { name }),
  delete: (id: string) => invoke<void>("delete_dashboard", { id }),
  setDefault: (id: string) => invoke<void>("set_default_dashboard", { id }),
};

// ---- Widget ----
export const widgetApi = {
  create: (widget: Omit<Widget, "id" | "createdAt">) =>
    invoke<Widget>("create_widget", { widget }),
  update: (id: string, widget: Partial<Widget>) =>
    invoke<Widget>("update_widget", { id, widget }),
  delete: (id: string) => invoke<void>("delete_widget", { id }),
};

// ---- DataItems ----
export const dataApi = {
  getBySource: (sourceId: string, kind?: string) =>
    invoke<DataItem[]>("get_data_items", { sourceId, kind }),
  getByWidget: (widgetId: string) =>
    invoke<DataItem[]>("get_data_items_by_widget", { widgetId }),
  refresh: (sourceId: string) => invoke<void>("refresh_source", { sourceId }),
};

// ---- Settings ----
export const settingsApi = {
  get: () => invoke<AppSettings>("get_settings"),
  save: (settings: AppSettings) => invoke<void>("save_settings", { settings }),
};

// ---- AI ----
export const aiApi = {
  generateSummary: () => invoke<string>("generate_ai_summary"),
  testOllama: (baseUrl: string) => invoke<boolean>("test_ollama", { baseUrl }),
};
