// -*- coding: utf-8 -*-
import React, { useEffect, useState, useCallback } from "react";
import {
  Bell,
  BellOff,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  GitPullRequest,
  Bug,
  MessageSquare,
  Star,
} from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import { Badge } from "../ui/badge";
import { cn, timeAgo } from "../../lib/utils";
import type { Widget, DataItem } from "../../types";
import { apiGetDataItems } from "../../lib/api";
import { useTranslation } from "../../lib/i18n";

// ─── Notification reason → Chinese label ────────────────────────────────────

const REASON_LABELS: Record<string, string> = {
  assign: "指派给你",
  author: "你创建的",
  comment: "有人评论",
  invitation: "邀请你",
  manual: "手动订阅",
  mention: "@提及你",
  review_requested: "请求你审查",
  security_alert: "安全警报",
  state_change: "状态变更",
  subscribed: "你订阅的",
  team_mention: "团队提及",
  ci_activity: "CI 活动",
};

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

// ─── Notification type icon ─────────────────────────────────────────────────

function NotifIcon({ subjectType, unread }: { subjectType?: string; unread: boolean }) {
  const cls = unread ? "text-blue-400" : "text-[var(--color-muted-foreground)]";
  switch (subjectType) {
    case "PullRequest":
    case "pull_request":
      return <GitPullRequest className={cn("w-3.5 h-3.5", cls)} />;
    case "Issue":
    case "issue":
      return <Bug className={cn("w-3.5 h-3.5", cls)} />;
    case "Release":
      return <Star className={cn("w-3.5 h-3.5", cls)} />;
    default:
      return <Bell className={cn("w-3.5 h-3.5", cls)} />;
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface NotificationFeedWidgetProps {
  widget: Widget;
  items: DataItem[];
  error?: string;
  isLoading?: boolean;
  onRemove: () => void;
  onRefresh?: () => void;
  dragHandle?: React.ReactNode;
}

export function NotificationFeedWidget({
  widget,
  items: propItems,
  error,
  isLoading,
  onRemove,
  onRefresh,
  dragHandle,
}: NotificationFeedWidgetProps) {
  const { t } = useTranslation();
  const notifications = propItems
    .filter((i) => i.kind === "notification")
    .slice(0, 15);
  const unreadCount = notifications.filter(
    (n) => n.status === "unread" || (n.metadata?.unread as boolean)
  ).length;

  return (
    <WidgetCard
      widget={widget}
      title="通知"
      icon={<Bell className="w-4 h-4" />}
      badge={unreadCount > 0 ? `${unreadCount} 未读` : undefined}
      badgeVariant={unreadCount > 0 ? "destructive" : "secondary"}
      error={error}
      isLoading={isLoading}
      onRemove={onRemove}
      onRefresh={onRefresh}
      lastUpdated={
        notifications[0] ? timeAgo(notifications[0].fetchedAt) : undefined
      }
      dragHandle={dragHandle}
    >
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-[var(--color-muted-foreground)] py-8 text-sm">
          <BellOff className="w-8 h-8 mb-2 opacity-30" />
          暂无通知<br />
          <span className="text-xs">配置 GitHub 数据源后自动拉取通知</span>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {notifications.map((notif) => {
            const unread = notif.status === "unread" || (notif.metadata?.unread as boolean);
            const reason = (notif.metadata?.reason as string) ?? "";
            const repo = notif.author; // In our schema, author field stores repo full_name for notifications

            return (
              <li
                key={notif.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-2.5 transition-colors",
                  unread
                    ? "bg-blue-500/5 hover:bg-blue-500/10"
                    : "hover:bg-[var(--color-accent)]/30"
                )}
              >
                <div className="mt-0.5 shrink-0">
                  <NotifIcon
                    subjectType={notif.metadata?.subjectType as string}
                    unread={unread}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <a
                    href={notif.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "text-sm truncate block hover:underline",
                      unread
                        ? "font-medium text-[var(--color-foreground)]"
                        : "text-[var(--color-muted-foreground)]"
                    )}
                  >
                    {notif.title}
                  </a>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] text-[var(--color-muted-foreground)] truncate max-w-[140px]">
                      {repo}
                    </span>
                    {reason && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0"
                      >
                        {reasonLabel(reason)}
                      </Badge>
                    )}
                    <span className="text-[10px] text-[var(--color-muted-foreground)]">
                      {timeAgo(notif.fetchedAt)}
                    </span>
                  </div>
                </div>
                {unread && (
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 shrink-0" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}
