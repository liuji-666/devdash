import React from "react";
import {
  CircleDot,
  Clock,
  CheckCircle2,
  AlertCircle,
  ListTodo,
} from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import { Badge } from "../ui/badge";
import { timeAgo } from "../../lib/utils";
import type { Widget, DataItem } from "../../types";

// ─── Status icon for task items ────────────────────────────────────────────
function TaskStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "todo":
      return <CircleDot className="w-3.5 h-3.5 text-gray-400" />;
    case "in_progress":
      return <Clock className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />;
    case "done":
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
    case "cancelled":
      return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
    default:
      return <CircleDot className="w-3.5 h-3.5 text-gray-400" />;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "todo": return "待办";
    case "in_progress": return "进行中";
    case "done": return "已完成";
    case "cancelled": return "已取消";
    default: return status;
  }
}

function statusVariant(status: string): "success" | "secondary" | "destructive" | "default" {
  switch (status) {
    case "todo": return "secondary";
    case "in_progress": return "default";
    case "done": return "success";
    case "cancelled": return "destructive";
    default: return "secondary";
  }
}

// ─── Tracker badge ─────────────────────────────────────────────────────────
function TrackerBadge({ tracker }: { tracker: string }) {
  const colors: Record<string, string> = {
    jira: "bg-blue-500/20 text-blue-400",
    linear: "bg-purple-500/20 text-purple-400",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold rounded ${
        colors[tracker] || "bg-gray-500/20 text-gray-400"
      }`}
    >
      {tracker === "jira" ? "JIRA" : tracker === "linear" ? "LINEAR" : tracker.toUpperCase()}
    </span>
  );
}

// ─── Priority badge ────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  if (!priority || priority === "None" || priority === "No priority") return null;
  const colors: Record<string, string> = {
    Urgent: "text-red-400",
    High: "text-orange-400",
    Medium: "text-yellow-400",
    Low: "text-green-400",
  };
  const icons: Record<string, string> = {
    Urgent: "🔴",
    High: "🟠",
    Medium: "🟡",
    Low: "🟢",
  };
  return (
    <span className={`text-[10px] ${colors[priority] || "text-gray-400"}`}>
      {icons[priority] || "⚪"} {priority}
    </span>
  );
}

// ─── SprintBoardWidget ─────────────────────────────────────────────────────

interface SprintBoardWidgetProps {
  widget: Widget;
  items: DataItem[];
  error?: string;
  isLoading?: boolean;
  onRemove: () => void;
  onRefresh?: () => void;
  dragHandle?: React.ReactNode;
}

export function SprintBoardWidget({
  widget,
  items,
  error,
  isLoading,
  onRemove,
  onRefresh,
  dragHandle,
}: SprintBoardWidgetProps) {
  const tasks = items.filter((i) => i.kind === "task").slice(0, 15);

  // Group by status
  const grouped = {
    todo: tasks.filter((t) => t.status === "todo"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    done: tasks.filter((t) => t.status === "done"),
  };

  const totalTasks = tasks.length;
  const doneCount = grouped.done.length;
  const progress = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  return (
    <WidgetCard
      widget={widget}
      title="任务看板"
      icon={<ListTodo className="w-4 h-4" />}
      badge={totalTasks > 0 ? `${doneCount}/${totalTasks}` : undefined}
      badgeVariant={progress >= 80 ? "success" : "default"}
      isLoading={isLoading}
      error={error}
      onRemove={onRemove}
      onRefresh={onRefresh}
      dragHandle={dragHandle}
      className="[grid-column:span_2]"
    >
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-[var(--color-muted-foreground)] py-8 text-sm">
          <ListTodo className="w-8 h-8 mb-2 opacity-30" />
          暂无任务数据<br />
          <span className="text-xs">在设置中配置 Jira 或 Linear 数据源</span>
        </div>
      ) : (
        <div className="p-4">
          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[var(--color-muted-foreground)]">完成进度</span>
              <span className="text-[10px] text-[var(--color-muted-foreground)]">{progress}%</span>
            </div>
            <div className="h-1.5 bg-[var(--color-accent)] rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Mini kanban columns */}
          <div className="grid grid-cols-3 gap-3">
            {/* Todo */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <CircleDot className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] font-semibold text-[var(--color-muted-foreground)]">待办</span>
                <span className="text-[10px] text-[var(--color-muted-foreground)]">({grouped.todo.length})</span>
              </div>
              <div className="space-y-1.5">
                {grouped.todo.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>

            {/* In Progress */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="w-3 h-3 text-yellow-400" />
                <span className="text-[10px] font-semibold text-[var(--color-muted-foreground)]">进行中</span>
                <span className="text-[10px] text-[var(--color-muted-foreground)]">({grouped.in_progress.length})</span>
              </div>
              <div className="space-y-1.5">
                {grouped.in_progress.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>

            {/* Done */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="w-3 h-3 text-green-400" />
                <span className="text-[10px] font-semibold text-[var(--color-muted-foreground)]">完成</span>
                <span className="text-[10px] text-[var(--color-muted-foreground)]">({grouped.done.length})</span>
              </div>
              <div className="space-y-1.5">
                {grouped.done.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}

// ─── Task Card ──────────────────────────────────────────────────────────────

function TaskCard({ task }: { task: DataItem }) {
  const tracker = (task.metadata?.tracker as string) || "";
  const priority = (task.metadata?.priority as string) || "";
  const identifier = (task.metadata?.identifier as string) || (task.metadata?.key as string) || task.externalId;

  return (
    <a
      href={task.url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-2 rounded-lg bg-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/50 transition-colors"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <TrackerBadge tracker={tracker} />
        <span className="text-[10px] font-mono text-[var(--color-muted-foreground)]">{identifier}</span>
      </div>
      <p className="text-xs font-medium truncate">{task.title}</p>
      {priority && (
        <div className="mt-1">
          <PriorityBadge priority={priority} />
        </div>
      )}
    </a>
  );
}
