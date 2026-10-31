"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Send,
  Sparkles,
  X,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  FileText,
  Link as LinkIcon,
  Clock,
  ChevronDown,
  Bold,
  Italic,
  Code,
  List,
  ListOrdered,
  Quote,
  RotateCcw,
  Check,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface ConnectedAccount {
  id: string;
  provider: string;
  emailAddress: string;
  displayName: string;
  colorCode: string;
}

interface AttachedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
}

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: ConnectedAccount[];
  onSent: () => void;
  onQueueSend?: (payload: {
    accountId: string;
    to: string;
    subject: string;
    bodyText: string;
    attachments: any[];
    scheduledAt?: string;
  }) => void;
  initialDraftText?: string;
  initialSubject?: string;
  initialTo?: string;
}

export function ComposeDialog({
  open,
  onOpenChange,
  accounts,
  onSent,
  onQueueSend,
  initialDraftText = "",
  initialSubject = "",
  initialTo = "",
}: ComposeDialogProps) {
  const [selectedAccountId, setSelectedAccountId] = React.useState<string>("");
  const [to, setTo] = React.useState(initialTo);
  const [subject, setSubject] = React.useState(initialSubject);
  const [bodyText, setBodyText] = React.useState(initialDraftText);
  const [previousDraft, setPreviousDraft] = React.useState<string | null>(null);
  const [attachments, setAttachments] = React.useState<AttachedFile[]>([]);
  const [sending, setSending] = React.useState(false);
  const [rewriting, setRewriting] = React.useState(false);
  const [bookingUrl, setBookingUrl] = React.useState<string | null>(null);
  const [showScheduleMenu, setShowScheduleMenu] = React.useState(false);
  const [scheduledTime, setScheduledTime] = React.useState<string | null>(null);
  const [scheduledLabel, setScheduledLabel] = React.useState<string | null>(null);
  const [customScheduleInput, setCustomScheduleInput] = React.useState<string>("");

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const isSendingRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    if (open) {
      if (initialTo) setTo(initialTo);
      if (initialSubject) setSubject(initialSubject);
      if (initialDraftText) setBodyText(initialDraftText);
      setScheduledTime(null);
      setScheduledLabel(null);
      setShowScheduleMenu(false);

      // Load user booking integrations (Cal.com or Calendly)
      apiFetch("/api/agent/calendar/integrations")
        .then((res) => {
          if (res && res.integrations && res.integrations.length > 0) {
            const active = res.integrations.find((i: any) => i.bookingUrl);
            if (active) setBookingUrl(active.bookingUrl);
          }
        })
        .catch(() => {});
    }
  }, [open, initialDraftText, initialSubject, initialTo]);

  React.useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  // Insert markdown styling at cursor position
  const insertFormatting = (prefix: string, suffix: string = "") => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = bodyText;
    const selected = text.substring(start, end);

    const replacement = prefix + (selected || "text") + suffix;
    const newText = text.substring(0, start) + replacement + text.substring(end);
    setBodyText(newText);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + (selected ? selected.length : 4));
    }, 10);
  };

  // AI Style Rewrite Trigger
  const handleAiRewrite = async (style: "professional" | "concise" | "friendly" | "grammar") => {
    if (!bodyText.trim() || rewriting) return;
    setRewriting(true);
    setPreviousDraft(bodyText);

    try {
      const res = await apiFetch<{ success: boolean; rewritten: string }>("/api/ai/compose/rewrite", {
        method: "POST",
        body: JSON.stringify({ text: bodyText, style }),
      });

      if (res && res.rewritten) {
        setBodyText(res.rewritten);
      }
    } catch (err: any) {
      console.error("AI rewrite error", err);
    } finally {
      setRewriting(false);
    }
  };

  const handleUndoRewrite = () => {
    if (previousDraft !== null) {
      setBodyText(previousDraft);
      setPreviousDraft(null);
    }
  };

  // Preset Schedule Times calculation
  const getSchedulePresets = () => {
    const now = new Date();

    // Tomorrow 9 AM
    const tomorrowMorning = new Date(now);
    tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
    tomorrowMorning.setHours(9, 0, 0, 0);

    // Tomorrow 2 PM
    const tomorrowAfternoon = new Date(now);
    tomorrowAfternoon.setDate(tomorrowAfternoon.getDate() + 1);
    tomorrowAfternoon.setHours(14, 0, 0, 0);

    // Next Monday 9 AM
    const nextMonday = new Date(now);
    const day = nextMonday.getDay();
    const daysUntilMonday = ((8 - day) % 7) || 7;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    nextMonday.setHours(9, 0, 0, 0);

    return [
      { label: "Tomorrow Morning (9:00 AM)", time: tomorrowMorning.toISOString() },
      { label: "Tomorrow Afternoon (2:00 PM)", time: tomorrowAfternoon.toISOString() },
      { label: "Monday Morning (9:00 AM)", time: nextMonday.toISOString() },
    ];
  };

  // Handle clipboard paste of images directly into the compose body
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) pastedFiles.push(file);
      }
    }

    if (pastedFiles.length > 0) {
      const newAttachments: AttachedFile[] = pastedFiles.map((f) => ({
        id: Math.random().toString(36).substring(2, 9),
        file: f,
        name: f.name || `pasted_screenshot_${Date.now()}.png`,
        size: f.size,
        type: f.type || "image/png",
        previewUrl: URL.createObjectURL(f),
      }));

      setAttachments((prev) => [...prev, ...newAttachments]);
    }
  };

  const handleInsertBookingLink = () => {
    if (!bookingUrl) return;
    const textToAppend = `\n\nFeel free to find a time on my calendar here:\n👉 ${bookingUrl}`;
    setBodyText((prev) => prev + textToAppend);
  };

  // Handle multi-image & file attachments
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: AttachedFile[] = Array.from(files).map((f) => {
      const isImg = f.type.startsWith("image/");
      return {
        id: Math.random().toString(36).substring(2, 9),
        file: f,
        name: f.name,
        size: f.size,
        type: f.type,
        previewUrl: isImg ? URL.createObjectURL(f) : undefined,
      };
    });

    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSendingRef.current || sending || !to || !selectedAccountId) return;

    try {
      isSendingRef.current = true;
      setSending(true);

      // Convert attachments to base64 payload
      const attachmentPayloads = await Promise.all(
        attachments.map(async (att) => {
          return new Promise<{ filename: string; contentType: string; sizeBytes: number; base64?: string }>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result as string;
              resolve({
                filename: att.name,
                contentType: att.type,
                sizeBytes: att.size,
                base64: res.split(",")[1],
              });
            };
            reader.readAsDataURL(att.file);
          });
        })
      );

      const sendPayload = {
        accountId: selectedAccountId,
        to,
        subject: subject || "(No Subject)",
        bodyText,
        attachments: attachmentPayloads,
        scheduledAt: scheduledTime || undefined,
      };

      // If parent supplied Undo grace window queueing, delegate to it
      if (onQueueSend && !scheduledTime) {
        onQueueSend(sendPayload);
      } else {
        await apiFetch("/api/messages/send", {
          method: "POST",
          body: JSON.stringify(sendPayload),
        });
      }

      // Cleanup preview URLs
      attachments.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });

      onSent();
      onOpenChange(false);
      setTo("");
      setSubject("");
      setBodyText("");
      setAttachments([]);
      setScheduledTime(null);
      setScheduledLabel(null);
    } catch (err: any) {
      alert("Failed to send email: " + err.message);
    } finally {
      isSendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl rounded-2xl p-6">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-slate-100">
                AI Composer & Email Dispatcher
              </DialogTitle>
              <p className="text-[11px] text-slate-400">Write, format, and schedule emails across all identities</p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSend} className="space-y-3 mt-2">
          {/* Account selector */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-slate-400 w-12 shrink-0">From:</Label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="flex-1 h-8 text-xs bg-slate-800/80 border border-slate-700/80 rounded-md px-2 text-slate-100 focus:outline-none"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id} className="bg-slate-900 text-slate-100">
                  {acc.displayName || acc.emailAddress} ({acc.emailAddress})
                </option>
              ))}
            </select>
          </div>

          {/* Recipient */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-slate-400 w-12 shrink-0">To:</Label>
            <Input
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@domain.com"
              className="h-8 text-xs bg-slate-800/50 border-slate-700 text-slate-100"
            />
          </div>

          {/* Subject */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-slate-400 w-12 shrink-0">Subject:</Label>
            <Input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="h-8 text-xs bg-slate-800/50 border-slate-700 text-slate-100"
            />
          </div>

          {/* AI Quick Polish & Formatting Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
            {/* Formatting Tools */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => insertFormatting("**", "**")}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                title="Bold (**text**)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("*", "*")}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                title="Italic (*text*)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("`", "`")}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                title="Code (`code`)"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("\n- ")}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                title="Bullet List (- item)"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("\n1. ")}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                title="Numbered List (1. item)"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting("\n> ")}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                title="Quote (> quote)"
              >
                <Quote className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Inline AI Quick Rewriters */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-slate-500 uppercase flex items-center gap-1 mr-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> AI Rewrite:
              </span>
              <button
                type="button"
                disabled={rewriting || !bodyText.trim()}
                onClick={() => handleAiRewrite("professional")}
                className="px-2 py-0.5 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
              >
                Professional
              </button>
              <button
                type="button"
                disabled={rewriting || !bodyText.trim()}
                onClick={() => handleAiRewrite("concise")}
                className="px-2 py-0.5 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
              >
                Concise
              </button>
              <button
                type="button"
                disabled={rewriting || !bodyText.trim()}
                onClick={() => handleAiRewrite("friendly")}
                className="px-2 py-0.5 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
              >
                Friendly
              </button>
              <button
                type="button"
                disabled={rewriting || !bodyText.trim()}
                onClick={() => handleAiRewrite("grammar")}
                className="px-2 py-0.5 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
              >
                Grammar
              </button>
              {previousDraft && (
                <button
                  type="button"
                  onClick={handleUndoRewrite}
                  className="px-2 py-0.5 text-[11px] rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 flex items-center gap-1 transition-colors"
                  title="Undo last AI rewrite"
                >
                  <RotateCcw className="w-3 h-3" />
                  Undo
                </button>
              )}
            </div>
          </div>

          {/* Body Textarea */}
          <div className="pt-1">
            <textarea
              ref={textareaRef}
              rows={8}
              required
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              onPaste={handlePaste}
              placeholder="Write your email message (supports Markdown, pasted screenshots with Ctrl+V, or AI polish)..."
              className="w-full bg-slate-800/40 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none font-sans leading-relaxed"
            />
          </div>

          {/* Multi-Image & File Attachment Previews */}
          {attachments.length > 0 && (
            <div className="space-y-2 pt-1 border-t border-slate-800/60">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium text-slate-200 flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-blue-400" />
                  <span>Attached Images & Files ({attachments.length})</span>
                </span>
                <span>
                  Total:{" "}
                  {(
                    attachments.reduce((sum, a) => sum + a.size, 0) /
                    (1024 * 1024)
                  ).toFixed(2)}{" "}
                  MB
                </span>
              </div>

              {/* Thumbnail Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-36 overflow-y-auto p-1">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="relative rounded-lg border border-slate-700/80 bg-slate-800/60 p-1.5 flex flex-col justify-between group overflow-hidden"
                  >
                    {att.previewUrl ? (
                      <div className="relative h-14 w-full rounded overflow-hidden bg-slate-900 mb-1">
                        <img
                          src={att.previewUrl}
                          alt={att.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-14 w-full rounded bg-slate-900/70 flex items-center justify-center text-slate-400 mb-1">
                        <FileText className="h-6 w-6" />
                      </div>
                    )}

                    <div className="min-w-0 pr-4">
                      <p className="text-[10px] font-medium text-slate-200 truncate" title={att.name}>
                        {att.name}
                      </p>
                      <p className="text-[9px] text-slate-400">
                        {(att.size / 1024).toFixed(1)} KB
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center transition-colors"
                      title="Remove attachment"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hidden multi-file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt"
            onChange={handleFilesSelected}
            className="hidden"
          />

          {/* Scheduled Indicator Banner */}
          {scheduledTime && (
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-between text-xs text-blue-200">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>Scheduled for: <strong>{scheduledLabel || new Date(scheduledTime).toLocaleString()}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setScheduledTime(null);
                  setScheduledLabel(null);
                }}
                className="text-xs text-blue-400 hover:text-blue-200 underline"
              >
                Send Now Instead
              </button>
            </div>
          )}

          {/* Actions & Attachment Trigger */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            {/* Attachment & Booking Link Buttons */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs h-8 gap-1.5 bg-slate-800/80 border-slate-700 hover:bg-slate-800 cursor-pointer text-slate-200"
              >
                <ImageIcon className="h-3.5 w-3.5 text-blue-400" />
                <span>Attach Files</span>
              </Button>

              {bookingUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleInsertBookingLink}
                  title={`Insert ${bookingUrl}`}
                  className="text-xs h-8 gap-1.5 bg-slate-800/80 border-slate-700 hover:bg-slate-800 text-amber-400 hover:text-amber-300 cursor-pointer"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Add Booking Link</span>
                </Button>
              )}
            </div>

            {/* Send / Send Later Split Button */}
            <div className="flex items-center gap-2 relative">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs h-8 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Discard
              </Button>

              <div className="flex items-center rounded-lg overflow-hidden shadow-sm">
                <Button
                  type="submit"
                  size="sm"
                  disabled={sending || rewriting}
                  className="text-xs h-8 gap-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-r-none cursor-pointer"
                >
                  {scheduledTime ? <Clock className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                  <span>
                    {sending
                      ? "Sending..."
                      : scheduledTime
                      ? "Schedule Send"
                      : "Send Email"}
                  </span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowScheduleMenu((prev) => !prev)}
                  className="text-xs h-8 px-2 bg-blue-700 hover:bg-blue-600 text-white border-l border-blue-500/30 rounded-l-none cursor-pointer"
                  title="Send later options"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Schedule Later Dropdown Menu */}
              {showScheduleMenu && (
                <div className="absolute right-0 bottom-full mb-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2.5 z-50 space-y-1.5 text-xs">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-0.5">
                    Schedule Presets
                  </div>
                  {getSchedulePresets().map((preset) => (
                    <button
                      key={preset.time}
                      type="button"
                      onClick={() => {
                        setScheduledTime(preset.time);
                        setScheduledLabel(preset.label);
                        setShowScheduleMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 flex items-center justify-between transition-colors"
                    >
                      <span>{preset.label}</span>
                      {scheduledTime === preset.time && (
                        <Check className="w-3.5 h-3.5 text-blue-400" />
                      )}
                    </button>
                  ))}

                  {/* Manual / Custom Date & Time Picker */}
                  <div className="border-t border-slate-800 pt-2 px-1">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-400" />
                      <span>Custom Date & Time</span>
                    </div>
                    <div className="space-y-1.5">
                      <Input
                        type="datetime-local"
                        value={customScheduleInput}
                        onChange={(e) => setCustomScheduleInput(e.target.value)}
                        min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                        className="h-8 text-xs bg-slate-800/90 border-slate-700 text-slate-100 px-2"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={!customScheduleInput}
                        onClick={() => {
                          if (!customScheduleInput) return;
                          const targetDate = new Date(customScheduleInput);
                          if (isNaN(targetDate.getTime()) || targetDate.getTime() <= Date.now()) {
                            alert("Please choose a future date and time.");
                            return;
                          }
                          setScheduledTime(targetDate.toISOString());
                          setScheduledLabel(
                            targetDate.toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          );
                          setShowScheduleMenu(false);
                        }}
                        className="w-full h-7 text-[11px] bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
                      >
                        Set Custom Schedule
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setScheduledTime(null);
                        setScheduledLabel(null);
                        setShowScheduleMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      Send Immediately (Reset)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
