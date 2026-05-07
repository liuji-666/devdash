import React, { useEffect, useState, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { TitleBar } from "./components/layout/TitleBar";
import { Sidebar } from "./components/layout/Sidebar";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import { StatusBar } from "./components/layout/StatusBar";
import { DashboardView } from "./components/dashboard/DashboardView";
import { DashboardSkeleton } from "./components/dashboard/WidgetSkeleton";
import { AddWidgetDialog } from "./components/dashboard/AddWidgetDialog";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import { CommandPalette } from "./components/CommandPalette";
import { MorningTriageModal } from "./components/triage/MorningTriageModal";

import SettingsView from "./components/settings/SettingsView";
import { useDashboardStore } from "./stores/dashboardStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useIdleDetection } from "./hooks/useIdleDetection";
import type { WidgetType } from "./types";
import { apiPollSources, onDataUpdated, apiSaveSettings, apiDebugDbState } from "./lib/api";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { sendNotification, isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";

export default function App() {
  const [activeView, setActiveView] = useState<"dashboard" | "settings">("dashboard");
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);

  const { dataItems, activeDashboardId, addWidget, refreshDataItems } = useDashboardStore(
    useShallow((s) => ({
      dataItems: s.dataItems,
      activeDashboardId: s.activeDashboardId,
      addWidget: s.addWidget,
      refreshDataItems: s.refreshDataItems,
    }))
  );

  const { sources: settingsSources, settings: settingsValues } = useSettingsStore(
    useShallow((s) => ({ sources: s.sources, settings: s.settings }))
  );

  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [pollErrors, setPollErrors] = React.useState<string[]>([]);
  const [showOnboarding, setShowOnboarding] = React.useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [triageOpen, setTriageOpen] = React.useState(false);

  // ─── User idle detection ──────────────────────────────────────
  const { isIdleRef } = useIdleDetection(5 * 60 * 1000); // 5 min idle threshold

  // Bootstrap — init stores then fetch data
  useEffect(() => {
    const bootstrap = async () => {
      try {
        await Promise.all([
          useDashboardStore.getState().init(),
          useSettingsStore.getState().load(),
        ]);
      } catch (e) {
        console.error("Bootstrap init error:", e);
        setStatusMessage("初始化失败: " + String(e));
        setBootstrapLoading(false);
        return;
      }
      
      // Check if onboarding needed (no sources)
      const sources = useSettingsStore.getState().sources;
      if (!sources || sources.length === 0) {
        setShowOnboarding(true);
        setBootstrapLoading(false);
        return;
      }
      
      // After init, poll sources and refresh data
      try {
        setStatusMessage("正在拉取数据...");
        const pollResult = await apiPollSources();
        console.log("[DevDash] poll_sources result:", pollResult);
        await refreshDataItems();
        setLastRefresh(new Date().toLocaleTimeString("zh-CN"));
        setStatusMessage(pollResult.message);
        setPollErrors(pollResult.errors);
        setTimeout(() => {
          setStatusMessage(null);
          setPollErrors([]);
        }, pollResult.errors.length > 0 ? 8000 : 4000);
      } catch (e: any) {
        console.error("Bootstrap poll error:", e);
        setStatusMessage("拉取失败: " + (e?.message ?? String(e)));
      } finally {
        setBootstrapLoading(false);
      }
    };
    bootstrap();
  }, []);

  // Apply theme
  useEffect(() => {
    if (!settingsValues) return;
    const effectiveTheme =
      settingsValues.theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : settingsValues.theme;
    document.documentElement.setAttribute("data-theme", effectiveTheme);
  }, [settingsValues?.theme]);

  // Auto-poll (runs after bootstrap, paused when user idle)
  useEffect(() => {
    if (!settingsValues?.pollingEnabled) return;
    const doPoll = async () => {
      // Skip polling when user is idle
      if (isIdleRef.current) {
        console.log("[DevDash] Skipping poll — user idle");
        return;
      }
      try {
        await apiPollSources();
        await refreshDataItems();
        setLastRefresh(new Date().toLocaleTimeString("zh-CN"));
      } catch (e) {
        console.error("Poll error:", e);
      }
    };
    const interval = setInterval(doPoll, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [settingsValues?.pollingEnabled]);

  // ─── Desktop notification listener (CI failures) ──────────────
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    const setup = async () => {
      try {
        // Request permission if not yet granted
        let permitted = await isPermissionGranted();
        if (!permitted) {
          const permission = await requestPermission();
          permitted = permission === "granted";
        }
        if (!permitted) return;

        unlisten = await listen<{ title: string; body: string }>(
          "ci-failure-notification",
          (event) => {
            sendNotification({
              title: event.payload.title,
              body: event.payload.body,
            });
          }
        );
      } catch (e) {
        // Notification plugin may not be available (e.g., during dev)
        console.warn("Desktop notifications not available:", e);
      }
    };
    setup();
    return () => { unlisten?.(); };
  }, []);

  // ─── Navigate to settings from widget empty states ────────────
  useEffect(() => {
    const handleNavigate = () => setActiveView("settings");
    window.addEventListener("navigate-to-settings", handleNavigate);
    return () => window.removeEventListener("navigate-to-settings", handleNavigate);
  }, []);

  // ─── Ctrl+K Command Palette / Ctrl+T Triage ─────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "t") {
        e.preventDefault();
        setTriageOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleThemeChange = useCallback(async (theme: "dark" | "light" | "system") => {
    // Go through store to respect debounce and keep state + API in sync
    useSettingsStore.getState().updateSettings({ theme });
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    setStatusMessage("正在拉取数据...");
    setPollErrors([]);
    try {
      const pollResult = await apiPollSources();
      await refreshDataItems();
      setLastRefresh(new Date().toLocaleTimeString("zh-CN"));
      setStatusMessage(pollResult.message);
      setPollErrors(pollResult.errors);
      setTimeout(() => {
        setStatusMessage(null);
        setPollErrors([]);
      }, pollResult.errors.length > 0 ? 8000 : 4000);
    } catch (e: any) {
      console.error("Refresh error:", e);
      setStatusMessage("拉取失败: " + (e?.message ?? String(e)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddWidget = async (widgetType: WidgetType, sourceId?: string) => {
    if (!activeDashboardId) return;
    
    // Determine the best sourceId for this widget type
    let resolvedSourceId = sourceId ?? null;
    
    // If no sourceId provided, try to find a matching source
    if (!resolvedSourceId && settingsSources && settingsSources.length > 0) {
      // For GitHub-related widgets, prefer GitHub sources
      const githubSources = settingsSources.filter(s => s.type === 'github');
      const gitlabSources = settingsSources.filter(s => s.type === 'gitlab');
      const jiraSources = settingsSources.filter(s => s.type === 'jira');
      const linearSources = settingsSources.filter(s => s.type === 'linear');
      
      switch (widgetType) {
        case 'pr_list':
        case 'ci_status':
        case 'issue_list':
        case 'activity_calendar':
        case 'notification_feed':
          resolvedSourceId = githubSources[0]?.id ?? gitlabSources[0]?.id ?? settingsSources[0]?.id;
          break;
        case 'sprint_board':
          resolvedSourceId = jiraSources[0]?.id ?? linearSources[0]?.id ?? settingsSources[0]?.id;
          break;
        case 'today_overview':
        case 'ai_summary':
          // These don't need a specific source
          resolvedSourceId = null;
          break;
        default:
          resolvedSourceId = settingsSources[0]?.id;
      }
    }
    
    await addWidget(activeDashboardId, {
      pluginId: "@devdash/core",
      widgetType,
      sourceId: resolvedSourceId,
      position: { x: 0, y: 0, w: 1, h: 1 },
      config: {},
    });
  };

  return (
    <ErrorBoundary>
      {/* Show loading skeleton while bootstrapping */}
      {bootstrapLoading && !showOnboarding && (
        <div className="flex h-screen bg-[var(--color-background)]">
          <div className="w-60 bg-[var(--color-sidebar)] border-r border-[var(--color-sidebar-border)] flex-shrink-0">
            <div className="flex items-center gap-2 p-4">
              <div className="w-8 h-8 rounded bg-[var(--skeleton-bg)] animate-pulse" />
              <div className="w-20 h-5 bg-[var(--skeleton-bg)] animate-pulse rounded" />
            </div>
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <div className="w-5 h-5 bg-[var(--skeleton-bg)] animate-pulse rounded" />
                  <div className="w-24 h-4 bg-[var(--skeleton-bg)] animate-pulse rounded" />
                </div>
              ))}
            </div>
          </div>
          <DashboardSkeleton />
        </div>
      )}
      
      {!bootstrapLoading && (
        <>
      {showOnboarding && (
        <OnboardingWizard
          onComplete={async () => {
            setShowOnboarding(false);
            // After onboarding, do initial poll
            try {
              setStatusMessage("正在拉取数据...");
              const pollResult = await apiPollSources();
              await refreshDataItems();
              setLastRefresh(new Date().toLocaleTimeString("zh-CN"));
              setStatusMessage(pollResult.message);
              setPollErrors(pollResult.errors);
              setTimeout(() => {
                setStatusMessage(null);
                setPollErrors([]);
              }, pollResult.errors.length > 0 ? 8000 : 4000);
            } catch (e: any) {
              console.error("Post-onboarding poll error:", e);
              setStatusMessage("拉取失败: " + (e?.message ?? String(e)));
            }
          }}
        />
      )}
      <div className="flex flex-col h-screen bg-[var(--color-background)] text-[var(--color-foreground)] overflow-hidden">
        <TitleBar />

        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            activeView={activeView}
            onViewChange={setActiveView}
            onAddWidget={() => setAddWidgetOpen(true)}
          />

          <main className="flex-1 flex flex-col overflow-hidden">
            {activeView === "dashboard" ? (
              <DashboardView dataItems={dataItems} isLoading={isLoading} onRefresh={handleRefresh} />
            ) : (
              <SettingsView onBack={() => setActiveView("dashboard")} />
            )}
          </main>
        </div>

        <StatusBar lastRefresh={lastRefresh} onRefresh={handleRefresh} statusMessage={statusMessage} errors={pollErrors} />

        <AddWidgetDialog
          open={addWidgetOpen}
          onOpenChange={setAddWidgetOpen}
          onAdd={handleAddWidget}
          sourceOptions={settingsSources.map((s) => ({
            id: s.id,
            label: s.label,
            type: s.type,
          }))}
        />
        
      </div>
        </>
      )}

      {/* Command Palette — global */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={(target) => {
          if (target === "dashboard") setActiveView("dashboard");
          else if (target === "settings") setActiveView("settings");
        }}
        onRefresh={handleRefresh}
        onAddWidget={() => setAddWidgetOpen(true)}
        onThemeChange={handleThemeChange}
        currentTheme={settingsValues?.theme ?? "system"}
      />

      {/* Morning Triage Modal */}
      <MorningTriageModal
        isOpen={triageOpen}
        onClose={() => setTriageOpen(false)}
      />
    </ErrorBoundary>
  );
}
