// ============================================================
// DevDash — TypeScript 类型定义
// ============================================================

// --- 数据源 ---
export type AuthType = 'token' | 'oauth' | 'basic' | 'none';
export type SourceType = 'github' | 'gitlab' | 'jira' | 'slack' | 'linear' | 'jenkins';

export interface RepoSpec {
  owner: string;
  repo: string;
}

export interface DataSource {
  id: string;
  pluginId: string;
  type: SourceType;
  label: string;
  config: Record<string, unknown>;
  pollMs: number;          // 轮询间隔，默认 5 分钟
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- 数据项 ---
export type ItemKind =
  | 'pull_request'
  | 'issue'
  | 'ci_run'
  | 'pipeline'
  | 'build'
  | 'release'
  | 'commit'
  | 'task'
  | 'notification';

export type ItemStatus =
  | 'open' | 'closed' | 'merged' | 'draft'
  | 'pending' | 'running' | 'success' | 'failure' | 'cancelled'
  | 'todo' | 'in_progress' | 'done'
  | 'unread' | 'read';

export interface DataItem {
  id: string;
  sourceId: string;
  kind: ItemKind;
  externalId: string;
  title: string;
  body: string | null;
  url: string | null;
  status: ItemStatus;
  author: string | null;
  metadata: Record<string, unknown>;
  fetchedAt: string;
}

// --- Dashboard & Widget ---
export type WidgetType =
  | 'pr_list'
  | 'ci_status'
  | 'issue_list'
  | 'ai_summary'
  | 'activity_calendar'
  | 'notification_feed'
  | 'sprint_board'
  | 'today_overview';

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Widget {
  id: string;
  dashboardId: string;
  pluginId: string;
  widgetType: WidgetType;
  sourceId: string | null;
  position: WidgetPosition;
  config: Record<string, unknown>;
  createdAt: string;
}

export interface Dashboard {
  id: string;
  name: string;
  layout: WidgetPosition[];   // 布局元数据（列数等）
  isDefault: boolean;
  widgets: Widget[];
  createdAt: string;
}

// --- AI ---
export type AIProvider = 'ollama' | 'openai' | 'claude' | 'none';

export interface AISettings {
  provider: AIProvider;
  apiKey?: string;
  baseUrl?: string;           // Ollama 地址，如 http://localhost:11434
  model?: string;             // 模型名，如 llama3, gpt-4o
  enabled: boolean;
}

// --- 应用设置 ---
export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  ai: AISettings;
  pollingEnabled: boolean;
  minimizeToTray: boolean;
  launchAtStartup: boolean;
}

// --- 插件 ---
export interface PluginMeta {
  id: string;
  name: string;
  version: string;
  icon: string;
  author?: string;
  description?: string;
}

export interface DataSourceConfig {
  id: string;
  label: string;
  authType: AuthType;
  pollIntervalMs: number;
}

export interface DevDashPlugin {
  meta: PluginMeta;
  dataSources: DataSourceConfig[];
  widgets: WidgetType[];
}
