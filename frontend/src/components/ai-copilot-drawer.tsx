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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ActionItem {
  task: string;
  assignee?: string;
  deadline?: string;
  completed?: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionType?: "NOTES_GENERATED" | "DRAFT_CREATED" | "MEETING_SCHEDULED" | "TRIAGE_EXECUTED" | "GENERAL_REPLY";
  actionPayload?: any;
  createdAt?: string;
}

interface AICopilotDrawerProps {
  open: boolean;
  onClose: () => void;
  activeThread: any | null;
  onInsertDraftToComposer: (draftText: string, subject?: string, recipientEmail?: string) => void;
  onOpenNotesTab?: () => void;
  onOpenSettings?: () => void;
}

export function AICopilotDrawer({
  open,
  onClose,
  activeThread,
  onInsertDraftToComposer,
  onOpenNotesTab,
  onOpenSettings,
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
  const [byokInfo, setByokInfo] = React.useState<{ provider: string; hasCustomKey: boolean } | null>(null);

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
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground">Mailr Copilot</span>
              {byokInfo && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase border-border/80 text-muted-foreground">
                  {byokInfo.provider}
                </Badge>
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
      {activeThread && (
        <div className="p-2.5 bg-secondary/30 border-b border-border/50 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
          <button
            onClick={() => handleSendMessage("Summarize this thread and generate executive notes with action items")}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 hover:bg-secondary text-foreground text-[11px] font-medium border border-border/60 transition-colors whitespace-nowrap cursor-pointer shrink-0"
          >
            <FileText className="h-3 w-3 text-sky-400" />
            <span>Create Notes</span>
          </button>

          <button
            onClick={() => handleSendMessage("Check calendar and schedule a meeting from this email")}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 hover:bg-secondary text-foreground text-[11px] font-medium border border-border/60 transition-colors whitespace-nowrap cursor-pointer shrink-0"
          >
            <Calendar className="h-3 w-3 text-emerald-400" />
            <span>Schedule Meeting</span>
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
        </div>
      )}

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

                {/* 2. Interactive Card: Draft Reply Created */}
                {msg.actionType === "DRAFT_CREATED" && msg.actionPayload?.draftResult && (
                  <div className="p-3 bg-secondary/40 border border-indigo-500/30 rounded-xl space-y-2.5 text-xs text-foreground animate-in fade-in">
                    <div className="flex items-center justify-between font-semibold text-indigo-400">
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        Draft Reply Ready
                      </span>
                      <button
                        onClick={() => copyToClipboard(msg.actionPayload.draftResult.draft, msg.id)}
                        className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === msg.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedId === msg.id ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                    <div className="p-2 rounded bg-background/50 border border-border/50 text-[11px] text-muted-foreground max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {msg.actionPayload.draftResult.draft}
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        onInsertDraftToComposer(
                          msg.actionPayload.draftResult.draft,
                          msg.actionPayload.draftResult.subject,
                          msg.actionPayload.draftResult.recipientEmail
                        )
                      }
                      className="w-full text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5 h-7 cursor-pointer"
                    >
                      <Mail className="h-3 w-3" />
                      <span>Insert into Composer</span>
                    </Button>
                  </div>
                )}

                {/* 3. Interactive Card: Meeting Scheduled */}
                {msg.actionType === "MEETING_SCHEDULED" && msg.actionPayload?.meeting && (
                  <div className="p-3 bg-secondary/40 border border-emerald-500/30 rounded-xl space-y-2.5 text-xs text-foreground animate-in fade-in">
                    <div className="flex items-center justify-between font-semibold text-emerald-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        Meeting Prepared
                      </span>
                      <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/40">
                        {new Date(msg.actionPayload.meeting.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Badge>
                    </div>
                    <p className="font-medium">{msg.actionPayload.meeting.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(msg.actionPayload.meeting.startTime).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                    </p>

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
