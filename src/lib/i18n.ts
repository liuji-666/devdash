// i18n.ts - Internationalization
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Language = "en" | "zh";

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // App
    "app.name": "DevDash",
    "app.tagline": "Developer Dashboard",
    
    // Sidebar
    "sidebar.dashboard": "Dashboard",
    "sidebar.dashboards": "Dashboards",
    "sidebar.addWidget": "Add Widget",
    "sidebar.settings": "Settings",
    "sidebar.addDashboard": "New Dashboard",
    
    // Dashboard
    "dashboard.empty": "This dashboard is empty",
    "dashboard.empty.hint": "Click 'Add Widget' to add PR, CI status and more",
    "dashboard.select": "Select a dashboard to start",
    "dashboard.widgets": "widgets",
    "dashboard.dragHint": "Drag to reorder",
    
    // Widgets
    "widget.prList": "Pull Requests",
    "widget.ciStatus": "CI Status",
    "widget.aiSummary": "AI Summary",
    "widget.issueList": "Issues",
    "widget.noData": "No data yet",
    "widget.noData.hint": "Add a data source in Settings",
    "widget.addSource": "Add data source",
    "widget.noItems": "No items",
    "widget.merged": "merged",
    "widget.open": "open",
    "widget.closed": "closed",
    "widget.failed": "failed",
    "widget.success": "success",
    "widget.pending": "pending",
    "widget.running": "running",
    
    // Settings
    "settings.title": "Settings",
    "settings.general": "General",
    "settings.dataSources": "Data Sources",
    "settings.ai": "AI",
    "settings.about": "About",
    "settings.theme": "Theme",
    "settings.theme.dark": "Dark",
    "settings.theme.light": "Light",
    "settings.theme.system": "System",
    "settings.language": "Language",
    "settings.language.zh": "中文",
    "settings.language.en": "English",
    "settings.addSource": "Add Source",
    "settings.editSource": "Edit Source",
    "settings.sourceType": "Source Type",
    "settings.github": "GitHub",
    "settings.gitlab": "GitLab",
    "settings.token": "Token",
    "settings.token.hint": "Only stored locally",
    "settings.owner": "Owner",
    "settings.repo": "Repository",
    "settings.apiUrl": "API URL",
    "settings.testConnection": "Test Connection",
    "settings.connectionOk": "Connection OK",
    "settings.connectionFailed": "Connection failed",
    "settings.save": "Save",
    "settings.cancel": "Cancel",
    "settings.delete": "Delete",
    "settings.deleteConfirm": "Are you sure?",
    
    // AI
    "ai.provider": "Provider",
    "ai.ollama": "Ollama (Local)",
    "ai.openai": "OpenAI",
    "ai.claude": "Claude",
    "ai.gemini": "Google Gemini",
    "ai.openaiCompat": "OpenAI Compatible",
    "ai.apiKey": "API Key",
    "ai.model": "Model",
    "ai.baseUrl": "Base URL",
    "ai.test": "Test",
    "ai.testSuccess": "Test successful",
    "ai.testFailed": "Test failed",
    "ai.generate": "Generate Summary",
    "ai.generating": "Generating...",
    
    // Status
    "status.lastUpdate": "Last update",
    "status.refreshing": "Refreshing...",
    "status.sources": "sources",
    "status.version": "Version",
    
    // Common
    "common.loading": "Loading...",
    "common.error": "Error",
    "common.retry": "Retry",
    "common.close": "Close",
    "common.remove": "Remove",
  },
  zh: {
    // App
    "app.name": "DevDash",
    "app.tagline": "开发者仪表盘",
    
    // Sidebar
    "sidebar.dashboard": "工作台",
    "sidebar.dashboards": "工作台列表",
    "sidebar.addWidget": "添加组件",
    "sidebar.settings": "设置",
    "sidebar.addDashboard": "新建工作台",
    
    // Dashboard
    "dashboard.empty": "这个工作台是空的",
    "dashboard.empty.hint": "点击「添加组件」按钮，添加 PR、CI 状态等组件",
    "dashboard.select": "选择一个工作台开始",
    "dashboard.widgets": "个组件",
    "dashboard.dragHint": "拖拽排序",
    
    // Widgets
    "widget.prList": "合并请求",
    "widget.ciStatus": "CI 状态",
    "widget.aiSummary": "AI 摘要",
    "widget.issueList": "Issues",
    "widget.noData": "暂无数据",
    "widget.noData.hint": "在设置中添加数据源",
    "widget.addSource": "添加数据源",
    "widget.noItems": "暂无",
    "widget.merged": "已合并",
    "widget.open": "开放",
    "widget.closed": "已关闭",
    "widget.failed": "失败",
    "widget.success": "成功",
    "widget.pending": "等待中",
    "widget.running": "运行中",
    
    // Settings
    "settings.title": "设置",
    "settings.general": "通用",
    "settings.dataSources": "数据源",
    "settings.ai": "AI",
    "settings.about": "关于",
    "settings.theme": "主题",
    "settings.theme.dark": "深色",
    "settings.theme.light": "浅色",
    "settings.theme.system": "跟随系统",
    "settings.language": "语言",
    "settings.language.zh": "中文",
    "settings.language.en": "English",
    "settings.addSource": "添加数据源",
    "settings.editSource": "编辑数据源",
    "settings.sourceType": "数据源类型",
    "settings.github": "GitHub",
    "settings.gitlab": "GitLab",
    "settings.token": "Token",
    "settings.token.hint": "仅本地加密存储",
    "settings.owner": "所有者",
    "settings.repo": "仓库",
    "settings.apiUrl": "API 地址",
    "settings.testConnection": "测试连接",
    "settings.connectionOk": "连接成功",
    "settings.connectionFailed": "连接失败",
    "settings.save": "保存",
    "settings.cancel": "取消",
    "settings.delete": "删除",
    "settings.deleteConfirm": "确定要删除吗？",
    
    // AI
    "ai.provider": "提供商",
    "ai.ollama": "Ollama (本地)",
    "ai.openai": "OpenAI",
    "ai.claude": "Claude",
    "ai.gemini": "Google Gemini",
    "ai.openaiCompat": "OpenAI 兼容",
    "ai.apiKey": "API Key",
    "ai.model": "模型",
    "ai.baseUrl": "Base URL",
    "ai.test": "测试",
    "ai.testSuccess": "测试成功",
    "ai.testFailed": "测试失败",
    "ai.generate": "生成摘要",
    "ai.generating": "生成中...",
    
    // Status
    "status.lastUpdate": "上次更新",
    "status.refreshing": "刷新中...",
    "status.sources": "个数据源",
    "status.version": "版本",
    
    // Common
    "common.loading": "加载中...",
    "common.error": "错误",
    "common.retry": "重试",
    "common.close": "关闭",
    "common.remove": "移除",
  },
};

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      language: "zh",
      setLanguage: (language) => set({ language }),
      t: (key) => {
        const lang = get().language;
        return translations[lang][key] || translations.en[key] || key;
      },
    }),
    { name: "devdash-i18n" }
  )
);

// Helper hook for easy usage
export function useTranslation() {
  const { t, language, setLanguage } = useI18nStore();
  return { t, language, setLanguage };
}