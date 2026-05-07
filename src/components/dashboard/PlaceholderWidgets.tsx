import React from "react";
import { GitPullRequest, CircleDot, GitMerge, AlertCircle, CheckCircle2, Clock, ExternalLink, MessageSquare, Bug } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import { Badge } from "../ui/badge";
import { cn, timeAgo } from "../../lib/utils";
import type { Widget, DataItem } from "../../types";
import { generateAiSummary } from "../../lib/api";
import { PRActionsMenu } from "./PRActionsMenu";
import { useTranslation } from "../../lib/i18n";
import { SimpleVirtualList } from "../ui/virtual-list";

// ---- 辅助 ----
function PRStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "open": return <GitPullRequest className="w-3.5 h-3.5 text-green-400" />;
    case "merged": return <GitMerge className="w-3.5 h-3.5 text-purple-400" />;
    case "draft": return <GitPullRequest className="w-3.5 h-3.5 text-gray-400" />;
    default: return <CircleDot className="w-3.5 h-3.5 text-gray-400" />;
  }
}

function CIStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "success": return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
    case "failure": return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
    case "running": return <Clock className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />;
    default: return <CircleDot className="w-3.5 h-3.5 text-gray-400" />;
  }
}

// ---- PR 列表 Widget ----
interface PRListWidgetProps {
  widget: Widget;
  items: DataItem[];
  error?: string;
  isLoading?: boolean;
  onRemove: () => void;
  onRefresh?: () => void;
  dragHandle?: React.ReactNode;
}

