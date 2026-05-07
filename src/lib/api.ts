import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Dashboard, Widget } from "../types";

// ─── Dashboards ───────────────────────────────────────────────────────────────

export async function apiListDashboards(): Promise<Dashboard[]> {
  return invoke("list_dashboards");
}

export async function apiCreateDashboard(name: string): Promise<Dashboard> {
  return invoke("create_dashboard", { name });
}

export async function apiDeleteDashboard(id: string): Promise<void> {
  return invoke("delete_dashboard", { id });
}

export async function apiCreateWidget(
  dashboardId: string,
  pluginId: string,
  widgetType: string,
  sourceId: string | null,
  position: { x: number; y: number; w: number; h: number },
  config: Record<string, unknown> = {}
): Promise<Widget> {
  return invoke("create_widget", {
    widget: { dashboardId, pluginId, widgetType, sourceId, position, config },
  });
}

export async function apiDeleteWidget(id: string): Promise<void> {
  return invoke("delete_widget", { id });
}

export async function apiUpdateWidgetPosition(
  id: string,
  position: { x: number; y: number; w: number; h: number }
): Promise<void> {
  return invoke("update_widget_position", { id, position });
}

// ─── Sources ─────────────────────────────────────────────────────────────────

export interface CreateSourceInput {
  pluginId: string;
  type: "github" | "gitlab" | "jira" | "linear";
  label: string;
  config: Record<string, unknown>;
  pollMs?: number;
  enabled?: boolean;
}

export interface DataSource {
  id: string;
  pluginId: string;
  type: string;
  label: string;
  config: Record<string, unknown>;
  pollMs: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function apiListSources(): Promise<DataSource[]> {
  return invoke("list_sources");
}

export async function apiCreateSource(input: CreateSourceInput): Promise<DataSource> {
  return invoke("create_source", {
    source: {
      pluginId: input.pluginId,
      type: input.type,
      label: input.label,
      config: input.config,
      pollMs: input.pollMs ?? 300000,
      enabled: input.enabled ?? true,
    },
  });
}

export async function apiDeleteSource(id: string): Promise<void> {
  return invoke("delete_source", { id });
}

// ─── Data Items ──────────────────────────────────────────────────────────────

export interface ApiDataItem {
  id: string;
  sourceId: string;
  kind: string;
  externalId: string;
  title: string;
  body?: string;
  url?: string;
  status?: string;
  author?: string;
  metadata: Record<string, unknown>;
  fetchedAt: string;
}

export async function apiGetDataItems(
  sourceId: string,
  kind?: string
): Promise<ApiDataItem[]> {
  return invoke("get_data_items", { sourceId, kind: kind ?? null });
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface ApiAppSettings {
  theme: "dark" | "light" | "system";
  ai: {
    provider: string;
    enabled: boolean;
    baseUrl?: string;
    model?: string;
    apiKey?: string;
  };
  pollingEnabled: boolean;
  minimizeToTray: boolean;
  launchAtStartup: boolean;
}

export async function apiGetSettings(): Promise<ApiAppSettings> {
  return invoke("get_settings");
}

export async function apiSaveSettings(settings: ApiAppSettings): Promise<void> {
  return invoke("save_settings", { settings });
}

// ─── GitHub / GitLab ─────────────────────────────────────────────────────────

export interface FetchResult {
  prs: number;
  issues: number;
  notifications: number;
  ci_runs: number;
  errors: string[];
}

export interface PollResult {
  success: boolean;
  message: string;
  github?: FetchResult;
  gitlab?: number;
  jira?: number;
  linear?: number;
  errors: string[];
}

export async function apiFetchGithub(): Promise<FetchResult> {
  return invoke("fetch_github_data");
}

export async function apiFetchGitlab(): Promise<number> {
  return invoke("fetch_gitlab_data");
}

export async function apiPollSources(): Promise<PollResult> {
  return invoke("poll_sources");
}

// ─── AI ────────────────────────────────────────────────────────────────────

export async function generateAiSummary(): Promise<string> {
  return invoke("generate_ai_summary");
}

export async function apiTestAiConnection(provider: string, baseUrl?: string, apiKey?: string): Promise<boolean> {
  return invoke("test_ai_connection", { provider, baseUrl, apiKey });
}

export interface ContributionsDay {
  date: string;
  count: number;
  level: number;
}

export interface ContributionsResponse {
  days: ContributionsDay[];
  total: number;
  streak: number;
}

export async function apiFetchContributions(username?: string): Promise<ContributionsResponse> {
  return invoke("fetch_github_contributions", { username: username ?? null });
}

export function onDataUpdated(callback: () => void): Promise<UnlistenFn> {
  return listen("data-updated", callback);
}

// ─── PR Quick Actions ────────────────────────────────────────────────────────

export interface PRActionResult {
  success: boolean;
  message: string;
  action: string;
}

export async function apiApprovePR(
  owner: string,
  repo: string,
  prNumber: number,
  body?: string
): Promise<PRActionResult> {
  return invoke("github_approve_pr", { owner, repo, prNumber, body: body ?? null });
}

export async function apiMergePR(
  owner: string,
  repo: string,
  prNumber: number,
  mergeMethod?: string
): Promise<PRActionResult> {
  return invoke("github_merge_pr", { owner, repo, prNumber, mergeMethod: mergeMethod ?? null });
}

export async function apiCommentPR(
  owner: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<PRActionResult> {
  return invoke("github_comment_pr", { owner, repo, prNumber, body });
}

export async function apiClosePR(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRActionResult> {
  return invoke("github_close_pr", { owner, repo, prNumber });
}

export async function apiRequestReview(
  owner: string,
  repo: string,
  prNumber: number,
  reviewers: string[]
): Promise<PRActionResult> {
  return invoke("github_request_review", { owner, repo, prNumber, reviewers });
}

// ─── Issue Trackers ─────────────────────────────────────────────────────────

export async function apiFetchJira(): Promise<number> {
  return invoke("fetch_jira_data");
}

export async function apiFetchLinear(): Promise<number> {
  return invoke("fetch_linear_data");
}

// ─── Debug ───────────────────────────────────────────────────────────────────

export async function apiDebugDbState(): Promise<string> {
  return invoke("debug_db_state");
}

export async function apiDiagnoseGithub(): Promise<Record<string, unknown>> {
  return invoke("diagnose_github_data");
}

export async function apiEncryptExistingTokens(): Promise<{ migrated: number; already_encrypted: number; failed: number; message: string }> {
  return invoke("encrypt_existing_tokens");
}

export async function apiVerifyGithubToken(token: string): Promise<{ valid: boolean; login: string; name: string; avatar_url: string; public_repos: number; message: string }> {
  return invoke("verify_github_token", { token });
}
