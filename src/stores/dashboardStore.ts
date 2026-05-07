import { create } from "zustand";
import type { Dashboard, Widget } from "../types";
import {
  apiListDashboards,
  apiCreateDashboard,
  apiDeleteDashboard,
  apiCreateWidget,
  apiDeleteWidget,
  apiUpdateWidgetPosition,
  onDataUpdated,
  apiGetDataItems,
  apiListSources,
} from "../lib/api";

interface DashboardStore {
  dashboards: Dashboard[];
  activeDashboardId: string | null;
  initialized: boolean;
  dataItems: Record<string, any[]>;
  sourceErrors: Record<string, string>; // sourceId -> error message

  // Actions
  init: () => Promise<void>;
  setActiveDashboard: (id: string) => void;
  addDashboard: (name: string) => Promise<void>;
  removeDashboard: (id: string) => Promise<void>;
  addWidget: (
    dashboardId: string,
    widget: Omit<Widget, "id" | "createdAt" | "dashboardId">
  ) => Promise<void>;
  updateWidget: (widgetId: string, updates: Partial<Widget>) => void;
  updateWidgetPosition: (
    widgetId: string,
    position: { x: number; y: number; w: number; h: number }
  ) => Promise<void>;
  removeWidget: (widgetId: string) => Promise<void>;
  setDataItems: (sourceId: string, items: any[]) => void;
  setSourceError: (sourceId: string, error: string | null) => void;
  refreshDataItems: () => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  dashboards: [],
  activeDashboardId: null,
  initialized: false,
  dataItems: {},
  sourceErrors: {},

  init: async () => {
    try {
      let dashboards = await apiListDashboards();

      // Auto-create default dashboard if none exists
      if (dashboards.length === 0) {
        const dash = await apiCreateDashboard("我的工作台");
        dashboards = [dash];
      }

      const activeId =
        dashboards.find((d: Dashboard) => d.isDefault)?.id ??
        dashboards[0]?.id ??
        null;

      set({ dashboards, activeDashboardId: activeId, initialized: true });

      // Listen for backend data updates
      onDataUpdated(() => {
        get().refreshDataItems();
      });
    } catch (e) {
      console.error("Failed to load dashboards:", e);
      set({ initialized: true });
    }
  },

  setActiveDashboard: (id) => set({ activeDashboardId: id }),

  addDashboard: async (name) => {
    try {
      const dash = await apiCreateDashboard(name);
      set((state) => ({
        dashboards: [...state.dashboards, dash],
        activeDashboardId: dash.id,
      }));
    } catch (e) {
      console.error("Failed to create dashboard:", e);
    }
  },

  removeDashboard: async (id) => {
    try {
      await apiDeleteDashboard(id);
      set((state) => {
        const remaining = state.dashboards.filter((d) => d.id !== id);
        return {
          dashboards: remaining,
          activeDashboardId:
            state.activeDashboardId === id
              ? remaining[0]?.id ?? null
              : state.activeDashboardId,
        };
      });
    } catch (e) {
      console.error("Failed to delete dashboard:", e);
    }
  },

  addWidget: async (dashboardId, widget) => {
    try {
      const created = await apiCreateWidget(
        dashboardId,
        widget.pluginId,
        widget.widgetType,
        widget.sourceId ?? null,
        widget.position,
        widget.config as Record<string, unknown>
      );
      set((state) => ({
        dashboards: state.dashboards.map((d) =>
          d.id === dashboardId
            ? { ...d, widgets: [...d.widgets, created] }
            : d
        ),
      }));
    } catch (e) {
      console.error("Failed to add widget:", e);
    }
  },

  updateWidget: (widgetId, updates) => {
    set((state) => ({
      dashboards: state.dashboards.map((d) => ({
        ...d,
        widgets: d.widgets.map((w) =>
          w.id === widgetId ? { ...w, ...updates } : w
        ),
      })),
    }));
  },

  updateWidgetPosition: async (widgetId, position) => {
    // Optimistic update
    set((state) => ({
      dashboards: state.dashboards.map((d) => ({
        ...d,
        widgets: d.widgets.map((w) =>
          w.id === widgetId ? { ...w, position } : w
        ),
      })),
    }));
    try {
      await apiUpdateWidgetPosition(widgetId, position);
    } catch (e) {
      console.error("Failed to save widget position:", e);
    }
  },

  removeWidget: async (widgetId) => {
    // Optimistic remove
    set((state) => ({
      dashboards: state.dashboards.map((d) => ({
        ...d,
        widgets: d.widgets.filter((w) => w.id !== widgetId),
      })),
    }));
    try {
      await apiDeleteWidget(widgetId);
    } catch (e) {
      console.error("Failed to delete widget:", e);
    }
  },

  setDataItems: (sourceId, items) => {
    set((state) => ({
      dataItems: { ...state.dataItems, [sourceId]: items },
    }));
  },

  setSourceError: (sourceId, error) => {
    set((state) => {
      const newErrors = { ...state.sourceErrors };
      if (error) {
        newErrors[sourceId] = error;
      } else {
        delete newErrors[sourceId];
      }
      return { sourceErrors: newErrors };
    });
  },

  refreshDataItems: async () => {
    // Fetch data items for ALL sources (not just those with widgets)

    let sourceIds = new Set<string>();

    // 1. From widgets
    const { dashboards } = get();
    for (const dash of dashboards) {
      for (const w of dash.widgets) {
        if (w.sourceId) sourceIds.add(w.sourceId);
      }
    }

    // 2. From all known sources (in case user added source but no widget yet)
    try {
      const allSources = await apiListSources();
      for (const s of allSources) {
        if (s.enabled) sourceIds.add(s.id);
      }
    } catch {}

    if (sourceIds.size === 0) {
      console.log("[DevDash] refreshDataItems: no sources found");
      return;
    }

    console.log(`[DevDash] refreshDataItems: fetching for ${sourceIds.size} sources`);

    const newItems: Record<string, any[]> = {};
    const newErrors: Record<string, string> = {};
    await Promise.all(
      [...sourceIds].map(async (sid) => {
        try {
          const items = await apiGetDataItems(sid);
          console.log(`[DevDash] source ${sid.slice(0,8)}: ${items.length} items`);
          newItems[sid] = items;
        } catch (e: any) {
          console.error(`[DevDash] failed to get items for source ${sid.slice(0,8)}:`, e);
          newItems[sid] = [];
          newErrors[sid] = e?.message ?? String(e);
        }
      })
    );
    set((state) => ({
      dataItems: { ...state.dataItems, ...newItems },
      sourceErrors: { ...state.sourceErrors, ...newErrors },
    }));
  },
}));
