// -*- coding: utf-8 -*-
// SettingsView.tsx - DevDash 设置页面 (UI 优化版)
// UTF-8 encoding for Chinese characters

import { useState } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import { useI18nStore } from "../../lib/i18n";
import { apiTestAiConnection, apiPollSources, apiVerifyGithubToken } from "../../lib/api";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import {
  ArrowLeft,
  GitBranch,
  GitMerge,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  Brain,
  Settings as SettingsIcon,
  Database,
  Info,
  Ticket,
  Zap,
  Cpu,
  Sparkles,
  Bot,
  Globe,
  Link2,
  KeyRound,
  HelpCircle,
  ExternalLink,
  Sun,
  Moon,
  Monitor,
  Languages,
  Palette,
  MessageSquare,
} from "lucide-react";

type SourceType = "github" | "gitlab" | "jira" | "linear";
type TabId = "general" | "sources" | "ai" | "about";

interface SettingsViewProps {
  onBack?: () => void;
}

// AI Provider 配置信息
const AI_PROVIDERS = [
  {
    id: "ollama",
    labelKey: "ai.ollama",
    icon: Cpu,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    description: "本地运行，隐私安全，免费使用",
    defaultUrl: "http://localhost:11434",
    defaultModel: "llama3",
    needApiKey: false,
    urlPlaceholder: "http://localhost:11434",
    modelPlaceholder: "llama3 / qwen2 / codellama",
    docUrl: "https://ollama.com",
  },
  {
    id: "openai",
    labelKey: "ai.openai",
    icon: Sparkles,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    description: "GPT-4o，业界最强通用模型",
    defaultUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    needApiKey: true,
    urlPlaceholder: "https://api.openai.com/v1",
    modelPlaceholder: "gpt-4o / gpt-4o-mini",
    docUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "claude",
    labelKey: "ai.claude",
    icon: MessageSquare,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    description: "Claude 3.5，擅长长文本和代码",
    defaultUrl: "https://api.anthropic.com",
    defaultModel: "claude-3-5-sonnet-20241022",
    needApiKey: true,
    urlPlaceholder: "https://api.anthropic.com",
    modelPlaceholder: "claude-3-5-sonnet-20241022",
    docUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "gemini",
    labelKey: "ai.gemini",
    icon: Globe,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    description: "Google Gemini，多模态能力强",
    defaultUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-1.5-pro",
    needApiKey: true,
    urlPlaceholder: "https://generativelanguage.googleapis.com/v1beta",
    modelPlaceholder: "gemini-1.5-pro / gemini-1.5-flash",
    docUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "openai_compat",
    labelKey: "ai.openaiCompat",
    icon: Link2,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    description: "兼容 OpenAI API 的任何服务",
    defaultUrl: "",
    defaultModel: "",
    needApiKey: true,
    urlPlaceholder: "https://your-api-endpoint/v1",
    modelPlaceholder: "自定义模型名称",
    docUrl: "",
  },
] as const;

