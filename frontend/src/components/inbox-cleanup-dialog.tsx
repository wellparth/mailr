"use client";

import * as React from "react";
import {
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  Archive,
  Trash2,
  RefreshCw,
  BellOff,
  ExternalLink,
  ShieldCheck,
  Bot,
  Receipt,
  Zap,
  Mail,
  ChevronRight,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface CleanupSuggestion {
  id: string;
  type: "UNSUBSCRIBE" | "ARCHIVE_NO_REPLY" | "ARCHIVE_PROMOS" | "REVIEW_REPLIES";
  title: string;
  description: string;
  badge: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  affectedCount: number;
  threadIds: string[];
  senderEmail?: string;
  unsubscribeUrl?: string;
  actionText: string;
}

interface InboxHealthReport {
  accountId: string;
  accountEmail: string;
  healthScore: number;
  totalInboxThreads: number;
  unnecessaryCount: number;
  breakdown: {
    actionRequired: number;
    usefulTransactional: number;
    automatedNoReply: number;
    newsletters: number;
    promotional: number;
    spam: number;
    primary: number;
  };
  suggestions: CleanupSuggestion[];
}

interface InboxCleanupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Array<{ id: string; emailAddress: string; displayName?: string; colorCode?: string }>;
  initialAccountId?: string;
  onInboxCleaned?: () => void;
}

