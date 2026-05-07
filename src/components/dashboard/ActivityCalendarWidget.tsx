import React from "react";
import { Calendar, Flame, TrendingUp } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import type { Widget } from "../../types";
import { apiFetchContributions, type ContributionsDay } from "../../lib/api";

// ─── Color scales for heatmap ────────────────────────────────────────────────

const HEAT_COLORS_DARK = [
  "oklch(0.18 0 0)",       // 0 - empty
  "oklch(0.45 0.14 150)",  // 1 - light green
  "oklch(0.55 0.15 155)",  // 2 - medium green
  "oklch(0.65 0.16 150)",  // 3 - bright green
  "oklch(0.78 0.17 148)",  // 4 - intense green
];

const HEAT_COLORS_LIGHT = [
  "oklch(0.93 0 0)",       // 0 - empty
  "oklch(0.72 0.12 150)",  // 1
  "oklch(0.58 0.14 155)",  // 2
  "oklch(0.48 0.15 150)",  // 3
  "oklch(0.38 0.16 148)",  // 4
];

const MONTH_LABELS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const DAY_LABELS = ["日", "", "二", "", "四", "", "六"];

interface ActivityCalendarWidgetProps {
  widget: Widget;
  error?: string;
  isLoading?: boolean;
  onRemove: () => void;
  onRefresh?: () => void;
  dragHandle?: React.ReactNode;
}

export function ActivityCalendarWidget({
  widget,
  error: externalError,
  isLoading,
  onRemove,
  onRefresh,
  dragHandle,
}: ActivityCalendarWidgetProps) {
  const [data, setData] = React.useState<ContributionsDay[]>([]);
  const [total, setTotal] = React.useState(0);
  const [streak, setStreak] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = React.useState<ContributionsDay | null>(null);
  const [isDark, setIsDark] = React.useState(true);

  // Detect theme
  React.useEffect(() => {
    const checkTheme = () => {
      const el = document.documentElement;
      const theme = el.getAttribute("data-theme");
      if (theme === "light") {
        setIsDark(false);
      } else if (theme === "dark") {
        setIsDark(true);
      } else {
        setIsDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
      }
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const username = (widget.config?.username as string) || undefined;
      const result = await apiFetchContributions(username);
      setData(result.days);
      setTotal(result.total);
      setStreak(result.streak);
    } catch (e: any) {
      setError(e?.toString() ?? "获取贡献数据失败");
    } finally {
      setLoading(false);
    }
  }, [widget.config?.username]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build grid: 53 weeks (columns) × 7 days (rows)
  const weeks = React.useMemo(() => {
    if (data.length === 0) return [];

    // data is 365 days, ordered oldest first
    // GitHub-style: columns are weeks (Sun-Sat), rows are days
    const result: ContributionsDay[][] = [];
    let currentWeek: ContributionsDay[] = [];

    // Pad the first week so it starts on Sunday
    const firstDay = new Date(data[0].date);
    const firstDow = firstDay.getDay(); // 0=Sun
    for (let i = 0; i < firstDow; i++) {
      currentWeek.push({ date: "", count: 0, level: 0 });
    }

    for (const day of data) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }
    }
    // Pad last week
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: "", count: 0, level: 0 });
      }
      result.push(currentWeek);
    }

    return result;
  }, [data]);

  // Calculate month labels positions
  const monthPositions = React.useMemo(() => {
    const positions: { label: string; col: number }[] = [];
    let lastMonth = -1;

    weeks.forEach((week, col) => {
      // Find the first non-empty day in this week
      for (const day of week) {
        if (day.date) {
          const month = new Date(day.date).getMonth();
          if (month !== lastMonth) {
            positions.push({ label: MONTH_LABELS[month], col });
            lastMonth = month;
          }
          break;
        }
      }
    });

    return positions;
  }, [weeks]);

  const colors = isDark ? HEAT_COLORS_DARK : HEAT_COLORS_LIGHT;

  // Year total / this week
  const thisWeek = React.useMemo(() => {
    if (weeks.length < 2) return 0;
    return weeks[weeks.length - 1].reduce((s, d) => s + d.count, 0);
  }, [weeks]);

  return (
    <WidgetCard
      widget={widget}
      title="贡献热力图"
      icon={<Calendar className="w-4 h-4" />}
      badge={total > 0 ? `${total} 次` : undefined}
      badgeVariant="success"
      isLoading={loading}
      onRemove={onRemove}
      onRefresh={fetchData}
      dragHandle={dragHandle}
      className="[grid-column:span_2]"
    >
      <div className="p-4 space-y-3">
        {(error ?? externalError) ? (
          <div className="text-sm text-red-400 text-center py-4">
            <p>⚠️ {error ?? externalError}</p>
            <button
              onClick={fetchData}
              className="text-xs underline mt-2 hover:text-red-300 cursor-pointer"
            >
              重试
            </button>
          </div>
        ) : weeks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[var(--color-muted-foreground)] text-sm">
            <Calendar className="w-8 h-8 mb-2 opacity-30" />
            暂无贡献数据
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-[var(--color-muted-foreground)]">连续</span>
                <span className="font-semibold text-[var(--color-foreground)]">{streak} 天</span>
              </div>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                <span className="text-[var(--color-muted-foreground)]">本周</span>
                <span className="font-semibold text-[var(--color-foreground)]">{thisWeek} 次</span>
              </div>
            </div>

            {/* Heatmap grid */}
            <div className="relative overflow-x-auto">
              {/* Month labels */}
              <div className="flex text-[9px] text-[var(--color-muted-foreground)] mb-1 ml-[22px]">
                {monthPositions.map(({ label, col }, i) => (
                  <span
                    key={i}
                    className="flex-shrink-0"
                    style={{
                      position: "relative",
                      left: `${col * 13}px`,
                      width: 0,
                      overflow: "visible",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>

              <div className="flex gap-[2px]">
                {/* Day labels */}
                <div className="flex flex-col gap-[2px] mr-1 flex-shrink-0">
                  {DAY_LABELS.map((label, i) => (
                    <div
                      key={i}
                      className="w-[18px] h-[11px] flex items-center text-[9px] text-[var(--color-muted-foreground)]"
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Heatmap cells */}
                <div className="flex gap-[2px]">
                  {weeks.map((week, col) => (
                    <div key={col} className="flex flex-col gap-[2px]">
                      {week.map((day, row) => (
                        <div
                          key={`${col}-${row}`}
                          className="w-[11px] h-[11px] rounded-[2px] cursor-pointer transition-all hover:ring-1 hover:ring-[var(--color-foreground)]/30"
                          style={{
                            backgroundColor: day.date
                              ? colors[Math.min(day.level, 4)]
                              : "transparent",
                          }}
                          onMouseEnter={() => day.date && setHoveredDay(day)}
                          onMouseLeave={() => setHoveredDay(null)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-end gap-1 mt-2 text-[9px] text-[var(--color-muted-foreground)]">
                <span>少</span>
                {colors.map((color, i) => (
                  <div
                    key={i}
                    className="w-[11px] h-[11px] rounded-[2px]"
                    style={{ backgroundColor: color }}
                  />
                ))}
                <span>多</span>
              </div>
            </div>

            {/* Tooltip */}
            {hoveredDay && hoveredDay.date && (
              <div className="text-[10px] text-[var(--color-muted-foreground)] mt-1 h-4">
                {hoveredDay.date}：{hoveredDay.count} 次贡献
              </div>
            )}
          </>
        )}
      </div>
    </WidgetCard>
  );
}
