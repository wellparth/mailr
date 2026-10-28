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
}

export function ComposeDialog({
  open,
  onOpenChange,
  accounts,
  onSent,
}: ComposeDialogProps) {
  const [selectedAccountId, setSelectedAccountId] = React.useState<string>("");
  const [to, setTo] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [bodyText, setBodyText] = React.useState("");
  const [attachments, setAttachments] = React.useState<AttachedFile[]>([]);
  const [sending, setSending] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

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
    // Reset file input so same file can be re-selected if needed
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
    if (!to || !selectedAccountId) return;

    try {
      setSending(true);

      // Convert attachments to payload
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

      await apiFetch("/api/messages/send", {
        method: "POST",
        body: JSON.stringify({
          accountId: selectedAccountId,
          to,
          subject: subject || "(No Subject)",
          bodyText,
          attachments: attachmentPayloads,
        }),
      });

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
    } catch (err: any) {
      alert("Failed to send email: " + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border text-foreground shadow-2xl rounded-2xl p-6">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <ImageIcon className="h-4 w-4" />
            </div>
            <DialogTitle className="text-sm font-semibold">
              New Message & Multi-Image Composer
            </DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSend} className="space-y-3 mt-2">
          {/* Account selector */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground w-12 shrink-0">From:</Label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="flex-1 h-8 text-xs bg-secondary/40 border border-border/60 rounded-md px-2 text-foreground focus:outline-none"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id} className="bg-card text-foreground">
                  {acc.displayName || acc.emailAddress} ({acc.emailAddress})
                </option>
              ))}
            </select>
          </div>

          {/* Recipient */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground w-12 shrink-0">To:</Label>
            <Input
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@domain.com"
              className="h-8 text-xs bg-secondary/30 border-border/60"
            />
          </div>

          {/* Subject */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground w-12 shrink-0">Subject:</Label>
            <Input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="h-8 text-xs bg-secondary/30 border-border/60"
            />
          </div>

          {/* Body */}
          <div className="pt-1">
            <textarea
              rows={7}
              required
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Write your email message..."
              className="w-full bg-secondary/20 border border-border/60 rounded-xl p-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-ring resize-none font-sans leading-relaxed"
            />
          </div>

          {/* Multi-Image & File Attachment Previews */}
          {attachments.length > 0 && (
            <div className="space-y-2 pt-1 border-t border-border/40">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-sky-400" />
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-40 overflow-y-auto p-1">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="relative rounded-lg border border-border/80 bg-secondary/40 p-1.5 flex flex-col justify-between group overflow-hidden"
                  >
                    {att.previewUrl ? (
                      <div className="relative h-16 w-full rounded overflow-hidden bg-card mb-1">
                        <img
                          src={att.previewUrl}
                          alt={att.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-16 w-full rounded bg-card/70 flex items-center justify-center text-muted-foreground mb-1">
                        <FileText className="h-6 w-6" />
                      </div>
                    )}

                    <div className="min-w-0 pr-4">
                      <p className="text-[10px] font-medium text-foreground truncate" title={att.name}>
                        {att.name}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {(att.size / 1024).toFixed(1)} KB
                      </p>
                    </div>

                    {/* Remove button */}
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

          {/* Actions & Attachment Trigger */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            {/* Attachment Button */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs h-8 gap-1.5 bg-secondary/40 border-border hover:bg-secondary cursor-pointer"
              >
                <ImageIcon className="h-3.5 w-3.5 text-sky-400" />
                <span>Attach Images / Files</span>
              </Button>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                (PNG, JPG, WebP, GIF, PDF)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs h-8 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Discard
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={sending}
                className="text-xs h-8 gap-1.5 bg-sky-600 hover:bg-sky-500 text-white shadow-sm cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{sending ? "Sending..." : "Send Email"}</span>
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
