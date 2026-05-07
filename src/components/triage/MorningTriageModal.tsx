import { useState, useEffect, useCallback } from "react";
import {
  GitPullRequest,
  CircleDot,
  Bell,
  AlertCircle,
  Check,
  X,
  ExternalLink,
  Clock,
  SkipForward,
  MessageSquare,
  GitMerge,
  ThumbsUp,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
// import { ScrollArea } from "../ui/scroll-area";
import { invoke } from "@tauri-apps/api/core";

// ─── Types ───────────────────────────────────────────────────────────────────

type TriageItemKind = "review_requested" | "assigned_issue" | "assigned_mr" | "notification" | "ci_failure";

interface TriageItem {
  id: string;
  kind: TriageItemKind;
  title: string;
  source: string;
  url?: string;
  priority: number;
  waiting_hours: number;
  metadata: {
    repo?: string;
    author?: string;
    labels?: string[];
    search_source?: string;
  };
}

// ─── Icon Map ────────────────────────────────────────────────────────────────

const kindIcons: Record<TriageItemKind, React.ReactNode> = {
  review_requested: <GitPullRequest className="w-5 h-5 text-orange-500" />,
  assigned_issue: <CircleDot className="w-5 h-5 text-green-500" />,
  assigned_mr: <GitPullRequest className="w-5 h-5 text-blue-500" />,
  notification: <Bell className="w-5 h-5 text-gray-500" />,
  ci_failure: <AlertCircle className="w-5 h-5 text-red-500" />,
};

const kindLabels: Record<TriageItemKind, string> = {
  review_requested: "需要审查",
  assigned_issue: "分配给我",
  assigned_mr: "MR 待处理",
  notification: "通知",
  ci_failure: "CI 失败",
};

// ─── Priority Color ──────────────────────────────────────────────────────────

function priorityColor(priority: number): string {
  if (priority >= 200) return "bg-red-100 text-red-800 border-red-200";
  if (priority >= 150) return "bg-orange-100 text-orange-800 border-orange-200";
  if (priority >= 100) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-blue-100 text-blue-800 border-blue-200";
}

function priorityLabel(priority: number): string {
  if (priority >= 200) return "P0-紧急";
  if (priority >= 150) return "P1-重要";
  if (priority >= 100) return "P2-普通";
  return "P3-低优";
}

// ─── Component ───────────────────────────────────────────────────────────────

interface MorningTriageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MorningTriageModal({ isOpen, onClose }: MorningTriageModalProps) {
  const [items, setItems] = useState<TriageItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Load triage queue
  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const queue = await invoke<TriageItem[]>("get_triage_queue");
      setItems(queue);
      if (queue.length > 0) setSelectedIndex(0);
    } catch (err) {
      console.error("[DevDash] Failed to load triage queue:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) loadQueue();
  }, [isOpen, loadQueue]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Escape":
          onClose();
          break;
        case "o":
          e.preventDefault();
          openCurrentItem();
          break;
        case "a":
          e.preventDefault();
          performAction("approve");
          break;
        case "m":
          e.preventDefault();
          performAction("merge");
          break;
        case "s":
          e.preventDefault();
          performAction("skip");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, items, selectedIndex]);

  const openCurrentItem = () => {
    const item = items[selectedIndex];
    if (item?.url) {
      window.open(item.url, "_blank");
    }
  };

  const performAction = async (action: string) => {
    const item = items[selectedIndex];
    if (!item) return;

    try {
      await invoke("triage_action", { itemId: item.id, action });
      setActionFeedback(`${action === "skip" ? "已跳过" : action === "approve" ? "已批准" : "已处理"}: ${item.title.slice(0, 30)}...`);
      setTimeout(() => setActionFeedback(null), 2000);

      // Remove item from queue
      setItems((prev) => prev.filter((_, i) => i !== selectedIndex));
      if (selectedIndex >= items.length - 1) {
        setSelectedIndex(Math.max(0, items.length - 2));
      }
    } catch (err) {
      console.error("[DevDash] Action failed:", err);
    }
  };

  const selectedItem = items[selectedIndex];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity"
          onClick={onClose}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-blue-500" />
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    晨间处理
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {items.length} 个待办事项 · 使用 J/K 导航，A/M/S/O 操作
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Action Feedback */}
            {actionFeedback && (
              <div className="bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 px-6 py-2 text-sm animate-pulse">
                {actionFeedback}
              </div>
            )}

            {/* Content */}
            {loading ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-gray-500">
                <Check className="w-12 h-12 mb-4 text-green-500" />
                <p className="text-lg font-medium">全部处理完毕！</p>
                <p className="text-sm mt-1">没有需要处理的待办事项</p>
              </div>
            ) : (
              <div className="flex-1 flex overflow-hidden">
                {/* List */}
                <div className="flex-1 overflow-y-auto">
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {items.map((item, index) => (
                      <div
                        key={item.id}
                        className={`px-6 py-4 cursor-pointer transition-colors animate-fadeIn ${
                          index === selectedIndex
                            ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800/50 border-l-4 border-transparent"
                        }`}
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => setSelectedIndex(index)}
                      >
                        <div className="flex items-start gap-4">
                          <div className="mt-0.5">{kindIcons[item.kind]}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant="outline"
                                className={`text-xs ${priorityColor(item.priority)}`}
                              >
                                {priorityLabel(item.priority)}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {kindLabels[item.kind]}
                              </span>
                              {item.waiting_hours > 24 && (
                                <span className="text-xs text-orange-500">
                                  等待 {Math.floor(item.waiting_hours / 24)} 天
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {item.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                              <span>{item.source}</span>
                              {item.metadata.repo && (
                                <>
                                  <span>·</span>
                                  <span>{item.metadata.repo}</span>
                                </>
                              )}
                              {item.metadata.author && (
                                <>
                                  <span>·</span>
                                  <span>@{item.metadata.author}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detail Panel */}
                {selectedItem && (
                  <div className="w-80 border-l border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2 mb-3">
                      {kindIcons[selectedItem.kind]}
                      <span className="font-medium text-sm">
                        {kindLabels[selectedItem.kind]}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold mb-2 text-gray-900 dark:text-white">
                      {selectedItem.title}
                    </h3>

                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                      <div>来源: {selectedItem.source}</div>
                      {selectedItem.metadata.repo && (
                        <div>仓库: {selectedItem.metadata.repo}</div>
                      )}
                      {selectedItem.metadata.author && (
                        <div>作者: @{selectedItem.metadata.author}</div>
                      )}
                      <div>等待: {selectedItem.waiting_hours} 小时</div>
                      <div>优先级: {selectedItem.priority}</div>
                    </div>

                    {selectedItem.metadata.labels &&
                      selectedItem.metadata.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {selectedItem.metadata.labels.map((label) => (
                            <Badge
                              key={label}
                              variant="secondary"
                              className="text-xs"
                            >
                              {label}
                            </Badge>
                          ))}
                        </div>
                      )}

                    {/* Actions */}
                    <div className="space-y-2">
                      {selectedItem.kind === "review_requested" && (
                        <>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => performAction("approve")}
                          >
                            <ThumbsUp className="w-4 h-4 mr-2" />
                            批准 (A)
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => performAction("request_changes")}
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            请求修改 (R)
                          </Button>
                        </>
                      )}

                      {selectedItem.kind === "assigned_issue" && (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => performAction("close")}
                        >
                          <Check className="w-4 h-4 mr-2" />
                          标记完成 (C)
                        </Button>
                      )}

                      {selectedItem.url && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={openCurrentItem}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          在浏览器打开 (O)
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full"
                        onClick={() => performAction("skip")}
                      >
                        <SkipForward className="w-4 h-4 mr-2" />
                        跳过 (S)
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex gap-4">
                  <span>J/K: 导航</span>
                  <span>Enter: 处理</span>
                  <span>O: 打开</span>
                  <span>S: 跳过</span>
                  <span>Esc: 关闭</span>
                </div>
                <div>
                  {selectedIndex + 1} / {items.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
