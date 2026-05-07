import React from "react";
import { GitPullRequest, Bug, GitMerge, CheckCircle2, AlertCircle, Clock, TrendingUp } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import type { Widget, DataItem } from "../../types";

interface TodayOverviewWidgetProps {
  widget: Widget;
  items: DataItem[];
  error?: string;
  isLoading?: boolean;
  onRemove: () => void;
  onRefresh?: () => void;
  dragHandle?: React.ReactNode;
}

export function TodayOverviewWidget({ widget, items, error, isLoading, onRemove, onRefresh, dragHandle }: TodayOverviewWidgetProps) {
  // Calculate stats from all items
  const prs = items.filter((i) => i.kind === "pull_request");
  const issues = items.filter((i) => i.kind === "issue");
  const ciRuns = items.filter((i) => i.kind === "ci_run" || i.kind === "pipeline");
  const notifications = items.filter((i) => i.kind === "notification");

  const openPRs = prs.filter((p) => p.status === "open").length;
  const mergedPRs = prs.filter((p) => p.status === "merged").length;
  const openIssues = issues.filter((i) => i.status === "open").length;
  const failedCI = ciRuns.filter((c) => c.status === "failure").length;
  const runningCI = ciRuns.filter((c) => c.status === "running").length;
  const unreadNotifs = notifications.filter((n) => n.status === "unread").length;

  const stats = [
    {
      label: "待审查 PR",
      value: openPRs,
      icon: <GitPullRequest className="w-4 h-4 text-orange-400" />,
      color: "text-orange-400",
      bgColor: "bg-orange-400/10",
    },
    {
      label: "已合并 PR",
      value: mergedPRs,
      icon: <GitMerge className="w-4 h-4 text-purple-400" />,
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
    },
    {
      label: "待处理 Issue",
      value: openIssues,
      icon: <Bug className="w-4 h-4 text-green-400" />,
      color: "text-green-400",
      bgColor: "bg-green-400/10",
    },
    {
      label: "CI 失败",
      value: failedCI,
      icon: <AlertCircle className="w-4 h-4 text-red-400" />,
      color: "text-red-400",
      bgColor: "bg-red-400/10",
      alert: failedCI > 0,
    },
    {
      label: "CI 运行中",
      value: runningCI,
      icon: <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />,
      color: "text-yellow-400",
      bgColor: "bg-yellow-400/10",
    },
    {
      label: "未读通知",
      value: unreadNotifs,
      icon: <CheckCircle2 className="w-4 h-4 text-blue-400" />,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
    },
  ];

  const totalActivity = items.length;

  return (
    <WidgetCard
      widget={widget}
      title="今日概览"
      icon={<TrendingUp className="w-4 h-4" />}
      badge={totalActivity > 0 ? `${totalActivity} 条活动` : undefined}
      isLoading={isLoading}
      error={error}
      onRemove={onRemove}
      onRefresh={onRefresh}
      dragHandle={dragHandle}
      className="[grid-column:span_2]"
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-[var(--color-muted-foreground)] py-8 text-sm animate-in fade-in duration-500">
          <div className="w-16 h-16 rounded-full bg-[var(--color-accent)]/50 flex items-center justify-center mb-3">
            <TrendingUp className="w-8 h-8 opacity-40" />
          </div>
          <p className="font-medium">暂无今日活动数据</p>
          <p className="text-xs mt-1 opacity-70 max-w-[240px] text-center">
            配置数据源并刷新后将显示今日开发统计
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("navigate-to-settings"))}
            className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline"
          >
            前往设置 →
          </button>
        </div>
      ) : (
        <div className="p-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className={`relative p-3 rounded-lg border transition-all duration-200 ${
                  stat.alert
                    ? "border-red-400/30 bg-red-400/5"
                    : "border-[var(--color-border)] bg-[var(--color-card)]/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-md ${stat.bgColor}`}>
                    {stat.icon}
                  </div>
                  {stat.alert && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  )}
                </div>
                <div className={`text-2xl font-bold ${stat.color}`}>
                  {stat.value}
                </div>
                <div className="text-[10px] text-[var(--color-muted-foreground)] mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Quick summary */}
          <div className="mt-4 p-3 rounded-lg bg-[var(--color-accent)]/30 border border-[var(--color-border)]">
            <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>
                {failedCI > 0 ? (
                  <span className="text-red-400 font-medium">
                    ⚠️ 有 {failedCI} 个 CI 构建失败，需要关注
                  </span>
                ) : openPRs > 0 ? (
                  <span>
                    有 {openPRs} 个 PR 待审查，{openIssues} 个 Issue 待处理
                  </span>
                ) : (
                  <span>今日暂无紧急事项，保持高效！</span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