export default function SettingsView({ onBack }: SettingsViewProps) {
  const { t, language, setLanguage } = useI18nStore();
  const { sources, settings, addSource, removeSource, updateSettings, saveSettings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [showAddSource, setShowAddSource] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<"success" | "failed" | null>(null);
  const [verifyingGithubToken, setVerifyingGithubToken] = useState(false);
  const [githubTokenVerified, setGithubTokenVerified] = useState<{login: string; public_repos: number} | null>(null);
  const [githubVerifyError, setGithubVerifyError] = useState<string | null>(null);

  // 新数据源表单
  const [newSource, setNewSource] = useState<{
    type: SourceType;
    label: string;
    token: string;
    owner: string;
    repo: string;
    apiUrl: string;
    all_repos: boolean;
    repos: Array<{ owner: string; repo: string }>;
    repoInput: string;
    jiraEmail: string;
    jiraBaseUrl: string;
    jiraProjectKey: string;
    jiraJql: string;
    linearTeamId: string;
  }>({
    type: "github",
    label: "",
    token: "",
    owner: "",
    repo: "",
    apiUrl: "",
    all_repos: false,
    repos: [],
    repoInput: "",
    jiraEmail: "",
    jiraBaseUrl: "https://yourcompany.atlassian.net",
    jiraProjectKey: "",
    jiraJql: "",
    linearTeamId: "",
  });

  const tabs = [
    { id: "general" as const, label: t("settings.general"), icon: SettingsIcon, description: "外观、语言等基础设置" },
    { id: "sources" as const, label: t("settings.dataSources"), icon: Database, description: "管理 GitHub、GitLab、Jira 等数据源" },
    { id: "ai" as const, label: t("settings.ai"), icon: Brain, description: "配置 AI 摘要服务（可选）" },
    { id: "about" as const, label: t("settings.about"), icon: Info, description: "版本信息和项目介绍" },
  ];

  // 获取当前选中的 provider 配置
  const currentProvider = AI_PROVIDERS.find(p => p.id === settings?.ai?.provider) || AI_PROVIDERS[0];

  // 测试 AI 连接
  const handleTestAi = async () => {
    if (!settings?.ai) return;
    setTestingAi(true);
    setAiTestResult(null);
    try {
      const ok = await apiTestAiConnection(
        settings.ai.provider,
        settings.ai.baseUrl,
        settings.ai.apiKey
      );
      setAiTestResult(ok ? "success" : "failed");
    } catch {
      setAiTestResult("failed");
    } finally {
      setTestingAi(false);
    }
  };

  // 添加数据源
  const handleAddSource = async () => {
    if (!newSource.label) return;
    
    const config: Record<string, unknown> = {};
    
    if (newSource.type === "github") {
      config.token = newSource.token;
      if (newSource.all_repos) {
        config.all_repos = true;
      } else if (newSource.repos.length > 0) {
        config.repos = newSource.repos;
      } else if (newSource.owner && newSource.repo) {
        config.owner = newSource.owner;
        config.repo = newSource.repo;
      }
    } else if (newSource.type === "gitlab") {
      config.token = newSource.token;
      if (newSource.apiUrl) {
        config.base_url = newSource.apiUrl;
      }
    } else if (newSource.type === "jira") {
      if (!newSource.jiraBaseUrl || !newSource.jiraEmail || !newSource.token) return;
      config.base_url = newSource.jiraBaseUrl;
      config.email = newSource.jiraEmail;
      config.api_token = newSource.token;
      if (newSource.jiraProjectKey) config.project_key = newSource.jiraProjectKey;
      if (newSource.jiraJql) config.jql = newSource.jiraJql;
    } else if (newSource.type === "linear") {
      if (!newSource.token) return;
      config.api_key = newSource.token;
      if (newSource.linearTeamId) config.team_id = newSource.linearTeamId;
    }

    try {
      await addSource({
        pluginId: newSource.type,
        type: newSource.type,
        label: newSource.label,
        config,
        pollMs: 300000,
        enabled: true,
      });
      await apiPollSources();
      setShowAddSource(false);
      setNewSource({
        type: "github",
        label: "",
        token: "",
        owner: "",
        repo: "",
        apiUrl: "",
        all_repos: false,
        repos: [],
        repoInput: "",
        jiraEmail: "",
        jiraBaseUrl: "https://yourcompany.atlassian.net",
        jiraProjectKey: "",
        jiraJql: "",
        linearTeamId: "",
      });
    } catch (e) {
      console.error("Failed to add source:", e);
    }
  };

  // 删除数据源
  const handleDeleteSource = async (id: string) => {
    if (confirm(t("settings.deleteConfirm"))) {
      await removeSource(id);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 头部 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onBack?.() || window.history.back()}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tabs.find(tab => tab.id === activeTab)?.description}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 侧边标签 */}
        <nav className="w-52 border-r border-border p-3 space-y-0.5 shrink-0">
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            导航
          </p>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "" : "opacity-70"}`} />
                <span className="text-sm">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* 内容区 */}
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          {/* ═══════════════ 通用设置 ═══════════════ */}
          {activeTab === "general" && (
            <div className="space-y-6 max-w-2xl">
              {/* 主题设置 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <Palette className="w-4.5 h-4.5 text-violet-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{t("settings.theme")}</CardTitle>
                      <CardDescription>选择你喜欢的界面风格</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { value: "dark", icon: Moon, label: t("settings.theme.dark"), desc: "护眼深色模式" },
                      { value: "light", icon: Sun, label: t("settings.theme.light"), desc: "明亮清爽风格" },
                      { value: "system", icon: Monitor, label: t("settings.theme.system"), desc: "跟随操作系统" },
                    ] as const).map(({ value, icon: Icon, label, desc }) => (
                      <button
                        key={value}
                        onClick={() => updateSettings({ theme: value })}
                        className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          settings?.theme === value
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/30 hover:bg-muted/50"
                        }`}
                      >
                        <Icon className={`w-6 h-6 ${settings?.theme === value ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-medium ${settings?.theme === value ? "text-foreground" : "text-muted-foreground"}`}>
                          {label}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{desc}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 语言设置 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Languages className="w-4.5 h-4.5 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{t("settings.language")}</CardTitle>
                      <CardDescription>选择界面显示语言</CardDescription>
                    </div>
                    </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 max-w-md">
                    {([
                      { value: "zh", label: "中文", flag: "🇨🇳", desc: "简体中文界面" },
                      { value: "en", label: "English", flag: "🇺🇸", desc: "English interface" },
                    ] as const).map(({ value, label, flag, desc }) => (
                      <button
                        key={value}
                        onClick={() => setLanguage(value)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                          language === value
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/30 hover:bg-muted/50"
                        }`}
                      >
                        <span className="text-2xl">{flag}</span>
                        <div className="text-left">
                          <p className={`text-sm font-medium ${language === value ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
                          <p className="text-[11px] text-muted-foreground">{desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════════════ 数据源设置 ═══════════════ */}
          {activeTab === "sources" && (
            <div className="space-y-6 max-w-2xl">
              {/* 已有数据源 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <Database className="w-4.5 h-4.5 text-green-500" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{t("settings.dataSources")}</CardTitle>
                        <CardDescription>连接你的代码托管和项目管理平台</CardDescription>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => setShowAddSource(true)} className="gap-1.5">
                      <Plus className="w-4 h-4" />
                      {t("settings.addSource")}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {sources.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                        <GitBranch className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <p className="font-medium text-foreground mb-1">还没有数据源</p>
                      <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
                        添加 GitHub 或 GitLab 数据源后，DevDash 会自动拉取 PR、Issue、CI 等数据
                      </p>
                      <Button size="sm" onClick={() => setShowAddSource(true)}>
                        <Plus className="w-4 h-4 mr-1" />
                        添加第一个数据源
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sources.map((source) => {
                        const sourceConfig: Record<string, { icon: typeof GitBranch; color: string; label: string }> = {
                          github: { icon: GitBranch, color: "text-gray-700 dark:text-gray-300", label: "GitHub" },
                          gitlab: { icon: GitMerge, color: "text-orange-600 dark:text-orange-400", label: "GitLab" },
                          jira: { icon: Ticket, color: "text-blue-600 dark:text-blue-400", label: "Jira" },
                          linear: { icon: Zap, color: "text-purple-600 dark:text-purple-400", label: "Linear" },
                        };
                        const cfg = sourceConfig[source.type] || { icon: Database, color: "", label: source.type };
                        const Icon = cfg.icon;
                        return (
                          <div
                            key={source.id}
                            className="group flex items-center justify-between p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0`}>
                                <Icon className={`w-5 h-5 ${cfg.color}`} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{source.label}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${cfg.color} bg-muted`}>
                                    {cfg.label}
                                  </span>
                                  {source.type === "github" && source.config?.all_repos && (
                                    <span className="text-xs px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-500 font-medium">
                                      所有仓库
                                    </span>
                                  )}
                                  {Array.isArray(source.config?.repos) && (source.config.repos as any[]).length > 0 && (
                                    <span className="text-xs text-muted-foreground font-mono">
                                      {(source.config.repos as any[]).map((r: any) => `${r.owner}/${r.repo}`).join(', ')}
                                    </span>
                                  )}
                                  {!source.config?.all_repos && !Array.isArray(source.config?.repos) && source.config?.owner && source.config?.repo && (
                                    <span className="text-xs text-muted-foreground font-mono">
                                      {String(source.config.owner)}/{String(source.config.repo)}
                                    </span>
                                  )}
                                  {source.type === "jira" && source.config?.base_url && (
                                    <span className="text-xs text-muted-foreground">
                                      {String(source.config.base_url).replace('https://', '').replace('.atlassian.net', '')}
                                    </span>
                                  )}
                                  {source.enabled ? (
                                    <span className="text-xs text-green-500">● 已启用</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">○ 已禁用</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteSource(source.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 添加数据源对话框 */}
              {showAddSource && (
                <Card className="border-primary/20 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-base">{t("settings.addSource")}</CardTitle>
                    <CardDescription>选择一个平台并填入连接信息</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* 类型选择 */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-1.5">
                        {t("settings.sourceType")}
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {([
                          { type: "github" as const, icon: GitBranch, label: "GitHub", desc: "PR / Issue / CI", color: "hover:border-gray-400" },
                          { type: "gitlab" as const, icon: GitMerge, label: "GitLab", desc: "MR / Pipeline", color: "hover:border-orange-400" },
                          { type: "jira" as const, icon: Ticket, label: "Jira", desc: "Issue 追踪", color: "hover:border-blue-400" },
                          { type: "linear" as const, icon: Zap, label: "Linear", desc: "任务管理", color: "hover:border-purple-400" },
                        ]).map(({ type, icon: Icon, label, desc, color }) => (
                          <button
                            key={type}
                            onClick={() => setNewSource({ ...newSource, type })}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                              newSource.type === type
                                ? "border-primary bg-primary/5 shadow-sm"
                                : `border-border ${color} hover:bg-muted/50`
                            }`}
                          >
                            <Icon className={`w-5 h-5 ${newSource.type === type ? "text-primary" : "text-muted-foreground"}`} />
                            <span className={`text-xs font-medium ${newSource.type === type ? "text-primary" : "text-foreground"}`}>{label}</span>
                            <span className="text-[10px] text-muted-foreground">{desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 标签 */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">显示名称</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        placeholder={
                          newSource.type === "github" ? "我的 GitHub" :
                          newSource.type === "gitlab" ? "我的 GitLab" :
                          newSource.type === "jira" ? "我的 Jira" :
                          "我的 Linear"
                        }
                        value={newSource.label}
                        onChange={(e) => setNewSource({ ...newSource, label: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">用于在界面上区分不同的数据源</p>
                    </div>

                    {/* Token / API Key */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5" />
                        {newSource.type === "jira" ? "API Token" : newSource.type === "linear" ? "API Key" : t("settings.token")}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          className="flex-1 px-3 py-2.5 rounded-lg border border-input bg-background font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                          placeholder={
                            newSource.type === "github" ? "ghp_xxxxxxxxxxxx..." :
                          newSource.type === "gitlab" ? "glpat-xxxxxxxxxxxx..." :
                          newSource.type === "jira" ? "ATATT3x..." :
                          "lin_api_..."
                        }
                        value={newSource.token}
                        onChange={(e) => {
                          setNewSource({ ...newSource, token: e.target.value });
                          setGithubTokenVerified(null);
                          setGithubVerifyError(null);
                        }}
                      />
                      {newSource.type === "github" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            if (!newSource.token.trim()) {
                              setGithubVerifyError("请先输入 Token");
                              return;
                            }
                            setVerifyingGithubToken(true);
                            setGithubVerifyError(null);
                            setGithubTokenVerified(null);
                            try {
                              const result = await apiVerifyGithubToken(newSource.token.trim());
                              setGithubTokenVerified({ login: result.login, public_repos: result.public_repos });
                            } catch (e: any) {
                              const msg = String(e?.message || e);
                              const cleanMsg = msg.replace(/^Invoke Error: \(error: "", message: "|"\)$/g, "");
                              setGithubVerifyError(cleanMsg);
                            } finally {
                              setVerifyingGithubToken(false);
                            }
                          }}
                          disabled={verifyingGithubToken}
                          className="shrink-0 gap-1.5 text-xs"
                        >
                          {verifyingGithubToken ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                          测试
                        </Button>
                      )}
                      </div>
                      {githubTokenVerified && (
                        <p className="text-xs text-green-500 flex items-center gap-1.5 mt-1">
                          <Check className="w-3.5 h-3.5" />
                          已连接 @${githubTokenVerified.login} · ${githubTokenVerified.public_repos} 个公开仓库
                        </p>
                      )}
                      {githubVerifyError && (
                        <p className="text-xs text-red-500 flex items-center gap-1.5 mt-1">
                          <X className="w-3.5 h-3.5" />
                          {githubVerifyError}
                        </p>
                      )}
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <HelpCircle className="w-3 h-3 mt-0.5 shrink-0" />
                        {newSource.type === "github" && (
                          <span>
                            在 GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens 创建。
                            建议勾选 <code className="px-1 py-0.5 rounded bg-muted text-[11px]">Contents (read-only)</code> 和 <code className="px-1 py-0.5 rounded bg-muted text-[11px]">Pull requests (read)</code> 权限。
                            Token 将被 AES-256 加密存储在本地。
                          </span>
                        )}
                        {newSource.type === "gitlab" && (
                          <span>
                            在 GitLab → Preferences → Access Tokens 创建。需要 <code className="px-1 py-0.5 rounded bg-muted text-[11px]">read_api</code> 权限。
                          </span>
                        )}
                        {newSource.type === "jira" && (
                          <span>
                            Atlassian 账号设置 → Security → API tokens → Create API token。
                            同时需要填写下方的邮箱地址用于身份验证。
                          </span>
                        )}
                        {newSource.type === "linear" && (
                          <span>
                            在 Linear → Settings → API → Personal API keys 创建。
                          </span>
                        )}
                      </div>
                    </div>

                    {/* GitHub 专属字段 */}
                    {newSource.type === "github" && (
                      <div className="space-y-4 pt-2 border-t border-border">
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          <GitBranch className="w-4 h-4" /> 仓库范围
                        </p>
                        
                        {/* All repos toggle */}
                        <label className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={newSource.all_repos}
                            onChange={(e) => setNewSource({ ...newSource, all_repos: e.target.checked })}
                            className="w-4 h-4 rounded border-border accent-primary"
                          />
                          <div>
                            <p className="text-sm font-medium">监控所有仓库</p>
                            <p className="text-xs text-muted-foreground">自动发现 Token 可访问的所有仓库（最多 1000 个）</p>
                          </div>
                        </label>

                        {!newSource.all_repos && (
                          <>
                            {/* Multi-repo input */}
                            <div className="space-y-1.5">
                              <label className="text-sm font-medium">指定仓库列表</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  className="flex-1 px-3 py-2 rounded-lg border border-input bg-background font-mono text-sm"
                                  placeholder="owner/repo（回车添加）"
                                  value={newSource.repoInput}
                                  onChange={(e) => setNewSource({ ...newSource, repoInput: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && newSource.repoInput.includes("/")) {
                                      e.preventDefault();
                                      const parts = newSource.repoInput.split("/");
                                      if (parts.length >= 2 && parts[0] && parts[1]) {
                                        setNewSource({
                                          ...newSource,
                                          repos: [...newSource.repos, { owner: parts[0], repo: parts[1] }],
                                          repoInput: "",
                                        });
                                      }
                                    }
                                  }}
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const input = newSource.repoInput;
                                    if (input.includes("/")) {
                                      const parts = input.split("/");
                                      if (parts[0] && parts[1]) {
                                        setNewSource({
                                          ...newSource,
                                          repos: [...newSource.repos, { owner: parts[0], repo: parts[1] }],
                                          repoInput: "",
                                        });
                                      }
                                    }
                                  }}
                                  disabled={!newSource.repoInput.includes("/")}
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
                              {newSource.repos.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {newSource.repos.map((r, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-xs font-mono"
                                    >
                                      {r.owner}/{r.repo}
                                      <button
                                        onClick={() => setNewSource({
                                          ...newSource,
                                          repos: newSource.repos.filter((_, idx) => idx !== i),
                                        })}
                                        className="hover:text-destructive ml-0.5"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {newSource.repos.length === 0 && (
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <label className="text-sm font-medium">{t("settings.owner")}</label>
                                  <input
                                    type="text"
                                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                                    placeholder="owner"
                                    value={newSource.owner}
                                    onChange={(e) => setNewSource({ ...newSource, owner: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-sm font-medium">{t("settings.repo")}</label>
                                  <input
                                    type="text"
                                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                                    placeholder="repo"
                                    value={newSource.repo}
                                    onChange={(e) => setNewSource({ ...newSource, repo: e.target.value })}
                                  />
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* GitLab 专属字段 */}
                    {newSource.type === "gitlab" && (
                      <div className="space-y-1.5 pt-2 border-t border-border">
                        <label className="text-sm font-medium">{t("settings.apiUrl")}</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2.5 rounded-lg border border-input bg-background font-mono text-sm"
                          placeholder="https://gitlab.com/api/v4"
                          value={newSource.apiUrl}
                          onChange={(e) => setNewSource({ ...newSource, apiUrl: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">自建 GitLab 实例请填写完整 API 地址，GitLab.com 可留空</p>
                      </div>
                    )}

                    {/* Jira 专属字段 */}
                    {newSource.type === "jira" && (
                      <div className="space-y-4 pt-2 border-t border-border">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium">Jira 实例地址</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background font-mono text-sm"
                            placeholder="https://yourcompany.atlassian.net"
                            value={newSource.jiraBaseUrl}
                            onChange={(e) => setNewSource({ ...newSource, jiraBaseUrl: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">Cloud 版：https://xxx.atlassian.net · Server 版：填写自建地址</p>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium">Atlassian 账号邮箱</label>
                          <input
                            type="email"
                            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm"
                            placeholder="you@company.com"
                            value={newSource.jiraEmail}
                            onChange={(e) => setNewSource({ ...newSource, jiraEmail: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">项目 Key <span className="text-muted-foreground font-normal">(可选)</span></label>
                            <input
                              type="text"
                              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background font-mono text-sm"
                              placeholder="PROJ"
                              value={newSource.jiraProjectKey}
                              onChange={(e) => setNewSource({ ...newSource, jiraProjectKey: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">自定义 JQL <span className="text-muted-foreground font-normal">(可选)</span></label>
                            <input
                              type="text"
                              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background font-mono text-sm"
                              placeholder="assignee=currentUser()"
                              value={newSource.jiraJql}
                              onChange={(e) => setNewSource({ ...newSource, jiraJql: e.target.value })}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          留空则默认查询分配给当前用户的所有 issue。支持完整 JQL 语法。
                        </p>
                      </div>
                    )}

                    {/* Linear 专属字段 */}
                    {newSource.type === "linear" && (
                      <div className="space-y-1.5 pt-2 border-t border-border">
                        <label className="text-sm font-medium">Team ID <span className="text-muted-foreground font-normal">(可选)</span></label>
                        <input
                          type="text"
                          className="w-full px-3 py-2.5 rounded-lg border border-input bg-background font-mono text-sm"
                          placeholder="留空则显示所有团队的 issue"
                          value={newSource.linearTeamId}
                          onChange={(e) => setNewSource({ ...newSource, linearTeamId: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          在 Linear 团队设置页面的 URL 中可找到 Team ID（如 linear.app/team/xxxxxxxxxxxx）
                        </p>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex justify-end gap-2 pt-4 border-t border-border">
                      <Button variant="outline" onClick={() => setShowAddSource(false)}>
                        {t("settings.cancel")}
                      </Button>
                      <Button
                        onClick={handleAddSource}
                        disabled={
                          !newSource.label ||
                          (newSource.type === "github" && !newSource.token) ||
                          (newSource.type === "gitlab" && !newSource.token) ||
                          (newSource.type === "jira" && (!newSource.token || !newSource.jiraEmail || !newSource.jiraBaseUrl)) ||
                          (newSource.type === "linear" && !newSource.token)
                        }
                      >
                        {t("settings.save")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ═══════════════ AI 设置 ═══════════════ */}
          {activeTab === "ai" && (
            <div className="space-y-6 max-w-2xl">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Brain className="w-4.5 h-4.5 text-amber-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">AI 摘要服务</CardTitle>
                      <CardDescription>
                        选择一个 AI 提供商，DevDash 将自动生成开发活动摘要。
                        <span className="text-amber-500/80"> 此功能完全可选，不配置不影响其他功能。</span>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 启用开关 */}
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${settings?.ai?.enabled ? 'bg-green-500/10' : 'bg-muted'}`}>
                        <Bot className={`w-5 h-5 ${settings?.ai?.enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">启用 AI 摘要</p>
                        <p className="text-xs text-muted-foreground">
                          {settings?.ai?.enabled ? 'AI 摘要已启用，点击刷新按钮生成摘要' : '启用后可在仪表盘查看 AI 生成的开发摘要'}
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings?.ai?.enabled || false}
                        onChange={(e) =>
                          updateSettings({
                            ai: { ...settings?.ai!, enabled: e.target.checked },
                          })
                        }
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                    </label>
                  </div>

                  {/* Provider 选择卡片 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">选择提供商</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {AI_PROVIDERS.map((provider) => {
                        const Icon = provider.icon;
                        const isActive = settings?.ai?.provider === provider.id;
                        return (
                          <button
                            key={provider.id}
                            onClick={() =>
                              updateSettings({
                                ai: {
                                  ...settings?.ai!,
                                  provider: provider.id,
                                  baseUrl: provider.defaultUrl || settings?.ai?.baseUrl || "",
                                  model: provider.defaultModel || settings?.ai?.model || "",
                                },
                              })
                            }
                            className={`relative flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                              isActive
                                ? `${provider.borderColor} ${provider.bgColor} shadow-sm`
                                : "border-border hover:bg-muted/50"
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isActive ? provider.bgColor : "bg-muted"}`}>
                              <Icon className={`w-5 h-5 ${isActive ? provider.color : "text-muted-foreground"}`} />
                            </div>
                            <div className="min-w-0">
                              <p className={`text-sm font-medium ${isActive ? "text-foreground" : ""}`}>
                                {t(provider.labelKey)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                {provider.description}
                              </p>
                            </div>
                            {isActive && (
                              <Check className={`w-5 h-5 absolute top-3 right-3 ${provider.color} shrink-0`} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 分隔线 + 配置区域 */}
                  <div className="space-y-4 pt-4 border-t border-border">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Bot className="w-4 h-4" /> 连接配置
                    </p>

                    {/* Base URL */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium flex items-center gap-1.5">
                        Base URL
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2.5 rounded-lg border border-input bg-background font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        placeholder={currentProvider.urlPlaceholder}
                        value={settings?.ai?.baseUrl || ""}
                        onChange={(e) =>
                          updateSettings({
                            ai: { ...settings?.ai!, baseUrl: e.target.value },
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {currentProvider.id === "ollama" && (
                          <span>Ollama 默认运行在本地 11434 端口。<a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-0.5">安装 Ollama <ExternalLink className="w-3 h-3" /></a></span>
                        )}
                        {currentProvider.id === "openai" && (
                          <span>OpenAI 官方 API 地址，一般无需修改。</span>
                        )}
                        {currentProvider.id === "claude" && (
                          <span>Anthropic Claude API 地址。</span>
                        )}
                        {currentProvider.id === "gemini" && (
                          <span>Google Generative AI API 地址。</span>
                        )}
                        {currentProvider.id === "openai_compat" && (
                          <span>填写兼容 OpenAI 格式的 API 端点地址。</span>
                        )}
                      </p>
                    </div>

                    {/* API Key (非 Ollama) */}
                    {settings?.ai?.provider !== "ollama" && (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5" />
                          API Key
                        </label>
                        <input
                          type="password"
                          className="w-full px-3 py-2.5 rounded-lg border border-input bg-background font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                          placeholder={
                            currentProvider.id === "openai" ? "sk-proj-..." :
                            currentProvider.id === "claude" ? "sk-ant-..." :
                            currentProvider.id === "gemini" ? "AIza..." :
                            "your-api-key"
                          }
                          value={settings?.ai?.apiKey || ""}
                          onChange={(e) =>
                            updateSettings({
                              ai: { ...settings?.ai!, apiKey: e.target.value },
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          {currentProvider.docUrl && (
                            <>
                              在{' '}
                              <a href={currentProvider.docUrl} target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
                                官方控制台 <ExternalLink className="w-3 h-3" />
                              </a>
                              {' '}获取 API Key。仅本地加密存储。
                            </>
                          )}
                        </p>
                      </div>
                    )}

                    {/* Model */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">模型名称</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2.5 rounded-lg border border-input bg-background font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        placeholder={currentProvider.modelPlaceholder}
                        value={settings?.ai?.model || ""}
                        onChange={(e) =>
                          updateSettings({
                            ai: { ...settings?.ai!, model: e.target.value },
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {currentProvider.id === "ollama" && (
                          <>先通过 <code className="px-1 py-0.5 rounded bg-muted text-[11px]">ollama pull llama3</code> 下载模型</>
                        )}
                        {currentProvider.id === "openai" && (
                          <span>推荐 gpt-4o（最佳效果）或 gpt-4o-mini（性价比高）</span>
                        )}
                        {currentProvider.id === "claude" && (
                          <span>推荐 claude-3-5-sonnet-20241022</span>
                        )}
                        {currentProvider.id === "gemini" && (
                          <span>推荐 gemini-1.5-pro（深度分析）或 gemini-1.5-flash（快速响应）</span>
                        )}
                      </p>
                    </div>

                    {/* 测试按钮 */}
                    <div className="flex items-center gap-4 pt-2">
                      <Button onClick={handleTestAi} disabled={testingAi} className="gap-2">
                        {testingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {t("ai.test")} 连接
                      </Button>
                      {aiTestResult === "success" && (
                        <span className="inline-flex items-center gap-1.5 text-sm text-green-500 bg-green-500/10 px-3 py-1.5 rounded-lg">
                          <Check className="w-4 h-4" />
                          {t("ai.testSuccess")} — 连接正常
                        </span>
                      )}
                      {aiTestResult === "failed" && (
                        <span className="inline-flex items-center gap-1.5 text-sm text-red-500 bg-red-500/10 px-3 py-1.5 rounded-lg">
                          <X className="w-4 h-4" />
                          {t("ai.testFailed")} — 请检查配置
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════════════ 关于 ═══════════════ */}
          {activeTab === "about" && (
            <div className="space-y-6 max-w-2xl">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg">
                      <Bot className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">DevDash</CardTitle>
                      <CardDescription className="text-base mt-1">
                        {language === "zh"
                          ? "开发者个人仪表盘 — 你的每日开发活动一览"
                          : "Developer Dashboard — Your daily dev activity at a glance"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {language === "zh"
                      ? "DevDash 是一款轻量级桌面应用，聚合你的 GitHub/GitLab/Jira/Linear 数据，用 AI 生成每日开发摘要。基于 Tauri v2 构建，内存占用仅为 Electron 的十分之一。"
                      : "DevDash is a lightweight desktop app that aggregates your GitHub/GitLab/Jira/Linear data and generates daily AI summaries. Built with Tauri v2, using 10× less memory than Electron."
                    }
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 py-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">版本</p>
                      <p className="text-sm font-medium font-mono">v0.1.0</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">技术栈</p>
                      <p className="text-sm font-medium">Tauri v2 + React 19 + Rust</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">协议</p>
                      <p className="text-sm font-medium">MIT License</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">存储</p>
                      <p className="text-sm font-medium">AES-256 本地加密</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <a
                      href="https://github.com/devdash/devdash"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <GitBranch className="w-4 h-4" />
                      GitHub - Star & Contributing
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
