import React from "react";
import { useDashboardStore } from "../../stores/dashboardStore";

export function DebugPanel() {
  const { dataItems, dashboards, activeDashboardId } = useDashboardStore();
  const active = dashboards.find((d) => d.id === activeDashboardId);

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-green-400 p-4 rounded-lg text-xs font-mono z-50 max-w-md max-h-96 overflow-auto">
      <h3 className="font-bold mb-2">Debug Panel</h3>
      
      <div className="mb-2">
        <span className="text-yellow-400">DataItems keys:</span>
        <div>{Object.keys(dataItems).join(", ") || "(empty)"}</div>
      </div>
      
      {Object.entries(dataItems).map(([key, items]) => (
        <div key={key} className="mb-1">
          <span className="text-yellow-400">{key.slice(0, 8)}:</span> {items.length} items
        </div>
      ))}
      
      <div className="mt-2 border-t border-green-400/30 pt-2">
        <span className="text-yellow-400">Active Dashboard:</span> {active?.name || "none"}
      </div>
      
      <div className="mt-1">
        <span className="text-yellow-400">Widgets:</span> {active?.widgets.length || 0}
      </div>
      
      {active?.widgets.map((w) => (
        <div key={w.id} className="ml-2">
          {w.widgetType} → {w.sourceId?.slice(0, 8) || "null"}
        </div>
      ))}
    </div>
  );
}
