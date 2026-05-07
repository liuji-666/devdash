import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  GitPullRequest,
  CircleDot,
  BotMessageSquare,
  Bug,
  Calendar,
  Bell,
  ListTodo,
  Check,
  TrendingUp,
} from "lucide-react";
import type { WidgetType } from "../../types";

const WIDGET_OPTIONS: Array<{
  type: WidgetType;
  name: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  tags: string[];
}> = [
  {
    type: "pr_list",
    name: "Pull Requests",
    description: "显示 GitHub / GitLab 的 PR 列表，实时状态跟踪",
    icon: <GitPullRequest className="w-5 h-5" />,
    iconBg: "bg-green-500/10 text-green-400",
    tags: ["GitHub", "GitLab"],
  },
  {
    type: "ci_status",
    name: "CI/CD 状态",
    description: "GitHub Actions / GitLab CI 流水线状态一览",
    icon: <CircleDot className="w-5 h-5" />,
    iconBg: "bg-blue-500/10 text-blue-400",
    tags: ["CI/CD"],
  },
  {
    type: "ai_summary",
    name: "AI 今日摘要",
    description: "连接本地 Ollama 或云端 AI，自动生成开发摘要",
    icon: <BotMessageSquare className="w-5 h-5" />,
    iconBg: "bg-purple-500/10 text-purple-400",
    tags: ["AI"],
  },
  {
    type: "issue_list",
    name: "Issues",
    description: "显示 GitHub 仓库的 Issue 列表，状态跟踪",
    icon: <Bug className="w-5 h-5" />,
    iconBg: "bg-orange-500/10 text-orange-400",
    tags: ["GitHub"],
  },
  {
    type: "activity_calendar",
    name: "贡献热力图",
    description: "GitHub 风格的贡献日历，一目了然全年活跃度",
    icon: <Calendar className="w-5 h-5" />,
    iconBg: "bg-emerald-500/10 text-emerald-400",
    tags: ["GitHub", "可视化"],
  },
  {
    type: "notification_feed",
    name: "通知",
    description: "GitHub 通知流，未读提醒 + 桌面推送",
    icon: <Bell className="w-5 h-5" />,
    iconBg: "bg-yellow-500/10 text-yellow-400",
    tags: ["GitHub", "通知"],
  },
  {
    type: "sprint_board",
    name: "任务看板",
    description: "Jira / Linear 任务聚合，三列看板 + 进度追踪",
    icon: <ListTodo className="w-5 h-5" />,
    iconBg: "bg-indigo-500/10 text-indigo-400",
    tags: ["Jira", "Linear", "看板"],
  },
  {
    type: "today_overview",
    name: "今日概览",
    description: "汇总今日所有开发活动：PR、Issue、CI、通知统计",
    icon: <TrendingUp className="w-5 h-5" />,
    iconBg: "bg-pink-500/10 text-pink-400",
    tags: ["汇总", "统计"],
  },
];

interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (widgetType: WidgetType, sourceId?: string) => void;
  sourceOptions: Array<{ id: string; label: string; type: string }>;
}

export function AddWidgetDialog({
  open,
  onOpenChange,
  onAdd,
  sourceOptions,
}: AddWidgetDialogProps) {
  const [selected, setSelected] = React.useState<WidgetType | null>(null);
  const [selectedSource, setSelectedSource] = React.useState("");

  const handleAdd = () => {
    if (!selected) return;
    onAdd(selected, selectedSource || undefined);
    setSelected(null);
    setSelectedSource("");
    onOpenChange(false);
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setSelected(null);
      setSelectedSource("");
    }
    onOpenChange(val);
  };

  const needsSource = selected && selected !== "ai_summary" && selected !== "activity_calendar" && selected !== "today_overview";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[var(--color-border)]">
          <DialogTitle className="text-base font-semibold">添加组件</DialogTitle>
          <DialogDescription className="text-xs mt-1">
            从组件库中选择要添加到当前工作台的部件
          </DialogDescription>
        </div>

        {/* Widget options */}
        <div className="px-6 py-4 space-y-2 max-h-[360px] overflow-y-auto">
          {WIDGET_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              onClick={() => setSelected(opt.type)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selected === opt.type
                  ? "border-[var(--color-ring)] bg-[var(--color-accent)] shadow-sm"
                  : "border-[var(--color-border)] hover:border-[var(--color-muted-foreground)]"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${opt.iconBg}`}>
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{opt.name}</span>
                  {selected === opt.type && (
                    <Check className="w-3.5 h-3.5 text-[var(--color-ring)]" />
                  )}
                </div>
                <div className="text-xs text-[var(--color-muted-foreground)] mt-0.5 leading-relaxed">
                  {opt.description}
                </div>
                <div className="flex gap-1 mt-2">
                  {opt.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-[9px] px-1.5 py-0">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Source selector */}
        {needsSource && (
          <div className="px-6 pb-4">
            <label className="text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5 block">
              数据源
            </label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full h-9 rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] px-3 text-sm"
            >
              <option value="">自动选择首个可用</option>
              {sourceOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} ({s.type})
                </option>
              ))}
            </select>
            {sourceOptions.length === 0 && (
              <p className="text-xs text-[var(--color-muted-foreground)] mt-1.5 flex items-center gap-1">
                <span className="text-yellow-400">⚠️</span>
                暂无数据源，请在「设置 → 数据源」中添加
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleClose(false)}>
            取消
          </Button>
          <Button onClick={handleAdd} disabled={!selected}>
            添加
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
