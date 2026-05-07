import React from "react";
import { MoreHorizontal, RefreshCw, X, GripHorizontal, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { Widget } from "../../types";
import { cn } from "../../lib/utils";

interface WidgetCardProps {
  widget: Widget;
  title: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeVariant?: "default" | "success" | "warning" | "destructive" | "secondary" | "outline";
  onRemove: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  lastUpdated?: string;
  children: React.ReactNode;
  className?: string;
  dragHandle?: React.ReactNode;
  error?: string | null;
}

export function WidgetCard({
  widget,
  title,
  icon,
  badge,
  badgeVariant = "default",
  onRemove,
  onRefresh,
  isLoading,
  lastUpdated,
  children,
  className,
  dragHandle,
  error,
}: WidgetCardProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Close menu on outside click
  React.useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpen]);

  return (
    <Card
      className={cn(
        "widget-card flex flex-col h-full min-h-[200px] rounded-2xl",
        className
      )}
      style={{
        gridColumn: `span ${widget.position.w}`,
        gridRow: `span ${widget.position.h}`,
      }}
    >
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between px-4 py-3 space-y-0 border-b border-[var(--color-border)] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {dragHandle && dragHandle}
          {icon && (
            <span className="text-[var(--color-muted-foreground)] flex-shrink-0">{icon}</span>
          )}
          <CardTitle className="text-sm font-medium truncate">{title}</CardTitle>
          {badge && (
            <Badge
              variant={badgeVariant === "success" ? "default" : badgeVariant}
              className={cn(
                "text-[10px] flex-shrink-0",
                badgeVariant === "success" && "bg-green-500/20 text-green-400 border-green-500/30"
              )}
            >
              {badge}
            </Badge>
          )}
          {isLoading && (
            <RefreshCw className="w-3 h-3 animate-spin text-[var(--color-muted-foreground)] flex-shrink-0" />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
          {lastUpdated && (
            <span className="text-[9px] text-[var(--color-muted-foreground)] mr-1 whitespace-nowrap hidden sm:block">
              {lastUpdated}
            </span>
          )}
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              onClick={onRefresh}
              title="刷新"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          )}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <MoreHorizontal className="w-3 h-3" />
            </Button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[120px] bg-[var(--color-popover)] border border-[var(--color-border)] rounded-xl shadow-[var(--shadow-dialog)] py-1 overflow-hidden">
                <button
                  onClick={() => { onRemove(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 cursor-pointer transition-colors"
                >
                  <X className="w-3 h-3" />
                  移除此组件
                </button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Body */}
      <CardContent className="flex-1 overflow-y-auto p-0">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-red-400 py-8 text-sm animate-in fade-in duration-500">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
              <AlertCircle className="w-8 h-8 opacity-60" />
            </div>
            <p className="font-medium">数据加载失败</p>
            <p className="text-xs mt-1 opacity-70 max-w-[200px] text-center px-4">
              {error}
            </p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline"
              >
                重试
              </button>
            )}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
