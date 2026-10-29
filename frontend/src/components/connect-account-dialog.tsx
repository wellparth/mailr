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
  const [useManualPassword, setUseManualPassword] = React.useState(false);

  // Direct Google OAuth authorization trigger
  const handleGoogleOAuthDirect = async () => {
    try {
      const res = await apiFetch<{ configured: boolean; url: string | null; message?: string }>('/auth/google/url');
      if (res && res.configured && res.url) {
        window.location.href = res.url;
      } else {
        alert(res?.message || 'Google OAuth is not configured in backend .env.');
      }
    } catch (err: any) {
      alert('OAuth initialization error: ' + err.message);
    }
  };

  // Auto-populate server settings based on provider
  const handleProviderSelect = (p: "GMAIL" | "OUTLOOK" | "IMAP_SMTP") => {
    setProvider(p);
    setTestResult(null);
    setUseManualPassword(false);
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

        {provider === "GMAIL" && !useManualPassword ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-center space-y-3">
              <div className="flex justify-center">
                <div className="p-2.5 rounded-2xl bg-card border border-border shadow-sm">
                  <svg className="h-6 w-6" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.14C3.25 21.34 7.34 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.59H1.26C.46 8.18 0 9.97 0 12s.46 3.82 1.26 5.41l4.02-3.14z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.25 2.66 1.26 6.59l4.02 3.14c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-foreground">Direct 1-Click Google OAuth</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  No app passwords or manual IMAP ports required. Mailr connects directly via official Google OAuth 2.0 with AES-256-GCM encrypted tokens and syncs your inbox automatically.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleGoogleOAuthDirect}
                className="w-full text-xs h-9 bg-red-600 hover:bg-red-500 text-white font-medium cursor-pointer shadow-sm gap-2"
              >
                <span className="font-bold">G</span>
                <span>Connect via Google OAuth 2.0</span>
              </Button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setUseManualPassword(true)}
                className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
              >
                Or connect manually with App Password & IMAP
              </button>
            </div>
          </div>
        ) : (
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
        )}
      </DialogContent>
    </Dialog>
  );
}
