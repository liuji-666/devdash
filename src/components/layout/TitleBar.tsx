import React from "react";
import { Minus, Square, X, Maximize2 } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function TitleBar() {
  const handleMinimize = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.minimize();
  };
  const handleMaximize = async () => {
    const appWindow = getCurrentWindow();
    const isMaximized = await appWindow.isMaximized();
    if (isMaximized) {
      appWindow.unmaximize();
    } else {
      appWindow.maximize();
    }
  };
  const handleClose = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.close();
  };

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-9 bg-[var(--color-sidebar)] border-b border-[var(--color-sidebar-border)] select-none flex-shrink-0"
    >
      {/* Left: Logo + app name */}
      <div className="flex items-center gap-2 px-4" data-tauri-drag-region>
        {/* App icon */}
        <div className="w-5 h-5 rounded bg-[var(--color-sidebar-primary)] flex items-center justify-center flex-shrink-0">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="1" width="4" height="4" rx="1" fill="currentColor" opacity="0.9" />
            <rect x="7" y="1" width="4" height="4" rx="1" fill="currentColor" opacity="0.5" />
            <rect x="1" y="7" width="4" height="4" rx="1" fill="currentColor" opacity="0.5" />
            <rect x="7" y="7" width="4" height="4" rx="1" fill="currentColor" opacity="0.9" />
          </svg>
        </div>
        <span
          className="text-xs font-semibold text-[var(--color-sidebar-foreground)] tracking-wide"
          data-tauri-drag-region
        >
          DevDash
        </span>
      </div>

      {/* Center: drag area */}
      <div className="flex-1" data-tauri-drag-region />

      {/* Right: window controls */}
      <div className="flex items-center h-full">
        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className="flex items-center justify-center w-12 h-full hover:bg-[var(--color-accent)] transition-colors cursor-pointer group"
          aria-label="最小化"
        >
          <Minus className="w-3.5 h-3.5 text-[var(--color-muted-foreground)] group-hover:text-[var(--color-foreground)] transition-colors" />
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={handleMaximize}
          className="flex items-center justify-center w-12 h-full hover:bg-[var(--color-accent)] transition-colors cursor-pointer group"
          aria-label="最大化"
        >
          <Square className="w-3 h-3 text-[var(--color-muted-foreground)] group-hover:text-[var(--color-foreground)] transition-colors" />
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="flex items-center justify-center w-12 h-full hover:bg-red-600 transition-colors cursor-pointer group"
          aria-label="关闭"
        >
          <X className="w-3.5 h-3.5 text-[var(--color-muted-foreground)] group-hover:text-white transition-colors" />
        </button>
      </div>
    </div>
  );
}
