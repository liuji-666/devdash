import { create } from "zustand";
import {
  apiListSources,
  apiCreateSource,
  apiDeleteSource,
  apiGetSettings,
  apiSaveSettings,
  apiPollSources,
  type CreateSourceInput,
} from "../lib/api";
import { useDashboardStore } from "./dashboardStore";

export interface StoredSettings {
  theme: "dark" | "light" | "system";
  ai: {
    provider: string;
    enabled: boolean;
    baseUrl?: string;
    model?: string;
    apiKey?: string;
  };
  pollingEnabled: boolean;
  minimizeToTray: boolean;
  launchAtStartup: boolean;
}

interface SettingsStore {
  sources: any[];
  settings: StoredSettings | null;
  loaded: boolean;

  load: () => Promise<void>;
  addSource: (input: CreateSourceInput) => Promise<any>;
  removeSource: (id: string) => Promise<void>;
  updateSettings: (updates: Partial<StoredSettings>) => void;
  saveSettings: () => Promise<void>;
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  sources: [],
  settings: null,
  loaded: false,

  load: async () => {
    try {
      const [sources, settings] = await Promise.all([
        apiListSources(),
        apiGetSettings(),
      ]);
      set({ sources, settings, loaded: true });
    } catch (e) {
      console.error("Failed to load settings:", e);
      set({ loaded: true });
    }
  },

  addSource: async (input) => {
    const created = await apiCreateSource(input);
    set((state) => ({ sources: [...state.sources, created] }));
    // Auto-poll after adding a new source
    try {
      await apiPollSources();
      // Refresh dashboard data items
      await useDashboardStore.getState().refreshDataItems();
    } catch (e) {
      console.error("Auto-poll after adding source failed:", e);
    }
    return created;
  },

  removeSource: async (id) => {
    await apiDeleteSource(id);
    set((state) => ({ sources: state.sources.filter((s) => s.id !== id) }));
  },

  updateSettings: (updates) => {
    set((state) => {
      if (!state.settings) return { settings: null };
      
      // Deep merge for nested ai object
      const newSettings = { ...state.settings, ...updates };
      if (updates.ai) {
        newSettings.ai = { ...state.settings.ai, ...updates.ai };
      }
      
      return { settings: newSettings };
    });
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => get().saveSettings(), 800);
  },

  saveSettings: async () => {
    const { settings } = get();
    if (!settings) return;
    try {
      await apiSaveSettings(settings as any);
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  },
}));
