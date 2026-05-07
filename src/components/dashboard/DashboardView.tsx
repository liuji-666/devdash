import React from "react";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "../../stores/dashboardStore";
import { PRListWidget, CIStatusWidget, AISummaryWidget, IssueListWidget } from "./PlaceholderWidgets";
import { ActivityCalendarWidget } from "./ActivityCalendarWidget";
import { NotificationFeedWidget } from "./NotificationFeedWidget";
import { SprintBoardWidget } from "./SprintBoardWidget";
import { TodayOverviewWidget } from "./TodayOverviewWidget";
import { DashboardSkeleton } from "./WidgetSkeleton";
import type { Widget, DataItem } from "../../types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface DashboardViewProps {
  dataItems: Record<string, DataItem[]>;
  isLoading: boolean;
  onRefresh?: () => void;
}

export function DashboardView({ dataItems, isLoading, onRefresh }: DashboardViewProps) {
  const { dashboards, activeDashboardId, removeWidget, updateWidgetPosition, sourceErrors } =
    useDashboardStore(
      useShallow((s) => ({
        dashboards: s.dashboards,
        activeDashboardId: s.activeDashboardId,
        removeWidget: s.removeWidget,
        updateWidgetPosition: s.updateWidgetPosition,
        sourceErrors: s.sourceErrors,
      }))
    );
  const active = dashboards.find((d) => d.id === activeDashboardId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!active) return;
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;

    const oldIndex = active.widgets.findIndex((w) => w.id === dragged.id);
    const newIndex = active.widgets.findIndex((w) => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Swap positions in the array
    const reordered = [...active.widgets];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Save new positions
    reordered.forEach((w, i) => {
      updateWidgetPosition(w.id, {
        ...w.position,
        x: i % 4,
        y: Math.floor(i / 4),
      });
    });
  };

  if (!active) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-muted-foreground)]">
        <div className="text-6xl mb-4 opacity-10">⚡</div>
        <p className="text-sm">选择一个工作台开始</p>
      </div>
    );
  }

  if (active.widgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <div className="relative">
          <div className="text-7xl opacity-5">🚀</div>
        </div>
        <div>
          <p className="text-base font-medium text-[var(--color-foreground)]/60">
            {active.name} 还是空的
          </p>
          <p className="text-xs text-[var(--color-muted-foreground)] mt-2 max-w-xs leading-relaxed">
            点击侧边栏的「添加 Widget」按钮，添加 GitHub PR、CI 状态等组件
          </p>
        </div>
      </div>
    );
  }

  // Show skeleton during initial load
  if (isLoading && Object.keys(dataItems).length === 0) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {/* Dashboard header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
            {active.name}
          </h2>
          <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
            {active.widgets.length} 个组件 · 拖拽排序
          </p>
        </div>
      </div>

      {/* Sortable grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={active.widgets.map((w) => w.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-[minmax(200px,auto)]">
            {active.widgets.map((widget) => (
              <SortableWidgetItem
                key={widget.id}
                widget={widget}
                dataItems={dataItems}
                sourceErrors={sourceErrors}
                isLoading={isLoading}
                onRemove={() => removeWidget(widget.id)}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ─── Sortable wrapper ────────────────────────────────────────────────────────

function SortableWidgetItem({
  widget,
  dataItems,
  sourceErrors,
  isLoading,
  onRemove,
  onRefresh,
}: {
  widget: Widget;
  dataItems: Record<string, DataItem[]>;
  sourceErrors: Record<string, string>;
  isLoading: boolean;
  onRemove: () => void;
  onRefresh?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  // Grid positioning handled by WidgetCard to avoid transform conflict
  };

  // Add drag handle to widget header
  const dragHandle = (
    <button
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing p-1 hover:bg-[var(--color-accent)]/50 rounded-md transition-colors"
      title="拖拽排序"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <GripVertical className="w-3.5 h-3.5 text-[var(--color-muted-foreground)]" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <WidgetRenderer
        widget={widget}
        dataItems={dataItems}
        sourceErrors={sourceErrors}
        isLoading={isLoading}
        onRemove={onRemove}
        onRefresh={onRefresh}
        dragHandle={dragHandle}
      />
    </div>
  );
}

// ─── Widget renderer ─────────────────────────────────────────────────────────

function WidgetRenderer({
  widget,
  dataItems,
  sourceErrors,
  isLoading,
  onRemove,
  onRefresh,
  dragHandle,
}: {
  widget: Widget;
  dataItems: Record<string, DataItem[]>;
  sourceErrors: Record<string, string>;
  isLoading: boolean;
  onRemove: () => void;
  onRefresh?: () => void;
  dragHandle?: React.ReactNode;
}) {
  switch (widget.widgetType) {
    case "pr_list": {
      const items = dataItems[widget.sourceId ?? ""] ?? [];
      const error = widget.sourceId ? sourceErrors[widget.sourceId] : undefined;
      return (
        <PRListWidget
          widget={widget}
          items={items}
          error={error}
          isLoading={isLoading}
          onRemove={onRemove}
          onRefresh={onRefresh}
          dragHandle={dragHandle}
        />
      );
    }
    case "ci_status": {
      const items = dataItems[widget.sourceId ?? ""] ?? [];
      const error = widget.sourceId ? sourceErrors[widget.sourceId] : undefined;
      return (
        <CIStatusWidget
          widget={widget}
          items={items}
          error={error}
          isLoading={isLoading}
          onRemove={onRemove}
          onRefresh={onRefresh}
          dragHandle={dragHandle}
        />
      );
    }
    case "ai_summary": {
      const error = widget.sourceId ? sourceErrors[widget.sourceId] : undefined;
      return (
        <AISummaryWidget
          widget={widget}
          error={error}
          isLoading={isLoading}
          onRemove={onRemove}
          onRefresh={onRefresh}
          dragHandle={dragHandle}
        />
      );
    }
    case "issue_list": {
      const issueItems = dataItems[widget.sourceId ?? ""] ?? [];
      const error = widget.sourceId ? sourceErrors[widget.sourceId] : undefined;
      return (
        <IssueListWidget
          widget={widget}
          items={issueItems}
          error={error}
          isLoading={isLoading}
          onRemove={onRemove}
          onRefresh={onRefresh}
          dragHandle={dragHandle}
        />
      );
    }
    case "activity_calendar": {
      const error = widget.sourceId ? sourceErrors[widget.sourceId] : undefined;
      return (
        <ActivityCalendarWidget
          widget={widget}
          error={error}
          isLoading={isLoading}
          onRemove={onRemove}
          onRefresh={onRefresh}
          dragHandle={dragHandle}
        />
      );
    }
    case "notification_feed": {
      const items = dataItems[widget.sourceId ?? ""] ?? [];
      const error = widget.sourceId ? sourceErrors[widget.sourceId] : undefined;
      return (
        <NotificationFeedWidget
          widget={widget}
          items={items}
          error={error}
          isLoading={isLoading}
          onRemove={onRemove}
          onRefresh={onRefresh}
          dragHandle={dragHandle}
        />
      );
    }
    case "sprint_board": {
      const items = dataItems[widget.sourceId ?? ""] ?? [];
      const error = widget.sourceId ? sourceErrors[widget.sourceId] : undefined;
      return (
        <SprintBoardWidget
          widget={widget}
          items={items}
          error={error}
          isLoading={isLoading}
          onRemove={onRemove}
          onRefresh={onRefresh}
          dragHandle={dragHandle}
        />
      );
    }
    case "today_overview": {
      // Aggregate all data items across all sources
      const allItems = Object.values(dataItems).flat();
      return (
        <TodayOverviewWidget
          widget={widget}
          items={allItems}
          isLoading={isLoading}
          onRemove={onRemove}
          onRefresh={onRefresh}
          dragHandle={dragHandle}
        />
      );
    }
    default: {
      return (
        <div className="border border-dashed border-[var(--color-border)] rounded-2xl flex items-center justify-center h-full text-[var(--color-muted-foreground)] text-sm">
          未知类型
        </div>
      );
    }
  }
}
