"use client";

import * as React from "react";
import {
  Sparkles,
  X,
  Send,
  Calendar,
  FileText,
  Mail,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Bot,
  User as UserIcon,
  CheckSquare,
  Square,
  Download,
  Settings,
  Link as LinkIcon,
  GripVertical,
  CheckCircle2,
  AlertTriangle,
  Search,
  Wrench,
  Clock,
  ShieldAlert,
  Trash2,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ActionItem {
  task: string;
  assignee?: string;
  deadline?: string;
  completed?: boolean;
}

export interface ToolStep {
  tool: string;
  summary: string;
  status: "completed" | "failed";
  resultPreview?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionType?:
    | "NOTES_GENERATED"
    | "DRAFT_CREATED"
    | "MEETING_SCHEDULED"
    | "TRIAGE_EXECUTED"
    | "EMAIL_COMPOSED"
    | "EMAILS_FOUND"
    | "CALENDAR_ALIGNED"
    | "EMAILS_CLASSIFIED"
    | "GENERAL_REPLY";
  actionPayload?: any;
  toolSteps?: ToolStep[];
  createdAt?: string;
}

interface AICopilotDrawerProps {
  open: boolean;
  onClose: () => void;
  activeThread: any | null;
  onInsertDraftToComposer: (draftText: string, subject?: string, recipientEmail?: string) => void;
  onOpenNotesTab?: () => void;
  onOpenSettings?: () => void;
  onSelectThread?: (threadId: string) => void;
  onEmailSent?: () => void;
}

export function AICopilotDrawer({
  open,
  onClose,
  activeThread,
  onInsertDraftToComposer,
  onOpenNotesTab,
  onOpenSettings,
  onSelectThread,
  onEmailSent,
}: AICopilotDrawerProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I am your autonomous Mailr Copilot. I can draft responses, synthesize long email threads into executive notes, manage your calendar bookings (Google, Outlook, Cal.com), or organize your inbox. How can I help you?",
    },
  ]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [byokInfo, setByokInfo] = React.useState<{ provider: string; model?: string; hasCustomKey: boolean } | null>(null);
  const [cleaningCategory, setCleaningCategory] = React.useState<string | null>(null);

  // Resizable width state (persisted in localStorage)
  const [copilotWidth, setCopilotWidth] = React.useState<number>(380);
  const [isDragging, setIsDragging] = React.useState(false);

  // Restore saved width from localStorage
  React.useEffect(() => {
    try {
      const savedWidth = localStorage.getItem("mailr_copilot_width");
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= 300 && parsed <= 750) {
          setCopilotWidth(parsed);
        }
      }
    } catch {}
  }, []);

  const handleWidthChange = React.useCallback((width: number) => {
    setCopilotWidth(width);
    try {
      localStorage.setItem("mailr_copilot_width", String(width));
    } catch {}
  }, []);

  // Resize handler for AI Copilot (left draggable border)
  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startWidth = copilotWidth;

      setIsDragging(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        // Since Copilot is docked to the right, dragging left increases width
        const delta = startX - moveEvent.clientX;
        const minWidth = 300;
        const maxWidth = Math.max(minWidth, Math.min(680, window.innerWidth - 380));
        const newWidth = Math.min(Math.max(startWidth + delta, minWidth), maxWidth);
        handleWidthChange(newWidth);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.body.style.removeProperty("cursor");
        document.body.style.removeProperty("user-select");
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [copilotWidth, handleWidthChange]
  );

  const handleDoubleClick = React.useCallback(() => {
    handleWidthChange(380);
  }, [handleWidthChange]);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load BYOK info
  React.useEffect(() => {
    if (open) {
      apiFetch("/api/agent/byok")
        .then((data) => {
          if (data && data.provider) {
            setByokInfo(data);
          }
        })
        .catch(() => {});
    }
  }, [open]);

  // Load chat history for the active thread
  React.useEffect(() => {
    if (open && activeThread) {
      apiFetch(`/api/agent/history/${activeThread.id}`)
        .then((res) => {
          if (res && res.messages && res.messages.length > 0) {
            setMessages(res.messages);
          }
        })
        .catch(() => {});
    }
  }, [open, activeThread?.id]);

  const [sendingCardId, setSendingCardId] = React.useState<string | null>(null);
  const isSendingDraftRef = React.useRef<boolean>(false);
  const [editingMeetingMsgId, setEditingMeetingMsgId] = React.useState<string | null>(null);
  const [customMeetingTime, setCustomMeetingTime] = React.useState<string>("");
  const [customDuration, setCustomDuration] = React.useState<number>(30);
  const [showCustomSlotInput, setShowCustomSlotInput] = React.useState<boolean>(false);
  const [manualSlotInput, setManualSlotInput] = React.useState<string>("");

  const handleSendDraftNow = async (draftData: any, msgId: string) => {
    if (isSendingDraftRef.current || sendingCardId !== null) return;
    try {
      isSendingDraftRef.current = true;
      setSendingCardId(msgId);
      const recipient = draftData.recipientEmail || draftData.to;
      const subject = draftData.subject || "No Subject";
      const bodyText = draftData.draft || draftData.body || "";

      await apiFetch("/api/messages/send", {
        method: "POST",
        body: JSON.stringify({
          accountId: draftData.accountId,
          to: recipient,
          subject,
          bodyText,
          threadId: draftData.threadId,
        }),
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                actionPayload: {
                  ...m.actionPayload,
                  draftResult: {
                    ...(m.actionPayload?.draftResult || {}),
                    sent: true,
                  },
                },
              }
            : m
        )
      );

      onEmailSent?.();
    } catch (err: any) {
      alert("Failed to dispatch email: " + (err.message || "Unknown error"));
    } finally {
      isSendingDraftRef.current = false;
      setSendingCardId(null);
    }
  };

  const handleSaveManualMeeting = (msgId: string, oldMeeting: any) => {
    if (!customMeetingTime) return;
    const newStart = new Date(customMeetingTime);
    if (isNaN(newStart.getTime()) || newStart.getTime() <= Date.now()) {
      alert("Please choose a valid future date and time.");
      return;
    }
    const newEnd = new Date(newStart.getTime() + customDuration * 60 * 1000);
    const formatUrlDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const startIso = formatUrlDate(newStart);
    const endIso = formatUrlDate(newEnd);
    const encodedTitle = encodeURIComponent(oldMeeting.title || "Meeting");
    const encodedDesc = encodeURIComponent(oldMeeting.description || "");

    const updatedMeeting = {
      ...oldMeeting,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
      googleCalendarUrl: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodedTitle}&dates=${startIso}/${endIso}&details=${encodedDesc}`,
      outlookCalendarUrl: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodedTitle}&body=${encodedDesc}&startdt=${encodeURIComponent(newStart.toISOString())}&enddt=${encodeURIComponent(newEnd.toISOString())}`,
      hasConflict: false,
    };

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              actionPayload: {
                ...m.actionPayload,
                meeting: updatedMeeting,
              },
            }
          : m
      )
    );
    setEditingMeetingMsgId(null);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const promptText = (textToSend || input).trim();
    if (!promptText || loading) return;

    setInput("");
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: "user",
      content: promptText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await apiFetch("/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({
          prompt: promptText,
          threadId: activeThread ? activeThread.id : undefined,
        }),
      });

      if (res) {
        const botMsg: ChatMessage = {
          id: `bot_${Date.now()}`,
          role: "assistant",
          content: res.reply || "Done.",
          actionType: res.actionType,
          actionPayload: res.actionPayload,
          toolSteps: res.toolSteps,
        };
        setMessages((prev) => [...prev, botMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: `Sorry, an error occurred: ${err.message || "Failed to process command"}`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchClean = async (category: string, action: "archive" | "trash" | "mark_read") => {
    try {
      setCleaningCategory(category);
      const res = await apiFetch("/api/agent/emails/batch-clean", {
        method: "POST",
        body: JSON.stringify({ category, action }),
      });
      if (res && res.success) {
        const actionVerb = action === "trash" ? "moved to trash" : action === "archive" ? "archived" : "marked as read";
        setMessages((prev) => [
          ...prev,
          {
            id: `clean_${Date.now()}`,
            role: "assistant",
            content: `✨ Successfully ${actionVerb} ${res.count} ${category.replace("_", " ")} email(s). Your inbox has been updated!`,
            toolSteps: [
              {
                tool: "batch_clean_unnecessary_emails",
                summary: `${action.toUpperCase()} operation applied to ${res.count} email(s)`,
                status: "completed",
              },
            ],
          },
        ]);
        onEmailSent?.();
      }
    } catch (err: any) {
      alert("Failed to batch clean emails: " + (err.message || "Unknown error"));
    } finally {
      setCleaningCategory(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!open) return null;

  return (
    <div
      style={{ width: `${copilotWidth}px` }}
      className={cn(
        "relative shrink-0 h-full border-l border-border bg-card/95 backdrop-blur-xl flex flex-col z-20 transition-all duration-200 ease-in-out animate-in slide-in-from-right",
        "max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-50 max-md:!w-full max-md:!max-w-md",
        isDragging && "select-none transition-none"
      )}
    >
      {/* Draggable Vertical Resize Handle (Left edge on desktop) */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        className={cn(
          "absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize z-30 group hidden md:flex items-center justify-center transition-all",
          isDragging && "w-4 -left-2"
        )}
        title="Drag to resize Copilot (Double-click to reset)"
      >
        <div
          className={cn(
            "w-[2px] h-full transition-colors group-hover:bg-emerald-500/60",
            isDragging ? "bg-emerald-500 w-[3px]" : "bg-transparent group-hover:bg-emerald-500/40"
          )}
        />
        {/* Subtle pill indicator at center */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 rounded-full p-0.5 transition-all shadow-sm opacity-0 group-hover:opacity-100",
            isDragging
              ? "opacity-100 bg-emerald-500 text-slate-950 scale-110"
              : "bg-muted border border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-border bg-card/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-foreground">Mailr Copilot</span>
              {byokInfo && (
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase border-border/80 text-muted-foreground">
                    {byokInfo.provider}
                  </Badge>
                  {byokInfo.model && (
                    <span
                      className="text-[9px] text-muted-foreground font-mono truncate max-w-[130px] border border-border/50 px-1 py-0 rounded bg-secondary/50"
                      title={`Active Model: ${byokInfo.model}`}
                    >
                      {byokInfo.model.split("/").pop()}
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate max-w-[220px]">
              {activeThread ? `Context: ${activeThread.subject}` : "All Inboxes Scope"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onOpenSettings && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSettings}
              title="BYOK & AI Provider Settings"
              className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Action Chips Bar */}
      <div className="p-2.5 bg-secondary/30 border-b border-border/50 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
        {activeThread ? (
          <>
            <button
              onClick={() => handleSendMessage("Check if this email is promotional, spam, or unnecessary")}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[11px] font-medium border border-purple-500/30 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              <ShieldAlert className="h-3 w-3 text-purple-400" />
              <span>Check Spam/Promo</span>
            </button>

            <button
              onClick={() => handleSendMessage("Summarize this thread and generate executive notes with action items")}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 hover:bg-secondary text-foreground text-[11px] font-medium border border-border/60 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              <FileText className="h-3 w-3 text-sky-400" />
              <span>Create Notes</span>
            </button>

            <button
              onClick={() => handleSendMessage("Check calendar, detect any conflicts, and schedule a meeting from this email")}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 hover:bg-secondary text-foreground text-[11px] font-medium border border-border/60 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              <Calendar className="h-3 w-3 text-emerald-400" />
              <span>Align & Schedule</span>
            </button>

            <button
              onClick={() => handleSendMessage("Draft a polite and professional follow-up reply")}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 hover:bg-secondary text-foreground text-[11px] font-medium border border-border/60 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              <Mail className="h-3 w-3 text-indigo-400" />
              <span>Draft Reply</span>
            </button>

            <button
              onClick={() => handleSendMessage("Draft a reply offering my calendar booking link")}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 hover:bg-secondary text-foreground text-[11px] font-medium border border-border/60 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              <LinkIcon className="h-3 w-3 text-amber-400" />
              <span>Send Booking Link</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => handleSendMessage("Detect and distinguish promotional, spam, and unnecessary emails in my inbox")}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[11px] font-medium border border-purple-500/30 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              <ShieldAlert className="h-3 w-3 text-purple-400" />
              <span>Clean Promo & Spam</span>
            </button>

            <button
              onClick={() => handleSendMessage("Read all my unread emails and check my calendar to align everything and write a draft")}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-medium border border-emerald-500/30 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              <Sparkles className="h-3 w-3 text-emerald-400" />
              <span>Read Emails & Align Schedule</span>
            </button>

            <button
              onClick={() => handleSendMessage("Check my upcoming calendar events and find all open free slots")}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 hover:bg-secondary text-foreground text-[11px] font-medium border border-border/60 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              <Calendar className="h-3 w-3 text-sky-400" />
              <span>Find Free Slots</span>
            </button>

            <button
              onClick={() => handleSendMessage("Compose a new email draft")}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 hover:bg-secondary text-foreground text-[11px] font-medium border border-border/60 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              <Mail className="h-3 w-3 text-indigo-400" />
              <span>Compose Email</span>
            </button>
          </>
        )}
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div key={msg.id} className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
              {!isUser && (
                <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div className={`space-y-2 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
                {/* Text Bubble */}
                <div
                  className={`p-3 rounded-2xl text-xs leading-relaxed ${
                    isUser
                      ? "bg-sky-600 text-white rounded-br-xs shadow-sm"
                      : "bg-secondary/70 border border-border text-foreground rounded-bl-xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* Autonomous Tool Steps Pill List */}
                {msg.toolSteps && msg.toolSteps.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                      <Sparkles className="h-3 w-3" />
                      <span>Autonomous Actions Executed ({msg.toolSteps.length}):</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {msg.toolSteps.map((step, sIdx) => (
                        <div
                          key={sIdx}
                          className="flex items-center justify-between px-2 py-1 rounded-lg bg-card/60 border border-border/60 text-[10px]"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span className="font-mono text-sky-400 font-semibold">{step.tool}</span>
                            <span className="text-muted-foreground truncate">{step.summary}</span>
                          </div>
                          <span className="text-[9px] px-1.5 py-0 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium shrink-0 ml-1.5">
                            Done
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 1. Interactive Card: Notes Generated */}
                {msg.actionType === "NOTES_GENERATED" && msg.actionPayload?.notes && (
                  <div className="p-3 bg-secondary/40 border border-sky-500/30 rounded-xl space-y-2.5 text-xs text-foreground animate-in fade-in">
                    <div className="flex items-center justify-between font-semibold text-sky-400">
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        Executive Notes Created
                      </span>
                      {onOpenNotesTab && (
                        <button
                          onClick={onOpenNotesTab}
                          className="text-[10px] text-sky-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Open Notes Tab</span>
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-muted-foreground line-clamp-2">{msg.actionPayload.notes.summary}</p>
                    {msg.actionPayload.notes.actionItems?.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-border/40">
                        <span className="text-[11px] font-medium text-foreground">Action Items:</span>
                        {msg.actionPayload.notes.actionItems.slice(0, 3).map((item: ActionItem, i: number) => (
                          <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                            <Square className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="line-clamp-1">{item.task}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Interactive Card: Draft / Composed Email */}
                {(msg.actionType === "DRAFT_CREATED" || msg.actionType === "EMAIL_COMPOSED") && msg.actionPayload?.draftResult && (
                  <div className="p-3 bg-secondary/40 border border-indigo-500/30 rounded-xl space-y-2.5 text-xs text-foreground animate-in fade-in">
                    <div className="flex items-center justify-between font-semibold text-indigo-400">
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {msg.actionPayload.draftResult.sent ? "Email Dispatched" : "Email Draft Ready"}
                      </span>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            msg.actionPayload.draftResult.draft || msg.actionPayload.draftResult.body || "",
                            msg.id
                          )
                        }
                        className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === msg.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedId === msg.id ? "Copied" : "Copy"}</span>
                      </button>
                    </div>

                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      <div>
                        To:{" "}
                        <span className="text-foreground font-medium">
                          {msg.actionPayload.draftResult.recipientEmail || msg.actionPayload.draftResult.to}
                        </span>
                      </div>
                      <div>
                        Subject:{" "}
                        <span className="text-foreground font-medium">
                          {msg.actionPayload.draftResult.subject}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-background/50 border border-border/50 text-[11px] text-muted-foreground max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed font-sans">
                      {msg.actionPayload.draftResult.draft || msg.actionPayload.draftResult.body}
                    </div>

                    {msg.actionPayload.draftResult.sent ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium py-1">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Dispatched successfully through connected inbox</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            onInsertDraftToComposer(
                              msg.actionPayload.draftResult.draft || msg.actionPayload.draftResult.body || "",
                              msg.actionPayload.draftResult.subject,
                              msg.actionPayload.draftResult.recipientEmail || msg.actionPayload.draftResult.to
                            )
                          }
                          className="w-full text-xs gap-1.5 h-8 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 cursor-pointer"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          <span>In Composer</span>
                        </Button>

                        <Button
                          size="sm"
                          disabled={sendingCardId === msg.id || isSendingDraftRef.current}
                          onClick={() => handleSendDraftNow(msg.actionPayload.draftResult, msg.id)}
                          className="w-full text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 h-8 cursor-pointer shadow-sm"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>{sendingCardId === msg.id ? "Sending..." : "Send Now"}</span>
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Interactive Card: Meeting & Calendar Aligned */}
                {(msg.actionType === "MEETING_SCHEDULED" || msg.actionType === "CALENDAR_ALIGNED") && (
                  <div className="space-y-2">
                    {msg.actionPayload?.meeting && (
                      <div className="p-3 bg-secondary/40 border border-emerald-500/30 rounded-xl space-y-2.5 text-xs text-foreground animate-in fade-in">
                        <div className="flex items-center justify-between font-semibold text-emerald-400">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            Meeting Aligned & Prepared
                          </span>
                          <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/40">
                            {new Date(msg.actionPayload.meeting.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </Badge>
                        </div>
                        <p className="font-medium text-foreground">{msg.actionPayload.meeting.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(msg.actionPayload.meeting.startTime).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                        </p>

                        {/* Conflict Detection Indicator */}
                        {msg.actionPayload.meeting.hasConflict ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>Schedule overlap detected with an existing appointment</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span>Schedule aligned: Clear slot with 0 conflicts</span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <a
                            href={msg.actionPayload.meeting.googleCalendarUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-medium transition-colors"
                          >
                            <Calendar className="h-3 w-3" />
                            <span>Google Cal</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>

                          <a
                            href={msg.actionPayload.meeting.outlookCalendarUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-medium transition-colors"
                          >
                            <Calendar className="h-3 w-3" />
                            <span>Outlook</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>

                        <a
                          href={msg.actionPayload.meeting.icsDownloadUrl}
                          download
                          className="flex items-center justify-center gap-1.5 w-full py-1 text-[11px] text-muted-foreground hover:text-foreground border border-border/60 rounded-lg hover:bg-secondary transition-colors"
                        >
                          <Download className="h-3 w-3" />
                          <span>Download .ics Calendar File</span>
                        </a>

                        {/* Manual Date & Time Adjustment Option */}
                        <div className="pt-1.5 border-t border-border/40">
                          <button
                            type="button"
                            onClick={() => {
                              if (editingMeetingMsgId === msg.id) {
                                setEditingMeetingMsgId(null);
                              } else {
                                setEditingMeetingMsgId(msg.id);
                                const st = new Date(msg.actionPayload.meeting.startTime);
                                setCustomMeetingTime(!isNaN(st.getTime()) ? st.toISOString().slice(0, 16) : "");
                              }
                            }}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1 cursor-pointer"
                          >
                            <Clock className="w-3 h-3" />
                            <span>{editingMeetingMsgId === msg.id ? "Close Custom Schedule" : "Adjust Date & Time manually"}</span>
                          </button>

                          {editingMeetingMsgId === msg.id && (
                            <div className="mt-2 p-2.5 bg-background/80 border border-emerald-500/40 rounded-lg space-y-2 text-xs">
                              <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                                Custom Meeting Date & Time
                              </div>
                              <div className="space-y-1.5">
                                <Input
                                  type="datetime-local"
                                  value={customMeetingTime}
                                  onChange={(e) => setCustomMeetingTime(e.target.value)}
                                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                                  className="h-7 text-xs bg-secondary/80 border-border text-foreground px-2"
                                />
                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <span>Duration:</span>
                                  {[15, 30, 45, 60].map((mins) => (
                                    <button
                                      key={mins}
                                      type="button"
                                      onClick={() => setCustomDuration(mins)}
                                      className={cn(
                                        "px-1.5 py-0.5 rounded text-[10px] border transition-colors",
                                        customDuration === mins
                                          ? "bg-emerald-600 border-emerald-500 text-white"
                                          : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                                      )}
                                    >
                                      {mins}m
                                    </button>
                                  ))}
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={!customMeetingTime}
                                  onClick={() => handleSaveManualMeeting(msg.id, msg.actionPayload.meeting)}
                                  className="w-full h-7 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                                >
                                  Update Meeting Schedule
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {msg.actionPayload?.calendarAligned && (
                      <div className="p-3 bg-secondary/40 border border-emerald-500/30 rounded-xl space-y-2 text-xs text-foreground animate-in fade-in">
                        <div className="flex items-center justify-between font-semibold text-emerald-400">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            Schedule & Available Windows
                          </span>
                          <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                            {msg.actionPayload.calendarAligned.count} Events
                          </Badge>
                        </div>
                        {msg.actionPayload.calendarAligned.freeSlots && msg.actionPayload.calendarAligned.freeSlots.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[11px] font-medium text-muted-foreground">Optimal Free Meeting Slots:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.actionPayload.calendarAligned.freeSlots.map((slot: any, idx: number) => (
                                <button
                                  key={idx}
                                  onClick={() => handleSendMessage(`Schedule a meeting for ${slot.label}`)}
                                  className="px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] transition-colors cursor-pointer"
                                >
                                  {slot.label}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => setShowCustomSlotInput((prev) => !prev)}
                                className="px-2 py-0.5 rounded-md bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[10px] transition-colors cursor-pointer"
                              >
                                + Custom Time
                              </button>
                            </div>

                            {showCustomSlotInput && (
                              <div className="mt-2 p-2 rounded-lg bg-background/80 border border-sky-500/30 space-y-1.5">
                                <div className="text-[10px] font-semibold text-sky-400 uppercase tracking-wider">
                                  Pick Custom Meeting Time
                                </div>
                                <div className="flex gap-1.5">
                                  <Input
                                    type="datetime-local"
                                    value={manualSlotInput}
                                    onChange={(e) => setManualSlotInput(e.target.value)}
                                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                                    className="h-7 text-xs bg-secondary/80 border-border text-foreground px-2"
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={!manualSlotInput}
                                    onClick={() => {
                                      if (!manualSlotInput) return;
                                      const dt = new Date(manualSlotInput);
                                      if (isNaN(dt.getTime())) return;
                                      handleSendMessage(`Schedule a meeting on ${dt.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`);
                                      setShowCustomSlotInput(false);
                                      setManualSlotInput("");
                                    }}
                                    className="h-7 text-[11px] bg-sky-600 hover:bg-sky-500 text-white cursor-pointer px-2"
                                  >
                                    Schedule
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Interactive Card: Emails Discovered */}
                {msg.actionType === "EMAILS_FOUND" && msg.actionPayload?.emailsFound && (
                  <div className="p-3 bg-secondary/40 border border-sky-500/30 rounded-xl space-y-2 text-xs text-foreground animate-in fade-in">
                    <div className="flex items-center justify-between font-semibold text-sky-400">
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        Discovered Conversations
                      </span>
                      <Badge variant="outline" className="text-[10px] text-sky-400 border-sky-500/30">
                        {msg.actionPayload.emailsFound.count} found
                      </Badge>
                    </div>
                    <div className="divide-y divide-border/40 max-h-48 overflow-y-auto space-y-1">
                      {msg.actionPayload.emailsFound.threads?.map((th: any) => (
                        <div
                          key={th.id}
                          onClick={() => onSelectThread?.(th.id)}
                          className={cn(
                            "py-1.5 px-1 hover:bg-secondary/60 rounded transition-colors",
                            onSelectThread && "cursor-pointer group"
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium text-foreground truncate max-w-[160px] group-hover:text-sky-400">
                              {th.latestSender}
                            </span>
                            {!th.isRead && (
                              <span className="text-[9px] px-1 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                Unread
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{th.subject}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Interactive Card: Mailbox Triage */}
                {msg.actionType === "TRIAGE_EXECUTED" && msg.actionPayload?.triageRes && (
                  <div className="p-3 bg-secondary/40 border border-amber-500/30 rounded-xl space-y-1.5 text-xs text-foreground animate-in fade-in">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Mailbox Triage Executed</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Successfully processed {msg.actionPayload.triageRes.affectedCount} conversation(s) according to your rules.
                    </p>
                  </div>
                )}

                {/* 6. Interactive Card: Email Classification (Spam / Promotional / Unnecessary) */}
                {msg.actionType === "EMAILS_CLASSIFIED" && msg.actionPayload?.classifiedEmails && (
                  <div className="p-3 bg-secondary/40 border border-purple-500/30 rounded-xl space-y-3 text-xs text-foreground animate-in fade-in">
                    <div className="flex items-center justify-between font-semibold text-purple-400">
                      <span className="flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Inbox Categorization & Clean-up
                      </span>
                      <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-500/40">
                        {msg.actionPayload.classifiedEmails.totalScanned} Scanned
                      </Badge>
                    </div>

                    {/* Breakdown Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-0.5">
                      <div className="p-1.5 rounded-lg bg-background/50 border border-border/50 flex flex-col">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Promotional
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          {msg.actionPayload.classifiedEmails.breakdown.promotional}
                        </span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-background/50 border border-border/50 flex flex-col">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                          Spam / Junk
                        </span>
                        <span className="text-xs font-bold text-rose-400">
                          {msg.actionPayload.classifiedEmails.breakdown.spam}
                        </span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-background/50 border border-border/50 flex flex-col">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                          Newsletters
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          {msg.actionPayload.classifiedEmails.breakdown.newsletter}
                        </span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-background/50 border border-border/50 flex flex-col">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                          Notifications
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          {msg.actionPayload.classifiedEmails.breakdown.notification}
                        </span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-background/50 border border-border/50 flex flex-col col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Primary Mails
                        </span>
                        <span className="text-xs font-bold text-emerald-400">
                          {msg.actionPayload.classifiedEmails.breakdown.primary}
                        </span>
                      </div>
                    </div>

                    {/* Detected Unnecessary Mails List */}
                    {msg.actionPayload.classifiedEmails.unnecessaryEmails?.length > 0 && (
                      <div className="space-y-1.5 pt-1 border-t border-border/40">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-foreground">
                            Filtered Candidates ({msg.actionPayload.classifiedEmails.unnecessaryEmails.length}):
                          </span>
                          <span className="text-[10px] text-muted-foreground">Click to inspect</span>
                        </div>
                        <div className="divide-y divide-border/30 max-h-40 overflow-y-auto space-y-1 pr-1">
                          {msg.actionPayload.classifiedEmails.unnecessaryEmails.slice(0, 8).map((email: any, idx: number) => {
                            const catColor =
                              email.category === "SPAM"
                                ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                                : email.category === "PROMOTIONAL"
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                : email.category === "NEWSLETTER"
                                ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                                : "bg-sky-500/10 text-sky-300 border-sky-500/30";

                            return (
                              <div
                                key={idx}
                                onClick={() => onSelectThread?.(email.threadId)}
                                className={cn(
                                  "py-1.5 px-1.5 rounded hover:bg-secondary/60 transition-colors",
                                  onSelectThread && "cursor-pointer group"
                                )}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-medium text-foreground truncate max-w-[150px] group-hover:text-purple-300">
                                    {email.sender}
                                  </span>
                                  <span className={`text-[9px] px-1.5 py-0.2 rounded border font-medium uppercase ${catColor}`}>
                                    {email.category}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground truncate">{email.subject}</p>
                                {email.signals && email.signals.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {email.signals.slice(0, 2).map((sig: string, sI: number) => (
                                      <span key={sI} className="text-[8px] px-1 py-0 rounded bg-secondary text-muted-foreground">
                                        {sig}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 1-Click Clean-up Actions */}
                    <div className="space-y-1.5 pt-2 border-t border-border/40">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        1-Click Clean Actions:
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={cleaningCategory !== null || msg.actionPayload.classifiedEmails.breakdown.promotional === 0}
                          onClick={() => handleBatchClean("promotional", "archive")}
                          className="h-7 text-[10px] gap-1 border-amber-500/30 text-amber-300 hover:bg-amber-500/10 cursor-pointer"
                        >
                          <Archive className="h-3 w-3" />
                          <span>Archive Promo ({msg.actionPayload.classifiedEmails.breakdown.promotional})</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={cleaningCategory !== null || msg.actionPayload.classifiedEmails.breakdown.spam === 0}
                          onClick={() => handleBatchClean("spam", "trash")}
                          className="h-7 text-[10px] gap-1 border-rose-500/30 text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Trash Spam ({msg.actionPayload.classifiedEmails.breakdown.spam})</span>
                        </Button>
                      </div>

                      <Button
                        size="sm"
                        disabled={cleaningCategory !== null || msg.actionPayload.classifiedEmails.breakdown.unnecessaryTotal === 0}
                        onClick={() => handleBatchClean("all_unnecessary", "archive")}
                        className="w-full h-7 text-[10px] bg-purple-600 hover:bg-purple-500 text-white gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>
                          {cleaningCategory === "all_unnecessary"
                            ? "Cleaning Inbox..."
                            : `Archive All ${msg.actionPayload.classifiedEmails.breakdown.unnecessaryTotal} Unnecessary Emails`}
                        </span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="h-7 w-7 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-2.5 items-center text-xs text-muted-foreground animate-pulse">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <span>Copilot is analyzing and executing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 border-t border-border bg-card/60">
        <div className="relative flex items-center bg-secondary/50 border border-border rounded-xl focus-within:border-sky-500/60 focus-within:ring-1 focus-within:ring-sky-500/30 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Copilot (e.g. 'Draft reply', 'Create notes', 'Schedule call')..."
            rows={1}
            disabled={loading}
            className="w-full bg-transparent resize-none py-2.5 pl-3 pr-10 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[40px] max-h-24"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || loading}
            className="absolute right-2 p-1.5 rounded-lg bg-sky-500 text-white hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 transition-colors cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1.5 px-1">
          <span>Press Enter to send</span>
          <span>Shortcut: <kbd className="px-1 py-0.5 bg-secondary rounded border border-border">Ctrl+J</kbd></span>
        </div>
      </div>
    </div>
  );
}