export function InboxCleanupDialog({
  open,
  onOpenChange,
  accounts,
  initialAccountId = "all",
  onInboxCleaned,
}: InboxCleanupDialogProps) {
  const [selectedAccountId, setSelectedAccountId] = React.useState<string>(initialAccountId);
  const [report, setReport] = React.useState<InboxHealthReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [auditing, setAuditing] = React.useState(false);
  const [executingId, setExecutingId] = React.useState<string | null>(null);
  const [completedActions, setCompletedActions] = React.useState<Set<string>>(new Set());
  const [statusNotice, setStatusNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSelectedAccountId(initialAccountId);
  }, [initialAccountId]);

  const fetchHealthReport = React.useCallback(async (accId: string) => {
    try {
      setLoading(true);
      const url = accId && accId !== "all" ? `/api/ai/inbox/health?accountId=${accId}` : "/api/ai/inbox/health";
      const res: any = await apiFetch(url);
      if (res?.report) {
        setReport(res.report);
      }
    } catch (err: any) {
      console.warn("Failed to load inbox health report", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      fetchHealthReport(selectedAccountId);
    }
  }, [open, selectedAccountId, fetchHealthReport]);

  const handleRunAudit = async () => {
    try {
      setAuditing(true);
      const res: any = await apiFetch("/api/ai/inbox/audit-now", { method: "POST" });
      setStatusNotice(
        res?.classifiedCount > 0
          ? `AI Agent classified & updated ${res.classifiedCount} thread(s).`
          : "All inbox threads are up-to-date."
      );
      setTimeout(() => setStatusNotice(null), 4000);
      await fetchHealthReport(selectedAccountId);
      onInboxCleaned?.();
    } catch (err: any) {
      console.error("Audit error", err);
    } finally {
      setAuditing(false);
    }
  };

  const handleExecuteSuggestion = async (suggestion: CleanupSuggestion) => {
    try {
      setExecutingId(suggestion.id);
      let action: "UNSUBSCRIBE_AND_ARCHIVE" | "ARCHIVE" | "TRASH" = "ARCHIVE";
      if (suggestion.type === "UNSUBSCRIBE") {
        action = "UNSUBSCRIBE_AND_ARCHIVE";
      }

      const res: any = await apiFetch("/api/ai/inbox/cleanup/execute", {
        method: "POST",
        body: JSON.stringify({
          action,
          threadIds: suggestion.threadIds,
          unsubscribeUrl: suggestion.unsubscribeUrl,
        }),
      });

      // If there's an unsubscribe web URL, open it in background or new tab
      if (res?.unsubscribeUrl && /^https?:\/\//i.test(res.unsubscribeUrl)) {
        window.open(res.unsubscribeUrl, "_blank", "noopener,noreferrer");
      }

      setCompletedActions((prev) => new Set(prev).add(suggestion.id));
      setStatusNotice(res?.message || `Cleaned ${suggestion.affectedCount} thread(s).`);
      setTimeout(() => setStatusNotice(null), 4000);

      // Re-fetch report and trigger parent inbox refresh
      await fetchHealthReport(selectedAccountId);
      onInboxCleaned?.();
    } catch (err: any) {
      console.error("Clean-up execution error", err);
      alert("Failed to apply clean-up: " + (err.message || "Unknown error"));
    } finally {
      setExecutingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border shadow-2xl p-0 overflow-hidden sm:rounded-2xl">
        {/* Header */}
        <div className="p-5 border-b border-border/60 bg-gradient-to-r from-sky-950/30 via-card to-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                AI Inbox Clean-up &amp; Optimization
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Autonomous server agent audits and flags no-reply bots, useful receipts, and newsletters 24/7.
              </DialogDescription>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRunAudit}
            disabled={auditing}
            className="h-8 text-xs gap-1.5 border-border text-foreground hover:bg-secondary cursor-pointer shrink-0"
            title="Force immediate AI scan of all unclassified emails"
          >
            <RefreshCw className={cn("h-3 w-3", auditing && "animate-spin text-sky-400")} />
            <span>{auditing ? "Scanning..." : "Re-Audit Inbox"}</span>
          </Button>
        </div>

        {/* Status Toast */}
        {statusNotice && (
          <div className="px-5 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>{statusNotice}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Inbox Switcher Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedAccountId("all")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer border",
                selectedAccountId === "all"
                  ? "bg-secondary text-foreground border-border shadow-xs"
                  : "text-muted-foreground hover:text-foreground border-transparent hover:bg-secondary/40"
              )}
            >
              <Layers className="h-3.5 w-3.5 text-sky-400" />
              <span>Unified Inbox ({accounts.length})</span>
            </button>

            {accounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => setSelectedAccountId(acc.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer border truncate max-w-[200px]",
                  selectedAccountId === acc.id
                    ? "bg-secondary text-foreground border-border shadow-xs"
                    : "text-muted-foreground hover:text-foreground border-transparent hover:bg-secondary/40"
                )}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: acc.colorCode || "#38bdf8" }}
                />
                <span className="truncate">{acc.displayName || acc.emailAddress}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-sky-400" />
              <p className="text-xs">Analyzing inbox health &amp; email categories...</p>
            </div>
          ) : report ? (
            <>
              {/* Health Score & Overview Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl border border-border/80 bg-secondary/20">
                <div className="flex flex-col justify-center">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Inbox Health Score
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span
                      className={cn(
                        "text-3xl font-extrabold",
                        report.healthScore >= 80
                          ? "text-emerald-400"
                          : report.healthScore >= 50
                          ? "text-amber-400"
                          : "text-rose-400"
                      )}
                    >
                      {report.healthScore}%
                    </span>
                    <span className="text-xs text-muted-foreground">Cleanliness</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {report.unnecessaryCount} low-value email(s) taking up inbox space.
                  </p>
                </div>

                <div className="sm:col-span-2 grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-lg bg-card border border-border/50 flex flex-col">
                    <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                      <Zap className="h-3 w-3" /> Action Needed
                    </span>
                    <span className="text-lg font-bold text-foreground mt-0.5">
                      {report.breakdown.actionRequired}
                    </span>
                    <span className="text-[9px] text-muted-foreground">Awaiting reply</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-card border border-border/50 flex flex-col">
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                      <Receipt className="h-3 w-3" /> Useful Receipts
                    </span>
                    <span className="text-lg font-bold text-foreground mt-0.5">
                      {report.breakdown.usefulTransactional}
                    </span>
                    <span className="text-[9px] text-muted-foreground">2FA &amp; orders</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-card border border-border/50 flex flex-col">
                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                      <Bot className="h-3 w-3" /> No-Reply Noise
                    </span>
                    <span className="text-lg font-bold text-foreground mt-0.5">
                      {report.breakdown.automatedNoReply}
                    </span>
                    <span className="text-[9px] text-muted-foreground">Safe to archive</span>
                  </div>
                </div>
              </div>

              {/* Suggestions List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                    AI Agent Recommendations ({report.suggestions.length})
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Targeting: {report.accountEmail}
                  </span>
                </div>

                {report.suggestions.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground rounded-xl border border-dashed border-border/60 bg-secondary/10 p-6">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-xs font-medium text-foreground">Inbox is Pristine!</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs mx-auto">
                      No automated noise, stale promotional emails, or unmanaged newsletters detected in this inbox.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {report.suggestions.map((sugg) => {
                      const isCompleted = completedActions.has(sugg.id);
                      const isExecuting = executingId === sugg.id;

                      return (
                        <div
                          key={sugg.id}
                          className={cn(
                            "p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                            isCompleted
                              ? "bg-secondary/10 border-border/40 opacity-60"
                              : "bg-card hover:bg-secondary/20 border-border"
                          )}
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="p-2 rounded-lg bg-secondary text-foreground shrink-0 mt-0.5">
                              {sugg.type === "UNSUBSCRIBE" && <BellOff className="h-4 w-4 text-rose-400" />}
                              {sugg.type === "ARCHIVE_NO_REPLY" && <Bot className="h-4 w-4 text-slate-400" />}
                              {sugg.type === "ARCHIVE_PROMOS" && <Archive className="h-4 w-4 text-purple-400" />}
                              {sugg.type === "REVIEW_REPLIES" && <Zap className="h-4 w-4 text-amber-400" />}
                            </div>

                            <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-foreground truncate">
                                  {sugg.title}
                                </span>
                                <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4 font-normal">
                                  {sugg.badge}
                                </Badge>
                                {sugg.unsubscribeUrl && (
                                  <span className="text-[9px] text-emerald-400 flex items-center gap-0.5">
                                    <ExternalLink className="h-2.5 w-2.5" /> 1-Click Unsubscribe
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                                {sugg.description}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 sm:self-center">
                            {isCompleted ? (
                              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Cleaned
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant={sugg.type === "UNSUBSCRIBE" ? "destructive" : "secondary"}
                                onClick={() => handleExecuteSuggestion(sugg)}
                                disabled={isExecuting}
                                className={cn(
                                  "h-8 text-xs font-medium cursor-pointer shadow-xs gap-1.5",
                                  sugg.type === "UNSUBSCRIBE" && "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30"
                                )}
                              >
                                {isExecuting ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : sugg.type === "UNSUBSCRIBE" ? (
                                  <BellOff className="h-3 w-3" />
                                ) : (
                                  <Archive className="h-3 w-3" />
                                )}
                                <span>{isExecuting ? "Cleaning..." : sugg.actionText}</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
