import React from "react";
import { useShallow } from "zustand/react/shallow";
import { LayoutDashboard, Settings, Plus, ChevronDown, ChevronRight, LayoutGrid, Bot } from "lucide-react";
import { cn } from "../../lib/utils";
import { useDashboardStore } from "../../stores/dashboardStore";
import { useSettingsStore } from "../../stores/settingsStore";

interface SidebarProps {
  activeView: "dashboard" | "settings";
  onViewChange: (view: "dashboard" | "settings") => void;
  onAddWidget: () => void;
}

export function Sidebar({ activeView, onViewChange, onAddWidget }: SidebarProps) {
  const { dashboards, activeDashboardId, setActiveDashboard, addDashboard } =
    useDashboardStore(
      useShallow((s) => ({
        dashboards: s.dashboards,
        activeDashboardId: s.activeDashboardId,
        setActiveDashboard: s.setActiveDashboard,
        addDashboard: s.addDashboard,
      }))
    );
  const { sources } = useSettingsStore(useShallow((s) => ({ sources: s.sources })));
  const enabledSources = sources.filter((s) => s.enabled).length;

  const [dashboardsOpen, setDashboardsOpen] = React.useState(true);

  return (
    <aside className="w-56 flex-shrink-0 border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar)] flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="px-4 py-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-sm">
          <Bot className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold leading-tight text-[var(--color-sidebar-foreground)]">DevDash</h1>
          <p className="text-[10px] text-[var(--color-muted-foreground)] leading-tight">Developer Dashboard</p>
        </div>
      </div>

      {/* Nav section */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {/* Dashboard */}
        <NavItem
          icon={<LayoutDashboard className="w-4 h-4" />}
          label="仪表盘"
          active={activeView === "dashboard"}
          onClick={() => onViewChange("dashboard")}
        />

        {/* Dashboards list */}
        <div className="mt-1 mb-2">
          <button
            onClick={() => setDashboardsOpen(!dashboardsOpen)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] hover:text-[var(--color-sidebar-foreground)] cursor-pointer transition-colors rounded-md hover:bg-[var(--color-sidebar-accent)]/30"
          >
            <span>工作台</span>
            {dashboardsOpen ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>

          {dashboardsOpen && (
            <div className="mt-0.5 space-y-0.5">
              {dashboards.map((db) => (
                <button
                  key={db.id}
                  onClick={() => {
                    setActiveDashboard(db.id);
                    onViewChange("dashboard");
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-all cursor-pointer flex items-center gap-2 group",
                    activeView === "dashboard" && activeDashboardId === db.id
                      ? "bg-[var(--color-sidebar-accent)] text-[var(--color-sidebar-accent-foreground)] font-medium shadow-sm"
                      : "text-[var(--color-sidebar-foreground)]/60 hover:bg-[var(--color-sidebar-accent)]/50 hover:text-[var(--color-sidebar-accent-foreground)]"
                  )}
                >
                  <LayoutGrid className={cn(
                    "w-3.5 h-3.5 shrink-0 transition-colors",
                    activeView === "dashboard" && activeDashboardId === db.id
                      ? "text-[var(--color-sidebar-accent-foreground)]/70"
                      : "opacity-50 group-hover:opacity-80"
                  )} />
                  <span className="truncate">{db.name}</span>
                </button>
              ))}
              <button
                onClick={() => {
                  const name = prompt("新工作台名称：", "我的工作台");
                  if (name && name.trim()) addDashboard(name.trim());
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-sidebar-foreground)] cursor-pointer rounded-lg hover:bg-[var(--color-sidebar-accent)]/30 transition-all"
              >
                <Plus className="w-3.5 h-3.5 opacity-60" />
                新建工作台
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Bottom area */}
      <div className="p-2 border-t border-[var(--color-sidebar-border)] space-y-1">
        {/* Status summary */}
        <div className="px-3 py-2 flex items-center justify-between text-[11px] text-[var(--color-muted-foreground)]">
          <span>{enabledSources} 个数据源</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            在线
          </span>
        </div>

        <div className="h-px bg-[var(--color-sidebar-border)] mx-2" />

        <button
          onClick={onAddWidget}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-[var(--color-sidebar-foreground)]/80 hover:bg-[var(--color-sidebar-accent)] hover:text-[var(--color-sidebar-accent-foreground)] transition-all cursor-pointer font-medium"
        >
          <Plus className="w-4 h-4" />
          添加组件
        </button>

        <NavItem
          icon={<Settings className="w-4 h-4" />}
          label="设置"
          active={activeView === "settings"}
          onClick={() => onViewChange("settings")}
        />
      </div>
    </aside>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer",
        active
          ? "bg-[var(--color-sidebar-accent)] text-[var(--color-sidebar-accent-foreground)] font-medium shadow-sm"
          : "text-[var(--color-sidebar-foreground)]/70 hover:bg-[var(--color-sidebar-accent)]/40 hover:text-[var(--color-sidebar-accent-foreground)]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
