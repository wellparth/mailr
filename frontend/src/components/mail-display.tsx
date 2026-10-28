"use client";

import * as React from "react";
import {
  Star,
  Trash2,
  Archive,
  Reply,
  Calendar,
  Sparkles,
  Download,
  Paperclip,
  CheckCircle2,
  Clock,
  Send,
  Shield,
  ExternalLink,
  Plus,
  Image as ImageIcon,
  Server,
  Mail,
  ArrowRight,
  Maximize2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiFetch } from "@/lib/api";

interface CalendarProposal {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  timezone: string;
  status: string;
  attendees: Array<{ email: string; name?: string }>;
}

interface AttachmentItem {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  filePath: string;
}

interface MessageItem {
  id: string;
  senderName?: string;
  senderEmail: string;
  recipientList: string[];
  subject: string;
  snippet?: string;
  bodyHtml?: string;
  bodyText?: string;
  isRead: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
  receivedAt: string;
  attachments?: AttachmentItem[];
  calendarProposals?: CalendarProposal[];
}

interface SelectedThread {
  id: string;
  subject: string;
  account: {
    id: string;
    emailAddress: string;
    displayName: string;
    colorCode: string;
    provider: string;
  };
  messages: MessageItem[];
  priorityLevel: string;
  priorityScore?: number;
  priorityReason?: string;
  isStarred: boolean;
}

interface MailDisplayProps {
  thread: SelectedThread | null;
  accountsCount: number;
  onStarToggle: (threadId: string, currentStatus: boolean) => void;
  onArchive: (threadId: string) => void;
  onDelete: (threadId: string) => void;
  onReplySuccess: () => void;
  onOpenConnectModal: () => void;
  onOpenCompose: () => void;
}

