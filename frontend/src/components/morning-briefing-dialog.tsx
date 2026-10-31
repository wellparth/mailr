"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  SunMedium,
  AlertCircle,
  Calendar,
  Clock,
  ArrowRight,
  Send,
  Sparkles,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface MorningBriefingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectThread: (threadId: string) => void;
  onOpenComposerWithDraft?: (draftText: string, subject: string, to: string) => void;
}

export function MorningBriefingDialog({
  open,
  onOpenChange,
  onSelectThread,
  onOpenComposerWithDraft,
}: MorningBriefingDialogProps) {
  const [briefing, setBriefing] = React.useState<any>(null);
  const [followUps, setFollowUps] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<"briefing" | "followups">("briefing");

  React.useEffect(() => {
    if (open) {
      setLoading(true);
      Promise.all([
        apiFetch("/api/agent/briefing").catch(() => null),
        apiFetch("/api/agent/follow-ups").catch(() => null),
      ])
        .then(([bRes, fRes]) => {
          if (bRes) setBriefing(bRes);
          if (fRes && fRes.suggestions) setFollowUps(fRes.suggestions);
        })
        .finally(() => setLoading(false));
    }
  }, [open]);

  const todayFormatted = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl shadow-2xl flex flex-col">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-blue-500/20 border-b border-slate-800 p-6 pb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                <SunMedium className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight">Executive Morning Briefing</DialogTitle>
                <p className="text-xs text-slate-400">{todayFormatted} • AI Synthesis</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-800/80 rounded-lg border border-slate-700/60 text-xs">
              <button
                onClick={() => setActiveTab("briefing")}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  activeTab === "briefing"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Briefing
              </button>
              <button
                onClick={() => setActiveTab("followups")}
                className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === "followups"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Follow-ups
                {followUps.length > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-blue-500/40 text-blue-100 font-bold">
                    {followUps.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* AI Executive Summary Card */}
          <div className="p-3.5 bg-slate-950/50 border border-amber-500/20 rounded-xl text-xs text-slate-200 leading-relaxed flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              {loading ? (
                <div className="animate-pulse space-y-1.5 py-1">
                  <div className="h-2.5 bg-slate-700/60 rounded w-5/6"></div>
                  <div className="h-2.5 bg-slate-700/60 rounded w-4/6"></div>
                </div>
              ) : (
                briefing?.summary || "Good morning! Your inbox is organized and ready for the day."
              )}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400 animate-pulse">
              Generating your briefing and scanning follow-ups...
            </div>
          ) : activeTab === "briefing" ? (
            <>
              {/* Stat Metric Pills */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider mb-1">
                    Urgent Matters
                  </div>
                  <div className="text-2xl font-bold text-rose-200">
                    {briefing?.urgentCount || 0}
                  </div>
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <div className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider mb-1">
                    Meetings Today
                  </div>
                  <div className="text-2xl font-bold text-blue-200">
                    {briefing?.meetingsCount || 0}
                  </div>
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-1">
                    Awaiting Replies
                  </div>
                  <div className="text-2xl font-bold text-amber-200">
                    {followUps.length}
                  </div>
                </div>
              </div>

              {/* Urgent Priorities Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    Top Priority Inquiries
                  </h3>
                </div>

                {(!briefing?.urgentPriorities || briefing.urgentPriorities.length === 0) ? (
                  <div className="p-4 bg-slate-800/30 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
                    No urgent unread emails detected. Inbox is healthy!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {briefing.urgentPriorities.map((item: any) => (
                      <div
                        key={item.id}
                        className="p-3.5 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/60 rounded-xl flex items-center justify-between gap-4 transition-all group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-rose-400 px-1.5 py-0.5 rounded bg-rose-500/20">
                              {item.priorityLevel}
                            </span>
                            <span className="text-xs font-semibold text-slate-200 truncate">
                              {item.sender}
                            </span>
                          </div>
                          <div className="text-xs font-medium text-slate-300 truncate">
                            {item.subject}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {item.snippet}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            onSelectThread(item.id);
                            onOpenChange(false);
                          }}
                          className="shrink-0 h-8 gap-1.5 text-xs bg-slate-700/60 hover:bg-slate-700 text-slate-200"
                        >
                          View
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Today's Meetings */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  Today's Schedule & Meetings
                </h3>

                {(!briefing?.todaysMeetings || briefing.todaysMeetings.length === 0) ? (
                  <div className="p-4 bg-slate-800/30 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
                    No meetings scheduled on your calendar today. Enjoy the focus time!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {briefing.todaysMeetings.map((m: any) => (
                      <div
                        key={m.id}
                        className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-semibold text-slate-200">{m.title}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(m.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                          {m.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Smart Follow-Ups Tab */
            <div className="space-y-3">
              <div className="text-xs text-slate-400 mb-2">
                Mailr automatically identifies outbound emails where you asked a question or sent a proposal and have received no reply after 2+ days.
              </div>

              {followUps.length === 0 ? (
                <div className="p-8 bg-slate-800/30 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                  No outstanding follow-ups required right now. All conversations are up to date!
                </div>
              ) : (
                followUps.map((item) => (
                  <div
                    key={item.threadId}
                    className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-slate-200">{item.subject}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Sent to <span className="text-blue-300 font-medium">{item.recipient}</span> • {item.daysAgo} days ago with no reply
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded">
                        {item.daysAgo}d ago
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-300 font-mono text-[11px] whitespace-pre-wrap">
                      {item.suggestedFollowUp}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          onSelectThread(item.threadId);
                          onOpenChange(false);
                        }}
                        className="h-8 text-xs text-slate-400 hover:text-slate-200"
                      >
                        View Thread
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (onOpenComposerWithDraft) {
                            onOpenComposerWithDraft(
                              item.suggestedFollowUp,
                              `Re: ${item.subject}`,
                              item.recipient
                            );
                            onOpenChange(false);
                          }
                        }}
                        className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white gap-1.5 shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" />
                        1-Click Follow Up
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
