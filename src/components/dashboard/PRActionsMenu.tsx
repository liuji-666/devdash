import React, { useState } from "react";
import {
  CheckCircle2,
  GitMerge,
  MessageSquare,
  XCircle,
  UserPlus,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import {
  apiApprovePR,
  apiMergePR,
  apiCommentPR,
  apiClosePR,
  apiRequestReview,
  type PRActionResult,
} from "../../lib/api";

interface PRActionsMenuProps {
  owner: string;
  repo: string;
  prNumber: number;
  status: string;
  onActionComplete?: (result: PRActionResult) => void;
}

type ActionKey = "approve" | "merge" | "comment" | "close" | "request_review";

export function PRActionsMenu({
  owner,
  repo,
  prNumber,
  status,
  onActionComplete,
}: PRActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<ActionKey | null>(null);
  const [lastResult, setLastResult] = useState<PRActionResult | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showReviewers, setShowReviewers] = useState(false);
  const [reviewerInput, setReviewerInput] = useState("");

  const executeAction = async (key: ActionKey, fn: () => Promise<PRActionResult>) => {
    setLoading(key);
    setLastResult(null);
    try {
      const result = await fn();
      setLastResult(result);
      onActionComplete?.(result);
      if (result.success) {
        setTimeout(() => {
          setOpen(false);
          setShowComment(false);
          setShowReviewers(false);
        }, 1500);
      }
    } catch (e: any) {
      setLastResult({ success: false, message: e?.toString() ?? "操作失败", action: key });
    } finally {
      setLoading(null);
    }
  };

  const actions: {
    key: ActionKey;
    label: string;
    icon: React.ReactNode;
    color: string;
    visible: boolean;
    onClick: () => void;
  }[] = [
    {
      key: "approve",
      label: "批准 (Approve)",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      color: "text-green-400",
      visible: status === "open",
      onClick: () => executeAction("approve", () => apiApprovePR(owner, repo, prNumber)),
    },
    {
      key: "merge",
      label: "合并 (Merge)",
      icon: <GitMerge className="w-3.5 h-3.5" />,
      color: "text-purple-400",
      visible: status === "open",
      onClick: () => executeAction("merge", () => apiMergePR(owner, repo, prNumber)),
    },
    {
      key: "comment",
      label: "评论 (Comment)",
      icon: <MessageSquare className="w-3.5 h-3.5" />,
      color: "text-blue-400",
      visible: true,
      onClick: () => setShowComment(true),
    },
    {
      key: "request_review",
      label: "请求审查 (Request Review)",
      icon: <UserPlus className="w-3.5 h-3.5" />,
      color: "text-yellow-400",
      visible: status === "open",
      onClick: () => setShowReviewers(true),
    },
    {
      key: "close",
      label: "关闭 (Close)",
      icon: <XCircle className="w-3.5 h-3.5" />,
      color: "text-red-400",
      visible: status === "open",
      onClick: () => executeAction("close", () => apiClosePR(owner, repo, prNumber)),
    },
  ];

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
          setLastResult(null);
          setShowComment(false);
          setShowReviewers(false);
        }}
        className="p-1 rounded hover:bg-[var(--color-accent)]/50 transition-colors opacity-0 group-hover:opacity-100"
        title="PR 操作"
      >
        <MoreHorizontal className="w-3.5 h-3.5 text-[var(--color-muted-foreground)]" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          {/* Menu */}
          <div className="absolute right-0 top-6 z-50 w-56 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden">
            {/* Result banner */}
            {lastResult && (
              <div
                className={`px-3 py-2 text-xs ${
                  lastResult.success
                    ? "bg-green-500/10 text-green-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                {lastResult.success ? "✓" : "✗"} {lastResult.message}
              </div>
            )}

            {/* Comment input */}
            {showComment ? (
              <div className="p-2 border-b border-[var(--color-border)]">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="输入评论..."
                  className="w-full text-xs bg-[var(--color-background)] border border-[var(--color-border)] rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={3}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (commentText.trim()) {
                        executeAction("comment", () =>
                          apiCommentPR(owner, repo, prNumber, commentText.trim())
                        );
                      }
                    }}
                    disabled={loading === "comment" || !commentText.trim()}
                    className="flex-1 text-xs bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading === "comment" ? (
                      <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                    ) : (
                      "发送"
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowComment(false);
                      setCommentText("");
                    }}
                    className="text-xs px-2 py-1 hover:bg-[var(--color-accent)] rounded"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : null}

            {/* Reviewer input */}
            {showReviewers ? (
              <div className="p-2 border-b border-[var(--color-border)]">
                <input
                  value={reviewerInput}
                  onChange={(e) => setReviewerInput(e.target.value)}
                  placeholder="GitHub 用户名 (逗号分隔)"
                  className="w-full text-xs bg-[var(--color-background)] border border-[var(--color-border)] rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const reviewers = reviewerInput
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      if (reviewers.length > 0) {
                        executeAction("request_review", () =>
                          apiRequestReview(owner, repo, prNumber, reviewers)
                        );
                      }
                    }}
                    disabled={loading === "request_review" || !reviewerInput.trim()}
                    className="flex-1 text-xs bg-yellow-600 text-white rounded px-2 py-1 hover:bg-yellow-700 disabled:opacity-50"
                  >
                    {loading === "request_review" ? (
                      <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                    ) : (
                      "请求"
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowReviewers(false);
                      setReviewerInput("");
                    }}
                    className="text-xs px-2 py-1 hover:bg-[var(--color-accent)] rounded"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : null}

            {/* Action items */}
            {!showComment && !showReviewers && (
              <div className="py-1">
                {actions
                  .filter((a) => a.visible)
                  .map((action) => (
                    <button
                      key={action.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onClick();
                      }}
                      disabled={loading === action.key}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--color-accent)]/50 transition-colors disabled:opacity-50"
                    >
                      {loading === action.key ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-muted-foreground)]" />
                      ) : (
                        <span className={action.color}>{action.icon}</span>
                      )}
                      <span>{action.label}</span>
                    </button>
                  ))}
              </div>
            )}

            {/* PR info */}
            <div className="px-3 py-1.5 text-[10px] text-[var(--color-muted-foreground)] border-t border-[var(--color-border)]">
              {owner}/{repo}#{prNumber}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