export function MailDisplay({
  thread,
  accountsCount,
  onStarToggle,
  onArchive,
  onDelete,
  onReplySuccess,
  onOpenConnectModal,
  onOpenCompose,
}: MailDisplayProps) {
  const [replyText, setReplyText] = React.useState("");
  const [generatingTone, setGeneratingTone] = React.useState<string | null>(null);
  const [sendingReply, setSendingReply] = React.useState(false);
  const [actionNotice, setActionNotice] = React.useState<string | null>(null);
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);

  // If NO thread is selected, display high-design Welcome & Multi-Account Guide
  if (!thread) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center h-full p-6 md:p-12 overflow-y-auto text-center bg-background">
        <div className="max-w-xl w-full mx-auto space-y-6">
          {/* Header Monogram & Title */}
          <div className="flex flex-col items-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-xl">
              <Mail className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {accountsCount === 0
                  ? "Welcome to Mailr — Multi-Account AI Client"
                  : "All Caught Up"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-md mx-auto">
                {accountsCount === 0
                  ? "Connect your email accounts below. You can easily link multiple inboxes (Google, Outlook, IMAP) and attach multiple images & documents in your emails."
                  : "Select an email from the left sidebar to view details, export calendar bookings, or draft smart AI responses."}
              </p>
            </div>
          </div>

          {/* Quick Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            {/* Card 1: Google Mail */}
            <div
              onClick={onOpenConnectModal}
              className="p-4 rounded-xl border border-border/70 bg-card/40 hover:bg-card hover:border-red-500/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center font-bold text-sm">
                  G
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground group-hover:text-red-400 transition-colors">
                    Add Google Account
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Gmail & Google Workspace OAuth / App Passwords
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Outlook / Microsoft 365 */}
            <div
              onClick={onOpenConnectModal}
              className="p-4 rounded-xl border border-border/70 bg-card/40 hover:bg-card hover:border-sky-500/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-sm">
                  O
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground group-hover:text-sky-400 transition-colors">
                    Add Outlook Account
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Office 365, Hotmail, and Exchange inboxes
                  </p>
                </div>
              </div>
            </div>

            {/* Card 3: Custom IMAP/SMTP */}
            <div
              onClick={onOpenConnectModal}
              className="p-4 rounded-xl border border-border/70 bg-card/40 hover:bg-card hover:border-emerald-500/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Server className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground group-hover:text-emerald-400 transition-colors">
                    Add IMAP / SMTP Mail
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    iCloud, Yahoo, Fastmail, Proton, self-hosted
                  </p>
                </div>
              </div>
            </div>

            {/* Card 4: Compose with Multiple Images */}
            <div
              onClick={onOpenCompose}
              className="p-4 rounded-xl border border-border/70 bg-card/40 hover:bg-card hover:border-purple-500/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                  <ImageIcon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground group-hover:text-purple-400 transition-colors">
                    Compose & Attach Images
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Send emails with multiple image attachments
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Buttons */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              onClick={onOpenConnectModal}
              className="text-xs h-9 px-4 gap-2 bg-sky-600 hover:bg-sky-500 text-white shadow-md font-medium cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{accountsCount === 0 ? "Connect Your Inboxes" : "Add Another Account"}</span>
            </Button>
            <Button
              onClick={onOpenCompose}
              variant="outline"
              className="text-xs h-9 px-4 gap-2 bg-secondary/40 border-border hover:bg-secondary cursor-pointer"
            >
              <ImageIcon className="h-3.5 w-3.5 text-purple-400" />
              <span>New Message</span>
            </Button>
          </div>

          {/* Security & Features Banner */}
          <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground pt-3 border-t border-border/40">
            <span className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5 text-emerald-400" />
              <span>AES-256-GCM Encrypted</span>
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-sky-400" />
              <span>AI Priority Triage</span>
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-amber-400" />
              <span>Auto Meeting Detection</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  const latestMessage = thread.messages[0];
  const proposals = latestMessage?.calendarProposals || [];
  const attachments = latestMessage?.attachments || [];

  // Generate .ics calendar download
  const handleDownloadIcs = (proposal: CalendarProposal) => {
    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    };

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Mailr AI//Meeting Scheduler//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `UID:${proposal.id}@mailr.local`,
      `DTSTAMP:${formatDate(new Date().toISOString())}`,
      `DTSTART:${formatDate(proposal.startTime)}`,
      `DTEND:${formatDate(proposal.endTime)}`,
      `SUMMARY:${proposal.title}`,
      `DESCRIPTION:${proposal.description || "Scheduled via Mailr AI Client"}`,
      `STATUS:CONFIRMED`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${proposal.title.replace(/\s+/g, "_")}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setActionNotice("Calendar invite (.ics) downloaded!");
    setTimeout(() => setActionNotice(null), 3500);
  };

  // AI Smart Reply Generation
  const handleGenerateReply = async (tone: "concise" | "professional" | "enthusiastic") => {
    if (!latestMessage) return;
    try {
      setGeneratingTone(tone);
      const res = await apiFetch("/api/ai/draft-reply", {
        method: "POST",
        body: JSON.stringify({
          subject: thread.subject,
          bodyText: latestMessage.bodyText || latestMessage.snippet || "",
          tone,
        }),
      });
      if (res.draft) {
        setReplyText(res.draft);
      }
    } catch (err: any) {
      console.error("Draft generation failed", err);
    } finally {
      setGeneratingTone(null);
    }
  };

  // Send Reply via connected account
  const handleSendReply = async () => {
    if (!replyText.trim() || !latestMessage) return;
    try {
      setSendingReply(true);
      await apiFetch("/api/messages/send", {
        method: "POST",
        body: JSON.stringify({
          accountId: thread.account.id,
          to: latestMessage.senderEmail,
          subject: thread.subject.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`,
          bodyText: replyText,
          threadId: thread.id,
        }),
      });
      setReplyText("");
      setActionNotice("Reply dispatched successfully via " + thread.account.provider);
      setTimeout(() => setActionNotice(null), 4000);
      onReplySuccess();
    } catch (err: any) {
      alert("Failed to send reply: " + err.message);
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden bg-background">
      {/* Thread Action Bar Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/20 shrink-0">
        <div className="flex items-center gap-2">
          {/* Account indicator badge */}
          <Badge
            variant="outline"
            className="text-[11px] gap-1.5 py-0.5 px-2 bg-secondary/50 border-border"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: thread.account.colorCode || "#38bdf8" }}
            />
            <span>{thread.account.displayName || thread.account.emailAddress}</span>
            <span className="text-[10px] text-muted-foreground uppercase">
              ({thread.account.provider})
            </span>
          </Badge>

          {/* Zero-knowledge Encryption Indicator */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground/80 px-2 py-0.5 bg-secondary/30 rounded border border-border/40">
            <Shield className="h-3 w-3 text-emerald-400" />
            <span>AES-256-GCM Zero-Knowledge</span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onStarToggle(thread.id, thread.isStarred)}
            className={`h-8 w-8 p-0 cursor-pointer ${thread.isStarred ? "text-amber-400" : "text-muted-foreground"}`}
            title={thread.isStarred ? "Unstar" : "Star"}
          >
            <Star className={`h-4 w-4 ${thread.isStarred ? "fill-amber-400" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onArchive(thread.id)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Archive"
          >
            <Archive className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(thread.id)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-400 cursor-pointer"
            title="Move to Trash"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Action notification toast */}
      {actionNotice && (
        <div className="bg-emerald-950/80 border-b border-emerald-500/30 text-emerald-300 text-xs px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>{actionNotice}</span>
          </div>
        </div>
      )}

      {/* Main scrollable body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Thread Subject Title & Metadata */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {thread.subject || "(No Subject)"}
          </h1>

          <div className="flex items-center justify-between mt-3 pb-3 border-b border-border/50">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 border border-border">
                <AvatarFallback className="text-xs font-semibold bg-secondary text-foreground">
                  {latestMessage?.senderName ? latestMessage.senderName[0].toUpperCase() : "M"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {latestMessage?.senderName || latestMessage?.senderEmail}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    &lt;{latestMessage?.senderEmail}&gt;
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  to {latestMessage?.recipientList?.join(", ") || thread.account.emailAddress}
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {latestMessage?.receivedAt
                  ? new Date(latestMessage.receivedAt).toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : ""}
              </span>
            </div>
          </div>
        </div>

        {/* AI Priority Analysis Banner */}
        {thread.priorityReason && (
          <div className="bg-gradient-to-r from-emerald-950/40 via-card to-sky-950/30 border border-emerald-500/20 rounded-xl p-3.5 flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mt-0.5 shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  AI Priority Intelligence
                </span>
                {thread.priorityScore && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-emerald-950/50 text-emerald-300 border-emerald-500/30">
                    Score: {thread.priorityScore}/100
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {thread.priorityReason}
              </p>
            </div>
          </div>
        )}

        {/* Calendar Booking Proposals Card */}
        {proposals.length > 0 && (
          <div className="space-y-3">
            {proposals.map((prop) => (
              <div
                key={prop.id}
                className="bg-card border border-sky-500/30 rounded-xl p-4 shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sky-500 to-indigo-500" />
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 mt-0.5">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                          Proposed Calendar Meeting
                        </span>
                        <Badge className="bg-sky-950 text-sky-300 border-sky-500/30 text-[10px] py-0 px-1.5">
                          {prop.status}
                        </Badge>
                      </div>
                      <h4 className="text-sm font-semibold text-foreground mt-1">
                        {prop.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(prop.startTime).toLocaleString([], {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        -{" "}
                        {new Date(prop.endTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        ({prop.timezone})
                      </p>
                      {prop.description && (
                        <p className="text-xs text-muted-foreground/80 mt-1.5 italic">
                          "{prop.description}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Calendar Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleDownloadIcs(prop)}
                      className="text-xs h-8 gap-1.5 bg-sky-600 hover:bg-sky-500 text-white shadow-sm cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Export .ics</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Email Message Content */}
        <div className="prose prose-invert max-w-none text-sm text-foreground/90 leading-relaxed font-sans space-y-4">
          {latestMessage?.bodyHtml ? (
            <div
              className="email-body-content overflow-x-auto bg-card/20 p-4 rounded-xl border border-border/30"
              dangerouslySetInnerHTML={{ __html: latestMessage.bodyHtml }}
            />
          ) : (
            <div className="whitespace-pre-wrap font-sans text-sm bg-card/20 p-4 rounded-xl border border-border/30">
              {latestMessage?.bodyText || latestMessage?.snippet || "No text body available."}
            </div>
          )}
        </div>

        {/* Multiple Images / Attachments Gallery Section */}
        {attachments.length > 0 && (
          <div className="pt-4 border-t border-border/40 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Paperclip className="h-4 w-4 text-sky-400" />
              <span>Attachments & Images ({attachments.length})</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {attachments.map((att) => {
                const isImage = att.contentType.startsWith("image/");
                return (
                  <div
                    key={att.id}
                    className="group relative rounded-xl border border-border/60 bg-secondary/30 p-2.5 flex flex-col justify-between hover:bg-secondary/60 hover:border-border transition-all"
                  >
                    {isImage ? (
                      <div
                        onClick={() => setPreviewImage(att.filePath)}
                        className="relative h-24 w-full rounded-lg bg-card overflow-hidden flex items-center justify-center cursor-pointer mb-2"
                      >
                        <img
                          src={att.filePath}
                          alt={att.filename}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                          <Maximize2 className="h-4 w-4" />
                        </div>
                      </div>
                    ) : (
                      <div className="h-24 w-full rounded-lg bg-card/60 flex items-center justify-center text-muted-foreground mb-2">
                        <Paperclip className="h-6 w-6" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate" title={att.filename}>
                        {att.filename}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {(att.sizeBytes / 1024).toFixed(1)} KB
                      </p>
                    </div>

                    <a
                      href={att.filePath}
                      download={att.filename}
                      className="mt-2 text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download</span>
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Reply Composer & AI Draft Generator */}
        <div className="pt-6 border-t border-border/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Reply className="h-3.5 w-3.5 text-sky-400" />
              <span>Reply to {latestMessage?.senderName || latestMessage?.senderEmail}</span>
            </div>

            {/* AI Smart Reply Tone Buttons */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 mr-1">
                <Sparkles className="h-3 w-3 text-emerald-400" />
                <span>AI Draft:</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={generatingTone !== null}
                onClick={() => handleGenerateReply("concise")}
                className="text-[11px] h-7 px-2.5 bg-secondary/50 border-border hover:bg-secondary cursor-pointer"
              >
                {generatingTone === "concise" ? "Drafting..." : "Concise"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={generatingTone !== null}
                onClick={() => handleGenerateReply("professional")}
                className="text-[11px] h-7 px-2.5 bg-secondary/50 border-border hover:bg-secondary cursor-pointer"
              >
                {generatingTone === "professional" ? "Drafting..." : "Professional"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={generatingTone !== null}
                onClick={() => handleGenerateReply("enthusiastic")}
                className="text-[11px] h-7 px-2.5 bg-secondary/50 border-border hover:bg-secondary cursor-pointer"
              >
                {generatingTone === "enthusiastic" ? "Drafting..." : "Enthusiastic"}
              </Button>
            </div>
          </div>

          <div className="relative rounded-xl border border-border bg-card/40 p-1 focus-within:border-ring transition-colors">
            <textarea
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write your reply or generate one with AI above..."
              className="w-full bg-transparent p-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none resize-none"
            />
            <div className="flex items-center justify-between px-3 py-2 border-t border-border/30 bg-card/20 rounded-b-lg">
              <div className="text-[11px] text-muted-foreground">
                Sending via{" "}
                <span className="text-foreground font-medium">
                  {thread.account.emailAddress}
                </span>
              </div>
              <Button
                size="sm"
                disabled={!replyText.trim() || sendingReply}
                onClick={handleSendReply}
                className="text-xs h-7 gap-1.5 bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
              >
                <Send className="h-3 w-3" />
                <span>{sendingReply ? "Sending..." : "Send Reply"}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-border shadow-2xl">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-h-[85vh] max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