export function PRListWidget({ widget, items, error, isLoading, onRemove, onRefresh, dragHandle }: PRListWidgetProps) {
  const prs = items.filter((i) => i.kind === "pull_request").slice(0, 8);

  // Helper to parse owner/repo from metadata
  const parseRepo = (pr: DataItem): { owner: string; repo: string; number: number } => {
    const repoFull = (pr.metadata?.repo as string) || "";
    const parts = repoFull.split("/");
    const owner = parts[0] || "";
    const repo = parts[1] || "";
    const number = parseInt(pr.externalId, 10) || 0;
    return { owner, repo, number };
  };

  return (
    <WidgetCard
      widget={widget}
      title="Pull Requests"
      icon={<GitPullRequest className="w-4 h-4" />}
      badge={`${prs.length} 个`}
      isLoading={isLoading}
      onRemove={onRemove}
      onRefresh={onRefresh}
      error={error}
      lastUpdated={prs[0] ? timeAgo(prs[0].fetchedAt) : undefined}
      dragHandle={dragHandle}
    >
      {prs.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center h-full text-[var(--color-muted-foreground)] py-8 text-sm animate-in fade-in duration-500">
          <div className="w-16 h-16 rounded-full bg-[var(--color-accent)]/50 flex items-center justify-center mb-3">
            <GitPullRequest className="w-8 h-8 opacity-40" />
          </div>
          <p className="font-medium">暂无 PR 数据</p>
          <p className="text-xs mt-1 opacity-70 max-w-[200px] text-center">
            尝试在设置中配置 GitHub Token 或切换数据源
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("navigate-to-settings"))}
            className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline"
          >
            前往设置 →
          </button>
        </div>
      ) : prs.length > 20 ? (
        <SimpleVirtualList
          items={prs}
          itemHeight={72}
          height={320}
          renderItem={(pr) => {
            const { owner, repo, number } = parseRepo(pr);
            const hasRepo = owner && repo && number > 0;
            return (
              <div className="group flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-accent)]/30 transition-colors border-b border-[var(--color-border)]">
                <div className="mt-0.5">
                  <PRStatusIcon status={pr.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <a
                      href={pr.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline truncate"
                    >
                      {pr.title}
                    </a>
                    {hasRepo && (
                      <PRActionsMenu
                        owner={owner}
                        repo={repo}
                        prNumber={number}
                        status={pr.status}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={pr.status === "open" ? "success" : pr.status === "draft" ? "secondary" : "default"} className="text-[10px]">
                      {pr.status}
                    </Badge>
                    <span className="text-[10px] text-[var(--color-muted-foreground)]">{pr.author}</span>
                    <span className="text-[10px] text-[var(--color-muted-foreground)]">{timeAgo(pr.fetchedAt)}</span>
                  </div>
                </div>
              </div>
            );
          }}
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {prs.map((pr) => {
            const { owner, repo, number } = parseRepo(pr);
            const hasRepo = owner && repo && number > 0;
            return (
              <li key={pr.id} className="group flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-accent)]/30 transition-colors">
                <div className="mt-0.5">
                  <PRStatusIcon status={pr.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <a
                      href={pr.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline truncate"
                    >
                      {pr.title}
                    </a>
                    {hasRepo && (
                      <PRActionsMenu
                        owner={owner}
                        repo={repo}
                        prNumber={number}
                        status={pr.status}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={pr.status === "open" ? "success" : pr.status === "draft" ? "secondary" : "default"} className="text-[10px]">
                      {pr.status}
                    </Badge>
                    <span className="text-[10px] text-[var(--color-muted-foreground)]">{pr.author}</span>
                    <span className="text-[10px] text-[var(--color-muted-foreground)]">{timeAgo(pr.fetchedAt)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}

// ---- CI 状态 Widget ----
interface CIStatusWidgetProps {
  widget: Widget;
  items: DataItem[];
  error?: string;
  isLoading?: boolean;
  onRemove: () => void;
  onRefresh?: () => void;
  dragHandle?: React.ReactNode;
}

export function CIStatusWidget({ widget, items, error, isLoading, onRemove, onRefresh, dragHandle }: CIStatusWidgetProps) {
  const runs = items.filter((i) => i.kind === "ci_run" || i.kind === "pipeline").slice(0, 10);
  const failed = runs.filter((r) => r.status === "failure").length;

  return (
    <WidgetCard
      widget={widget}
      title="CI/CD 状态"
      icon={<CircleDot className="w-4 h-4" />}
      badge={failed > 0 ? `${failed} 失败` : undefined}
      badgeVariant={failed > 0 ? "destructive" : "success"}
      isLoading={isLoading}
      onRemove={onRemove}
      onRefresh={onRefresh}
      error={error}
      dragHandle={dragHandle}
    >
      {runs.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center h-full text-[var(--color-muted-foreground)] py-8 text-sm animate-in fade-in duration-500">
          <div className="w-16 h-16 rounded-full bg-[var(--color-accent)]/50 flex items-center justify-center mb-3">
            <CircleDot className="w-8 h-8 opacity-40" />
          </div>
          <p className="font-medium">暂无构建记录</p>
          <p className="text-xs mt-1 opacity-70 max-w-[200px] text-center">
            CI 数据来自 GitHub Actions，确保仓库有 workflow 配置
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("navigate-to-settings"))}
            className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline"
          >
            检查数据源配置 →
          </button>
        </div>
      ) : runs.length > 20 ? (
        <SimpleVirtualList
          items={runs}
          itemHeight={40}
          height={280}
          renderItem={(run) => (
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-border)]">
              <CIStatusIcon status={run.status} />
              <span className="flex-1 text-sm truncate">{run.title}</span>
              <span className="text-[10px] text-[var(--color-muted-foreground)]">{timeAgo(run.fetchedAt)}</span>
            </div>
          )}
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {runs.map((run) => (
            <li key={run.id} className="flex items-center gap-3 px-4 py-2.5">
              <CIStatusIcon status={run.status} />
              <span className="flex-1 text-sm truncate">{run.title}</span>
              <span className="text-[10px] text-[var(--color-muted-foreground)]">{timeAgo(run.fetchedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

// ---- AI 摘要 Widget ----
interface AISummaryWidgetProps {
  widget: Widget;
  summary?: string;
  error?: string;
  isLoading?: boolean;
  onRemove: () => void;
  onRefresh?: () => void;
  dragHandle?: React.ReactNode;
}

export function AISummaryWidget({ widget, summary: propSummary, error: externalError, isLoading, onRemove, dragHandle }: AISummaryWidgetProps) {
  const [localSummary, setLocalSummary] = React.useState(propSummary ?? "");
  const [fetching, setFetching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = React.useState<boolean>(false);
  const [aiStatusLoading, setAiStatusLoading] = React.useState(true);

  // Check AI enabled status on mount
  React.useEffect(() => {
    const checkAiStatus = async () => {
      try {
        const { useSettingsStore } = await import("../../stores/settingsStore");
        const settings = useSettingsStore.getState().settings;
        setAiEnabled(settings?.ai?.enabled ?? false);
      } catch {
        setAiEnabled(false);
      } finally {
        setAiStatusLoading(false);
      }
    };
    checkAiStatus();
  }, []);

  const handleFetch = async () => {
    setFetching(true);
    setError(null);
    try {
      const result = await generateAiSummary();
      setLocalSummary(result);
    } catch (e: any) {
      setError(e?.toString() ?? "请求失败");
    } finally {
      setFetching(false);
    }
  };
  return (
    <WidgetCard
      widget={widget}
      title="AI 今日摘要"
      icon={<MessageSquare className="w-4 h-4" />}
      badge="AI"
      badgeVariant="secondary"
      isLoading={fetching}
      onRemove={onRemove}
      onRefresh={handleFetch}
      dragHandle={dragHandle}
      className="[grid-column:span_2]"
    >
      <div className="p-4 text-sm leading-relaxed">
        {(error ?? externalError) ? (
          <div className="text-red-400">
            <p className="mb-2">⚠️ {error ?? externalError}</p>
            <button
              onClick={handleFetch}
              className="text-xs underline cursor-pointer hover:text-red-300"
            >
              重试
            </button>
          </div>
        ) : localSummary ? (
          <div className="whitespace-pre-wrap text-[var(--color-muted-foreground)]">
            {localSummary}
          </div>
        ) : aiStatusLoading ? (
          <div className="text-[var(--color-muted-foreground)] text-center py-8">
            <div className="w-16 h-16 rounded-full bg-[var(--color-accent)]/50 flex items-center justify-center mb-3 mx-auto animate-pulse">
              <MessageSquare className="w-8 h-8 opacity-40" />
            </div>
            <p className="font-medium">正在检查 AI 配置...</p>
          </div>
        ) : aiEnabled === false ? (
          <div className="text-[var(--color-muted-foreground)] text-center py-8 animate-in fade-in duration-500">
            <div className="w-16 h-16 rounded-full bg-[var(--color-accent)]/50 flex items-center justify-center mb-3 mx-auto">
              <MessageSquare className="w-8 h-8 opacity-40" />
            </div>
            <p className="font-medium">AI 摘要未启用</p>
            <p className="text-xs mt-1 opacity-70 max-w-[240px] mx-auto">
              请在设置中启用 AI 摘要功能
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("navigate-to-settings"))}
              className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline"
            >
              前往设置启用 →
            </button>
          </div>
        ) : (
          <div className="text-[var(--color-muted-foreground)] text-center py-8 animate-in fade-in duration-500">
            <div className="w-16 h-16 rounded-full bg-[var(--color-accent)]/50 flex items-center justify-center mb-3 mx-auto">
              <MessageSquare className="w-8 h-8 opacity-40" />
            </div>
            <p className="font-medium">点击刷新按钮生成今日开发摘要</p>
            <p className="text-xs mt-1 opacity-70 max-w-[240px] mx-auto">
              需要配置 AI Provider（Ollama/OpenAI/Claude）
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("navigate-to-settings"))}
              className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline"
            >
              配置 AI 设置 →
            </button>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}

// ---- Issue 列表 Widget ----
interface IssueListWidgetProps {
  widget: Widget;
  items: DataItem[];
  error?: string;
  isLoading?: boolean;
  onRemove: () => void;
  onRefresh?: () => void;
  dragHandle?: React.ReactNode;
}

function IssueStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "open": return <Bug className="w-3.5 h-3.5 text-green-400" />;
    case "closed": return <Bug className="w-3.5 h-3.5 text-gray-400" />;
    default: return <CircleDot className="w-3.5 h-3.5 text-gray-400" />;
  }
}

export function IssueListWidget({ widget, items, error, isLoading, onRemove, onRefresh, dragHandle }: IssueListWidgetProps) {
  const issues = items.filter((i) => i.kind === "issue").slice(0, 8);

  return (
    <WidgetCard
      widget={widget}
      title="Issues"
      icon={<Bug className="w-4 h-4" />}
      badge={`${issues.length} 个`}
      isLoading={isLoading}
      onRemove={onRemove}
      onRefresh={onRefresh}
      error={error}
      lastUpdated={issues[0] ? timeAgo(issues[0].fetchedAt) : undefined}
      dragHandle={dragHandle}
    >
      {issues.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center h-full text-[var(--color-muted-foreground)] py-8 text-sm animate-in fade-in duration-500">
          <div className="w-16 h-16 rounded-full bg-[var(--color-accent)]/50 flex items-center justify-center mb-3">
            <Bug className="w-8 h-8 opacity-40" />
          </div>
          <p className="font-medium">暂无 Issue 数据</p>
          <p className="text-xs mt-1 opacity-70 max-w-[200px] text-center">
            搜索分配给你或提及你的 Issue
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("navigate-to-settings"))}
            className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline"
          >
            检查 GitHub 配置 →
          </button>
        </div>
      ) : issues.length > 20 ? (
        <SimpleVirtualList
          items={issues}
          itemHeight={64}
          height={320}
          renderItem={(issue) => (
            <div className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-accent)]/30 transition-colors border-b border-[var(--color-border)]">
              <div className="mt-0.5">
                <IssueStatusIcon status={issue.status} />
              </div>
              <div className="flex-1 min-w-0">
                <a
                  href={issue.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline truncate block"
                >
                  {issue.title}
                </a>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={issue.status === "open" ? "success" : "secondary"} className="text-[10px]">
                    {issue.status}
                  </Badge>
                  <span className="text-[10px] text-[var(--color-muted-foreground)]">{issue.author}</span>
                  <span className="text-[10px] text-[var(--color-muted-foreground)]">{timeAgo(issue.fetchedAt)}</span>
                </div>
              </div>
            </div>
          )}
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {issues.map((issue) => (
            <li key={issue.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-accent)]/30 transition-colors">
              <div className="mt-0.5">
                <IssueStatusIcon status={issue.status} />
              </div>
              <div className="flex-1 min-w-0">
                <a
                  href={issue.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline truncate block"
                >
                  {issue.title}
                </a>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={issue.status === "open" ? "success" : "secondary"} className="text-[10px]">
                    {issue.status}
                  </Badge>
                  <span className="text-[10px] text-[var(--color-muted-foreground)]">{issue.author}</span>
                  <span className="text-[10px] text-[var(--color-muted-foreground)]">{timeAgo(issue.fetchedAt)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

// ---- 空状态 Widget ----
interface EmptyWidgetProps {
  widget: Widget;
  onRemove: () => void;
}

export function EmptyWidget({ widget, onRemove }: EmptyWidgetProps) {
  return (
    <WidgetCard widget={widget} title="Widget" onRemove={onRemove}>
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-muted-foreground)] py-8 text-sm animate-in fade-in duration-500">
        <div className="w-16 h-16 rounded-full bg-[var(--color-accent)]/50 flex items-center justify-center mb-3">
          <CircleDot className="w-8 h-8 opacity-40" />
        </div>
        <p className="font-medium">暂无数据</p>
        <p className="text-xs mt-1 opacity-70">配置数据源后自动显示</p>
      </div>
    </WidgetCard>
  );
}
