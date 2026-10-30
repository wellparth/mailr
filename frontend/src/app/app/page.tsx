"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { MailSidebar, ConnectedAccount, ThreadItem } from "@/components/mail-sidebar";
import { MailDisplay } from "@/components/mail-display";
import { ComposeDialog } from "@/components/compose-dialog";
import { ConnectAccountDialog } from "@/components/connect-account-dialog";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { SettingsDialog } from "@/components/settings-dialog";
import { AICopilotDrawer } from "@/components/ai-copilot-drawer";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2 } from "lucide-react";
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
  const [isCopilotOpen, setIsCopilotOpen] = React.useState(false);
  const [composerPrefill, setComposerPrefill] = React.useState<{
    draftText: string;
    subject: string;
    to: string;
  } | null>(null);

  // Global shortcut: Ctrl+J / Cmd+J toggles AI Copilot
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsCopilotOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleInsertDraftToComposer = (draftText: string, subject?: string, recipientEmail?: string) => {
    setComposerPrefill({
      draftText,
      subject: subject || "",
      to: recipientEmail || "",
    });
    setIsCopilotOpen(false);
    setIsComposeOpen(true);
  };

  // AI Triage state
  const [triageRunning, setTriageRunning] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // Pagination state
  const [page, setPage] = React.useState(1);
  const [totalThreads, setTotalThreads] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSyncNow = async (deep: boolean = false) => {
    if (isSyncing) return;
    setIsSyncing(true);
    showToast(deep ? "Deep syncing all past emails from your mailbox..." : "Syncing mailboxes...");
    try {
      const endpoint =
        selectedAccountId && selectedAccountId !== "all"
          ? `/api/accounts/${selectedAccountId}/sync${deep ? "?full=true" : ""}`
          : `/api/accounts/sync${deep ? "?full=true" : ""}`;
      const res = await apiFetch(endpoint, { method: "POST" });
      if (res && res.success !== false) {
        showToast(res.message || "Mailbox synced successfully.");
        await fetchData();
      } else {
        showToast(res?.error || "Sync completed.");
      }
    } catch (err: any) {
      showToast(err?.message || "Sync failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await apiFetch(`/api/messages?page=${nextPage}&limit=150`);
      const newThreads = res.threads || [];
      if (newThreads.length > 0) {
        setThreads((prev) => [...prev, ...newThreads]);
        setPage(nextPage);
        setHasMore(Boolean(res.pagination?.hasMore));
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Failed to load more threads", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Fetch thread detail
  const fetchThreadDetail = React.useCallback(async (threadId: string) => {
    try {
      const res = await apiFetch(`/api/messages/thread/${threadId}`);
      if (res.thread) {
        setSelectedThread(res.thread);
      }
    } catch (err) {
      console.error("Failed to fetch thread detail", err);
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

      // 3. Fetch threads (request up to 150 items)
      const messagesRes = await apiFetch("/api/messages?limit=150");
      const fetchedThreads = messagesRes.threads || [];
      setThreads(fetchedThreads);
      setTotalThreads(messagesRes.pagination?.total || fetchedThreads.length);
      setHasMore(Boolean(messagesRes.pagination?.hasMore));
      setPage(1);

      // Select first thread if none selected
      if (fetchedThreads.length > 0 && !selectedThreadId) {
        setSelectedThreadId(fetchedThreads[0].id);
        fetchThreadDetail(fetchedThreads[0].id);
      }
    } catch (err) {
      console.error("Failed to load initial data", err);
    }
  }, [router, selectedThreadId, fetchThreadDetail]);

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
        fetchData();
      }
    }
  }, [fetchData]);

  // SSE Real-time Live Stream
  React.useEffect(() => {
    fetchData();

    const token = getAuthToken();
    if (!token) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`http://localhost:5000/api/messages/stream?token=${token}`);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "SYNC_PROGRESS") {
            showToast(`Syncing: ${data.ingestedCount} emails processed...`);
          } else if (data.type === "SYNC_COMPLETE" || data.type === "EMAIL_SAVED") {
            showToast(`Sync complete! Ingested ${data.ingestedCount || "new"} emails.`);
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
        onSyncNow={() => handleSyncNow(false)}
        syncing={isSyncing}
        totalThreads={totalThreads}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={handleLoadMore}
        onDeepSyncNow={() => handleSyncNow(true)}
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
          onOpenCopilot={() => setIsCopilotOpen(true)}
        />
      </SidebarInset>

      {/* Compose Dialog */}
      <ComposeDialog
        open={isComposeOpen}
        onOpenChange={(open) => {
          setIsComposeOpen(open);
          if (!open) setComposerPrefill(null);
        }}
        accounts={accounts}
        initialDraftText={composerPrefill?.draftText}
        initialSubject={composerPrefill?.subject}
        initialTo={composerPrefill?.to}
        onSent={() => {
          showToast("Email dispatched successfully.");
          setComposerPrefill(null);
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
      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        accountsCount={accounts.length}
      />

      {/* Autonomous AI Copilot Drawer */}
      <AICopilotDrawer
        open={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        activeThread={selectedThread}
        onInsertDraftToComposer={handleInsertDraftToComposer}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
    </SidebarProvider>
  );
}
