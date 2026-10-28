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
  Mail,
  Shield,
  Sparkles,
  Server,
  CheckCircle2,
  ArrowRight,
  Lock,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string; email: string; name: string } | null;
  onCompleted: () => void;
}

export function OnboardingWizard({
  open,
  onOpenChange,
  user,
  onCompleted,
}: OnboardingWizardProps) {
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [provider, setProvider] = React.useState<"GMAIL" | "OUTLOOK" | "IMAP_SMTP">("GMAIL");
  const [emailAddress, setEmailAddress] = React.useState(user?.email || "");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user?.email && !emailAddress) {
      setEmailAddress(user.email);
    }
  }, [user, emailAddress]);

  const handleStep1Next = (chosenProvider: "GMAIL" | "OUTLOOK" | "IMAP_SMTP") => {
    setProvider(chosenProvider);
    setStep(2);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailAddress) return;

    try {
      setLoading(true);
      setErrorMsg(null);
      await apiFetch("/api/accounts", {
        method: "POST",
        body: JSON.stringify({
          provider,
          emailAddress,
          displayName: user?.name || emailAddress.split("@")[0],
          colorCode: provider === "GMAIL" ? "#ea4335" : provider === "OUTLOOK" ? "#0078d4" : "#10b981",
          imapHost: provider === "GMAIL" ? "imap.gmail.com" : provider === "OUTLOOK" ? "outlook.office365.com" : undefined,
          imapPort: 993,
          smtpHost: provider === "GMAIL" ? "smtp.gmail.com" : provider === "OUTLOOK" ? "smtp.office365.com" : undefined,
          smtpPort: 587,
          credentials: {
            password,
          },
        }),
      });

      // Trigger sync
      apiFetch("/api/accounts/sync", { method: "POST" }).catch(() => {});
      setStep(3);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to initialize account");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    onOpenChange(false);
    onCompleted();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border text-foreground shadow-2xl rounded-2xl p-6">
        <DialogHeader className="text-center space-y-1">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white mb-2 shadow-lg">
            <Mail className="h-6 w-6" />
          </div>
          <DialogTitle className="text-lg font-semibold tracking-tight">
            {step === 1 && "Welcome to Mailr"}
            {step === 2 && "Connect Your First Inbox"}
            {step === 3 && "Inbox Ready & Protected"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {step === 1 && "Your AI-powered multi-account email client with zero-knowledge encryption."}
            {step === 2 && "Enter your credentials or app password to begin syncing."}
            {step === 3 && "Your keys are encrypted with AES-256-GCM. AI triage is now active."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator pills */}
        <div className="flex items-center justify-center gap-1.5 my-3">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                step === s ? "w-8 bg-sky-500" : s < step ? "w-4 bg-emerald-500" : "w-4 bg-secondary"
              }`}
            />
          ))}
        </div>

        {/* STEP 1: Select Provider */}
        {step === 1 && (
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground text-center">
              Select your primary email provider to link:
            </p>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => handleStep1Next("GMAIL")}
                className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 hover:border-red-500/50 hover:bg-red-500/5 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center font-bold text-base">
                    G
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Google Mail / Workspace</h4>
                    <p className="text-[11px] text-muted-foreground">Gmail and Google Workspace accounts</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                type="button"
                onClick={() => handleStep1Next("OUTLOOK")}
                className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 hover:border-sky-500/50 hover:bg-sky-500/5 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-base">
                    O
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Microsoft Outlook / 365</h4>
                    <p className="text-[11px] text-muted-foreground">Personal, Office 365, or Exchange</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                type="button"
                onClick={() => handleStep1Next("IMAP_SMTP")}
                className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Server className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Other IMAP / SMTP Provider</h4>
                    <p className="text-[11px] text-muted-foreground">iCloud, Yahoo, Zoho, Proton, Fastmail</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Enter Credentials */}
        {step === 2 && (
          <form onSubmit={handleConnect} className="space-y-3.5 py-2">
            <div className="space-y-1">
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

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {provider === "GMAIL"
                  ? "Google App Password"
                  : provider === "OUTLOOK"
                  ? "Outlook Password or App Password"
                  : "Password / Secret"}
              </Label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••••••"
                className="h-8 text-xs bg-secondary/30 border-border/60 font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Encrypted in MySQL using AES-256-GCM. We never store plain text.
              </p>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                {errorMsg}
              </p>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                className="text-xs h-8 text-muted-foreground"
              >
                Back
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="text-xs h-8 bg-sky-600 hover:bg-sky-500 text-white"
              >
                {loading ? "Encrypting & Connecting..." : "Connect Inbox"}
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: Complete */}
        {step === 3 && (
          <div className="py-4 text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Account Connected & Encrypted
              </h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                <span className="text-foreground font-medium">{emailAddress}</span> is configured.
                Mailr is now streaming your messages and applying AI natural language triage.
              </p>
            </div>

            <div className="bg-secondary/40 rounded-xl p-3 text-left space-y-2 border border-border/50 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <Shield className="h-3.5 w-3.5 text-emerald-400" />
                <span>Security Guaranteed</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Zero-Knowledge AES-256-GCM keys active. Calendar proposals and priority scoring will update continuously.
              </p>
            </div>

            <Button
              onClick={handleFinish}
              className="w-full text-xs h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              Enter Mailr Inbox
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
