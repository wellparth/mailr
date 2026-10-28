"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { MailSidebar, ConnectedAccount, ThreadItem } from "@/components/mail-sidebar";
import { MailDisplay } from "@/components/mail-display";
import { ComposeDialog } from "@/components/compose-dialog";
import { ConnectAccountDialog } from "@/components/connect-account-dialog";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Server, Sparkles, CheckCircle2 } from "lucide-react";
import { apiFetch, getAuthToken, removeAuthToken } from "@/lib/api";

export default function AppMailPage() {
  const router = useRouter();

  // Core user & account state
  const [user, setUser] = React.useState<{ id: string; email: string; name: string } | null>(null);
  const [accounts, setAccounts] = React.useState<ConnectedAccount[]>([]);
  const [threads, setThreads] = React.useState<ThreadItem[]>([]);
  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(null);
  const [selectedThread, setSelectedThread] = React.useState<any | null>(null);

  // Filter & Nav state
  const [navSection, setNavSection] = React.useState<"inbox" | "priority" | "starred" | "sent" | "drafts" | "trash">("inbox");
  const [selectedAccountId, setSelectedAccountId] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [unreadOnly, setUnreadOnly] = React.useState(false);

  // Dialog & Modal state
  const [isComposeOpen, setIsComposeOpen] = React.useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = React.useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  // AI Triage state
  const [triageRunning, setTriageRunning] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Check URL for OAuth callback token
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get("token");
      if (urlToken) {
        localStorage.setItem("mailr_token", urlToken);
        const email = params.get("email");
        const provider = params.get("provider");
        if (email) {
          showToast(`Authenticated via ${provider || "OAuth"} (${email})`);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Auth & Initial load
  const fetchData = React.useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        router.push("/login");
        return;
      }

      // 1. Fetch current user
      const userRes = await apiFetch("/api/auth/me");
      if (userRes && userRes.user) {
        setUser(userRes.user);
      } else {
        router.push("/login");
        return;
      }

      // 2. Fetch connected email accounts
      const accountsRes = await apiFetch("/api/accounts");
      const fetchedAccounts = accountsRes.accounts || [];
      setAccounts(fetchedAccounts);

      // Trigger Onboarding if 0 accounts exist
      if (fetchedAccounts.length === 0) {
        setIsOnboardingOpen(true);
      }

      // 3. Fetch threads
      const messagesRes = await apiFetch("/api/messages");
      const fetchedThreads = messagesRes.threads || [];
      setThreads(fetchedThreads);

      // Select first thread if none selected
      if (fetchedThreads.length > 0 && !selectedThreadId) {
        setSelectedThreadId(fetchedThreads[0].id);
        fetchThreadDetail(fetchedThreads[0].id);
      }
    } catch (err) {
      console.error("Failed to load initial data", err);
    }
  }, [router, selectedThreadId]);

  // Fetch thread detail
  const fetchThreadDetail = async (threadId: string) => {
    try {
      const res = await apiFetch(`/api/messages/thread/${threadId}`);
      if (res.thread) {
        setSelectedThread(res.thread);
      }
    } catch (err) {
      console.error("Failed to fetch thread detail", err);
    }
  };

  // SSE Real-time Live Stream
  React.useEffect(() => {
    fetchData();

    const token = getAuthToken();
    if (!token) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`http://localhost:5000/api/accounts/events?token=${token}`);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "SYNC_COMPLETE" || data.type === "EMAIL_SAVED") {
            fetchData();
          }
        } catch (e) {}
      };
    } catch (err) {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [fetchData]);

  const handleSelectThread = (id: string) => {
    setSelectedThreadId(id);
    fetchThreadDetail(id);
  };

  // Star toggle
  const handleStarToggle = async (threadId: string, currentStatus: boolean) => {
    try {
      await apiFetch(`/api/messages/thread/${threadId}/star`, {
        method: "PATCH",
        body: JSON.stringify({ isStarred: !currentStatus }),
      });
      // update local
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, isStarred: !currentStatus } : t))
      );
      if (selectedThread && selectedThread.id === threadId) {
        setSelectedThread({ ...selectedThread, isStarred: !currentStatus });
      }
    } catch (err: any) {
      console.error("Star toggle error", err);
    }
  };

  // Archive
  const handleArchive = async (threadId: string) => {
    try {
      await apiFetch(`/api/messages/thread/${threadId}/archive`, {
        method: "PATCH",
        body: JSON.stringify({ isArchived: true }),
      });
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      setSelectedThread(null);
      setSelectedThreadId(null);
      showToast("Thread archived.");
    } catch (err: any) {
      console.error("Archive error", err);
    }
  };

  // Delete
  const handleDelete = async (threadId: string) => {
    try {
      await apiFetch(`/api/messages/thread/${threadId}`, {
        method: "DELETE",
      });
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      setSelectedThread(null);
      setSelectedThreadId(null);
      showToast("Thread moved to Trash.");
    } catch (err: any) {
      console.error("Delete error", err);
    }
  };

  // Run AI Triage
  const handleTriagePromptSubmit = async (prompt: string) => {
    try {
      setTriageRunning(true);
      const res = await apiFetch("/api/ai/triage", {
        method: "POST",
        body: JSON.stringify({
          instruction: prompt,
          accountId: selectedAccountId !== "all" ? selectedAccountId : undefined,
        }),
      });

      if (res.triagedThreads && res.triagedThreads.length > 0) {
        showToast(`AI Triage complete: surfaced ${res.triagedThreads.length} matching priorities.`);
        fetchData();
        setNavSection("priority");
      } else {
        showToast("Triage analyzed all current messages. No urgent items matched.");
      }
    } catch (err: any) {
      showToast("Triage failed: " + err.message);
    } finally {
      setTriageRunning(false);
    }
  };

  const handleLogout = () => {
    removeAuthToken();
    router.push("/login");
  };

  // Filter threads based on folder, account, unreads, search
  const filteredThreads = React.useMemo(() => {
    return threads.filter((thread) => {
      // 1. Account filter
      if (selectedAccountId !== "all" && thread.accountId !== selectedAccountId) {
        return false;
      }

      // 2. Folder filter
      if (navSection === "priority") {
        if (thread.priorityLevel !== "URGENT" && thread.priorityLevel !== "HIGH") {
          return false;
        }
      } else if (navSection === "starred") {
        if (!thread.isStarred) return false;
      } else if (navSection === "trash") {
        // trash view
      }

      // 3. Unread filter
      const latestMsg = thread.messages[0];
      if (unreadOnly && latestMsg && latestMsg.isRead) {
        return false;
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const subjectMatch = thread.subject?.toLowerCase().includes(q);
        const snippetMatch = thread.snippet?.toLowerCase().includes(q);
        const senderMatch =
          latestMsg?.senderName?.toLowerCase().includes(q) ||
          latestMsg?.senderEmail?.toLowerCase().includes(q);
        if (!subjectMatch && !snippetMatch && !senderMatch) {
          return false;
        }
      }

      return true;
    });
  }, [threads, selectedAccountId, navSection, unreadOnly, searchQuery]);

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "350px" } as React.CSSProperties}
      className="h-screen w-screen overflow-hidden bg-background text-foreground flex"
    >
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed top-3 right-4 z-50 bg-secondary/95 border border-border text-foreground text-xs px-3.5 py-2 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-sky-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Two-Tier sidebar-09 Architecture */}
      <MailSidebar
        user={user}
        accounts={accounts}
        threads={filteredThreads}
        selectedThreadId={selectedThreadId}
        onSelectThread={handleSelectThread}
        activeNav={navSection}
        onNavChange={setNavSection}
        selectedAccountId={selectedAccountId}
        onAccountChange={setSelectedAccountId}
        unreadOnly={unreadOnly}
        onUnreadOnlyChange={setUnreadOnly}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenCompose={() => setIsComposeOpen(true)}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
        onTriagePromptSubmit={handleTriagePromptSubmit}
        triageRunning={triageRunning}
      />

      {/* Third Pane: Reading / Action Detail View */}
      <SidebarInset className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
        <MailDisplay
          thread={selectedThread}
          accountsCount={accounts.length}
          onStarToggle={handleStarToggle}
          onArchive={handleArchive}
          onDelete={handleDelete}
          onReplySuccess={fetchData}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
          onOpenCompose={() => setIsComposeOpen(true)}
        />
      </SidebarInset>

      {/* Compose Dialog */}
      <ComposeDialog
        open={isComposeOpen}
        onOpenChange={setIsComposeOpen}
        accounts={accounts}
        onSent={() => {
          showToast("Email dispatched successfully.");
          fetchData();
        }}
      />

      {/* Connect Additional Account Dialog */}
      <ConnectAccountDialog
        open={isConnectModalOpen}
        onOpenChange={setIsConnectModalOpen}
        onAccountConnected={() => {
          showToast("Email account connected successfully.");
          fetchData();
        }}
      />

      {/* Onboarding Wizard (auto-opens if 0 accounts exist) */}
      <OnboardingWizard
        open={isOnboardingOpen}
        onOpenChange={setIsOnboardingOpen}
        user={user}
        onCompleted={() => {
          fetchData();
        }}
      />

      {/* Settings & Security Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md bg-card border-border text-foreground shadow-2xl rounded-2xl p-6">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-secondary text-foreground">
                <Shield className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Mailr Security & Privacy
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Client-side encrypted architecture overview.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs text-muted-foreground">
            <div className="bg-secondary/40 rounded-xl p-3 border border-border/50 space-y-2">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <Lock className="h-4 w-4 text-emerald-400" />
                <span>AES-256-GCM Zero-Knowledge Storage</span>
              </div>
              <p className="leading-relaxed">
                OAuth refresh tokens, IMAP passwords, and SMTP secrets are never stored in plain text.
                Every credential undergoes an authenticated AES-256-GCM cipher with a unique initialization vector.
              </p>
            </div>

            <div className="bg-secondary/40 rounded-xl p-3 border border-border/50 space-y-2">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <Server className="h-4 w-4 text-sky-400" />
                <span>Docker VPS Deployment Ready</span>
              </div>
              <p className="leading-relaxed">
                Mailr is containerized with Docker, docker-compose, and Nginx reverse proxy.
                Self-host on any Linux VPS or run locally with MySQL XAMPP.
              </p>
            </div>

            <div className="flex items-center justify-between text-xs pt-2">
              <span className="text-muted-foreground">Connected Inboxes:</span>
              <span className="font-semibold text-foreground">{accounts.length} active</span>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-border/50">
            <Button
              size="sm"
              onClick={() => setIsSettingsOpen(false)}
              className="text-xs h-8 bg-secondary hover:bg-secondary/80 text-foreground"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
