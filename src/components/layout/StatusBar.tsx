import React from "react";
import { Circle, RefreshCw, AlertTriangle } from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";

interface StatusBarProps {
  lastRefresh?: string;
  onRefresh?: () => void;
  statusMessage?: string | null;
  errors?: string[];
}

export function StatusBar({ lastRefresh, onRefresh, statusMessage, errors = [] }: StatusBarProps) {
  const sources = useSettingsStore((s) => s.sources);
  const settings = useSettingsStore((s) => s.settings);
  const pollingEnabled = settings?.pollingEnabled ?? false;
  const activeSources = sources.filter((s) => s.enabled).length;

  // Connection status: green=all good, yellow=has errors but some data, red=all errors
  const hasErrors = errors.length > 0;
  const allFailed = statusMessage?.includes("失败") || statusMessage?.includes("错误");
  const statusColor = allFailed ? "#ef4444" : hasErrors ? "#f59e0b" : pollingEnabled ? "#22c55e" : "#6b7280";

  return (
    <div className="flex items-center justify-between h-7 px-4 border-t border-[var(--color-border)] bg-[var(--color-background)] text-[10px] text-[var(--color-muted-foreground)] select-none">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex items-center gap-1 flex-shrink-0">
          <Circle
            className="w-1.5 h-1.5 fill-current"
            fill={statusColor}
          />
          {pollingEnabled ? (hasErrors ? "部分失败" : "轮询中") : "已暂停"}
        </span>
        <span className="flex-shrink-0">{activeSources} 个数据源</span>
        {lastRefresh && <span className="flex-shrink-0">上次刷新: {lastRefresh}</span>}
        {statusMessage && (
          <span className={`truncate max-w-[300px] ${hasErrors ? "text-amber-400" : "text-[var(--color-primary)]"}`}>
            {statusMessage}
          </span>
        )}
        {hasErrors && (
          <span className="flex items-center gap-1 text-red-400 flex-shrink-0" title={errors.join("\n")}>
            <AlertTriangle className="w-3 h-3" />
            {errors.length} 个错误
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1 hover:text-[var(--color-foreground)] cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            刷新
          </button>
        )}
        <span>v0.1.0</span>
      </div>
    </div>
  );
}
