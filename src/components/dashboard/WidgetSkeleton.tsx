import { Skeleton } from "../ui/skeleton"

interface WidgetSkeletonProps {
  variant?: "pr-list" | "issue-list" | "ci-status" | "notifications" | "ai-summary" | "activity-calendar" | "sprint-board" | "default"
}

export function WidgetSkeleton({ variant = "default" }: WidgetSkeletonProps) {
  if (variant === "pr-list" || variant === "issue-list") {
    return (
      <div className="p-4 space-y-3">
        {/* Title */}
        <Skeleton className="h-5 w-32 mb-4" />
        
        {/* List items */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-4 w-4 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-12 rounded-full flex-shrink-0" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === "ci-status") {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-28 mb-4" />
        
        {/* CI runs */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === "notifications") {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-24 mb-4" />
        
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 p-2 rounded-lg bg-[var(--widget-surface)]">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === "ai-summary") {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        
        {/* Summary content */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        
        {/* Tags */}
        <div className="flex gap-2 mt-4">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </div>
    )
  }

  if (variant === "activity-calendar") {
    return (
      <div className="p-4 space-y-3">
        {/* Stats */}
        <div className="flex gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
        {/* Heatmap grid skeleton */}
        <div className="flex gap-[2px]">
          {Array.from({ length: 20 }, (_, col) => (
            <div key={col} className="flex flex-col gap-[2px]">
              {Array.from({ length: 7 }, (_, row) => (
                <Skeleton
                  key={row}
                  className="w-[11px] h-[11px] rounded-[2px]"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (variant === "sprint-board") {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((col) => (
            <div key={col} className="space-y-2">
              <Skeleton className="h-3 w-12" />
              {[1, 2].map((row) => (
                <div key={row} className="p-2 rounded-lg bg-[var(--color-accent)]/20">
                  <Skeleton className="h-3 w-10 mb-1" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Default skeleton
  return (
    <div className="p-4 space-y-3">
      <Skeleton className="h-5 w-32 mb-4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
        {/* PR List */}
        <div className="col-span-1 row-span-1 bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)]">
          <WidgetSkeleton variant="pr-list" />
        </div>
        
        {/* Issue List */}
        <div className="col-span-1 row-span-1 bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)]">
          <WidgetSkeleton variant="issue-list" />
        </div>
        
        {/* CI Status */}
        <div className="col-span-1 row-span-1 bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)]">
          <WidgetSkeleton variant="ci-status" />
        </div>
        
        {/* AI Summary */}
        <div className="col-span-1 md:col-span-2 row-span-1 bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)]">
          <WidgetSkeleton variant="ai-summary" />
        </div>
      </div>
    </div>
  )
}

export function SidebarSkeleton() {
  return (
    <div className="w-60 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] p-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-5 w-20" />
      </div>
      
      {/* Navigation */}
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
      
      {/* Bottom section */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="flex items-center gap-3 p-2 rounded-lg">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  )
}
