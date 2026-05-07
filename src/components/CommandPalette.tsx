import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  GitPullRequest,
  Bug,
  CheckCircle2,
  Settings,
  Plus,
  RefreshCw,
  MessageSquare,
  Sun,
  Moon,
  Monitor,
  Activity,
  Bell,
  XCircle,
  Clock,
} from "lucide-react";

// ─── Command Types ─────────────────────────────────────────────────────────

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  category: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (target: string) => void;
  onRefresh: () => void;
  onAddWidget: () => void;
  onThemeChange: (theme: "dark" | "light" | "system") => void;
  currentTheme: string;
}

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  onRefresh,
  onAddWidget,
  onThemeChange,
  currentTheme,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: Command[] = [
    // Navigation
    {
      id: "nav-dashboard",
      label: "回到仪表盘",
      shortcut: "⌘1",
      icon: <Activity className="w-4 h-4" />,
      category: "导航",
      action: () => onNavigate("dashboard"),
    },
    {
      id: "nav-settings",
      label: "打开设置",
      shortcut: "⌘,",
      icon: <Settings className="w-4 h-4" />,
      category: "导航",
      action: () => onNavigate("settings"),
    },
    // Actions
    {
      id: "action-triage",
      label: "晨间处理",
      shortcut: "⌘T",
      icon: <Clock className="w-4 h-4" />,
      category: "操作",
      action: () => {
        onClose();
        setTimeout(() => {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "t", ctrlKey: true }));
        }, 100);
      },
    },
    {
      id: "action-refresh",
      label: "刷新数据",
      shortcut: "⌘R",
      icon: <RefreshCw className="w-4 h-4" />,
      category: "操作",
      action: onRefresh,
    },
    {
      id: "action-add-widget",
      label: "添加 Widget",
      shortcut: "⌘N",
      icon: <Plus className="w-4 h-4" />,
      category: "操作",
      action: onAddWidget,
    },
    {
      id: "action-ai-summary",
      label: "生成 AI 摘要",
      icon: <MessageSquare className="w-4 h-4" />,
      category: "操作",
      action: () => onNavigate("ai-summary"),
    },
    // Theme
    {
      id: "theme-dark",
      label: "切换深色主题",
      icon: <Moon className="w-4 h-4" />,
      category: "外观",
      action: () => onThemeChange("dark"),
    },
    {
      id: "theme-light",
      label: "切换浅色主题",
      icon: <Sun className="w-4 h-4" />,
      category: "外观",
      action: () => onThemeChange("light"),
    },
    {
      id: "theme-system",
      label: "跟随系统主题",
      icon: <Monitor className="w-4 h-4" />,
      category: "外观",
      action: () => onThemeChange("system"),
    },
  ];

  const filtered = query
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.category.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  // Group by category
  const grouped: { category: string; items: Command[] }[] = [];
  const categoryMap = new Map<string, Command[]>();
  for (const cmd of filtered) {
    const list = categoryMap.get(cmd.category) || [];
    list.push(cmd);
    categoryMap.set(cmd.category, list);
  }
  for (const [category, items] of categoryMap) {
    grouped.push({ category, items });
  }

  // Reset state on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeSelected = useCallback(() => {
    if (filtered[selectedIndex]) {
      filtered[selectedIndex].action();
      onClose();
    }
  }, [filtered, selectedIndex, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          executeSelected();
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filtered.length, executeSelected, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
          <Search className="w-4 h-4 text-[var(--color-muted-foreground)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入命令或搜索…"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-[var(--color-muted-foreground)]"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-muted-foreground)] bg-[var(--color-accent)] rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              没有匹配的命令
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.category}>
                <div className="px-3 py-1 text-[10px] font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
                  {group.category}
                </div>
                {group.items.map((cmd) => {
                  const idx = flatIndex++;
                  return (
                    <button
                      key={cmd.id}
                      data-index={idx}
                      onClick={() => {
                        cmd.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                        idx === selectedIndex
                          ? "bg-[var(--color-accent)] text-[var(--color-foreground)]"
                          : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]/30"
                      }`}
                    >
                      <span className="shrink-0">{cmd.icon}</span>
                      <span className="flex-1 text-left">{cmd.label}</span>
                      {cmd.shortcut && (
                        <kbd className="text-[10px] font-mono text-[var(--color-muted-foreground)] bg-[var(--color-background)] px-1.5 py-0.5 rounded">
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-muted-foreground)]">
          <div className="flex items-center gap-3">
            <span>↑↓ 导航</span>
            <span>↵ 执行</span>
            <span>ESC 关闭</span>
          </div>
          <span>Ctrl+K 随时打开</span>
        </div>
      </div>
    </div>
  );
}
