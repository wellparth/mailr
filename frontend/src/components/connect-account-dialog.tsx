"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Server,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Lock,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface ConnectAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountConnected: () => void;
}

export function ConnectAccountDialog({
  open,
  onOpenChange,
  onAccountConnected,
}: ConnectAccountDialogProps) {
  const [provider, setProvider] = React.useState<"GMAIL" | "OUTLOOK" | "IMAP_SMTP">("GMAIL");
  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [colorCode, setColorCode] = React.useState("#38bdf8");
  const [imapHost, setImapHost] = React.useState("");
  const [imapPort, setImapPort] = React.useState(993);
  const [smtpHost, setSmtpHost] = React.useState("");
  const [smtpPort, setSmtpPort] = React.useState(587);

  const [testingConnection, setTestingConnection] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Auto-populate server settings based on provider
  const handleProviderSelect = (p: "GMAIL" | "OUTLOOK" | "IMAP_SMTP") => {
    setProvider(p);
    setTestResult(null);
    if (p === "GMAIL") {
      setColorCode("#ea4335");
      setImapHost("imap.gmail.com");
      setImapPort(993);
      setSmtpHost("smtp.gmail.com");
      setSmtpPort(587);
    } else if (p === "OUTLOOK") {
      setColorCode("#0078d4");
      setImapHost("outlook.office365.com");
      setImapPort(993);
      setSmtpHost("smtp.office365.com");
      setSmtpPort(587);
    } else {
      setColorCode("#10b981");
      setImapHost("");
      setImapPort(993);
      setSmtpHost("");
      setSmtpPort(587);
    }
  };

  // Test IMAP/SMTP handshake
  const handleTestConnection = async () => {
    if (!imapHost || !emailAddress || !password) {
      setTestResult({
        success: false,
        message: "Please fill in email, password/app password, and IMAP host.",
      });
      return;
    }

    try {
      setTestingConnection(true);
      setTestResult(null);
      const res = await apiFetch("/api/accounts/test-connection", {
        method: "POST",
        body: JSON.stringify({
          provider,
          emailAddress,
          credentials: {
            password,
            imapHost,
            imapPort: Number(imapPort),
            smtpHost,
            smtpPort: Number(smtpPort),
          },
        }),
      });

      setTestResult({
        success: res.success,
        message: res.message || "Connection validated successfully!",
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Connection handshake failed.",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Submit and save connected account
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailAddress) return;

    try {
      setSaving(true);
      await apiFetch("/api/accounts", {
        method: "POST",
        body: JSON.stringify({
          provider,
          emailAddress,
          displayName: displayName || emailAddress,
          colorCode,
          imapHost: provider === "IMAP_SMTP" ? imapHost : undefined,
          imapPort: provider === "IMAP_SMTP" ? Number(imapPort) : undefined,
          smtpHost: provider === "IMAP_SMTP" ? smtpHost : undefined,
          smtpPort: provider === "IMAP_SMTP" ? Number(smtpPort) : undefined,
          credentials: {
            password,
            imapHost,
            imapPort: Number(imapPort),
            smtpHost,
            smtpPort: Number(smtpPort),
          },
        }),
      });

      onAccountConnected();
      onOpenChange(false);
      // Reset form
      setEmailAddress("");
      setPassword("");
      setDisplayName("");
      setTestResult(null);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: "Failed to save account: " + err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border text-foreground shadow-2xl rounded-2xl p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Connect Email Account
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                All credentials & tokens are secured with AES-256-GCM zero-knowledge encryption.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Provider Selector Tabs */}
        <div className="grid grid-cols-3 gap-2 my-2">
          <button
            type="button"
            onClick={() => handleProviderSelect("GMAIL")}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
              provider === "GMAIL"
                ? "bg-red-500/10 border-red-500/50 text-red-400 font-semibold"
                : "border-border/60 hover:bg-secondary/50 text-muted-foreground"
            }`}
          >
            <span className="text-sm font-bold text-red-500 mb-0.5">G</span>
            <span>Google Mail</span>
          </button>
          <button
            type="button"
            onClick={() => handleProviderSelect("OUTLOOK")}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
              provider === "OUTLOOK"
                ? "bg-sky-500/10 border-sky-500/50 text-sky-400 font-semibold"
                : "border-border/60 hover:bg-secondary/50 text-muted-foreground"
            }`}
          >
            <span className="text-sm font-bold text-sky-500 mb-0.5">O</span>
            <span>Outlook / 365</span>
          </button>
          <button
            type="button"
            onClick={() => handleProviderSelect("IMAP_SMTP")}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
              provider === "IMAP_SMTP"
                ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 font-semibold"
                : "border-border/60 hover:bg-secondary/50 text-muted-foreground"
            }`}
          >
            <Server className="h-4 w-4 mb-0.5 text-emerald-400" />
            <span>IMAP / SMTP</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email Address</Label>
            <Input
              type="email"
              required
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="you@domain.com"
              className="h-8 text-xs bg-secondary/30 border-border/60"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Display Name</Label>
            <Input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Work Mail or Personal"
              className="h-8 text-xs bg-secondary/30 border-border/60"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {provider === "GMAIL"
                ? "Google App Password (16 characters)"
                : provider === "OUTLOOK"
                ? "Outlook / Microsoft App Password"
                : "Mail Password"}
            </Label>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••••••"
              className="h-8 text-xs bg-secondary/30 border-border/60 font-mono"
            />
          </div>

          {provider === "IMAP_SMTP" && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">IMAP Host</Label>
                <Input
                  type="text"
                  required
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  placeholder="imap.mail.me.com"
                  className="h-7 text-xs bg-secondary/30 border-border/60"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">IMAP Port</Label>
                <Input
                  type="number"
                  value={imapPort}
                  onChange={(e) => setImapPort(Number(e.target.value))}
                  className="h-7 text-xs bg-secondary/30 border-border/60"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">SMTP Host</Label>
                <Input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.mail.me.com"
                  className="h-7 text-xs bg-secondary/30 border-border/60"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">SMTP Port</Label>
                <Input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  className="h-7 text-xs bg-secondary/30 border-border/60"
                />
              </div>
            </div>
          )}

          {/* Color tag picker */}
          <div className="flex items-center justify-between pt-1">
            <Label className="text-xs text-muted-foreground">Inbox Tag Color</Label>
            <div className="flex items-center gap-2">
              {["#38bdf8", "#818cf8", "#34d399", "#f43f5e", "#fbbf24"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColorCode(c)}
                  className={`h-5 w-5 rounded-full border-2 transition-transform ${
                    colorCode === c ? "scale-110 border-white" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                testResult.success
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-950/40 border-rose-500/30 text-rose-300"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span className="leading-tight">{testResult.message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testingConnection || saving}
              onClick={handleTestConnection}
              className="text-xs h-8 bg-secondary/40 border-border hover:bg-secondary"
            >
              {testingConnection ? "Testing..." : "Test Connection"}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs h-8 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="text-xs h-8 bg-sky-600 hover:bg-sky-500 text-white shadow-sm"
              >
                {saving ? "Saving..." : "Save Account"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
