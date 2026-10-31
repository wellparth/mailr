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
import { CommandPalette, CommandItem } from "@/components/command-palette";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { MorningBriefingDialog } from "@/components/morning-briefing-dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, PenSquare, RotateCcw, Clock, Calendar, SunMedium, Keyboard, Inbox, Send, FileText, Trash2, Archive, Bot, Star, RefreshCw, Settings, PanelLeft, PanelLeftClose, PanelLeftOpen, Columns } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [navSection, setNavSection] = React.useState<any>("inbox");
  const [selectedAccountId, setSelectedAccountId] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [unreadOnly, setUnreadOnly] = React.useState(false);

  // Dialog & Modal state
  const [isComposeOpen, setIsComposeOpen] = React.useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = React.useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = React.useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = React.useState(false);
  const [isBriefingOpen, setIsBriefingOpen] = React.useState(false);

  // Collapsible & Resizable Sidebar state
  const [isRailCollapsed, setIsRailCollapsed] = React.useState<boolean>(false);
  const [mailListWidth, setMailListWidth] = React.useState<number>(340);
  const [isDraggingSidebar, setIsDraggingSidebar] = React.useState(false);

  // Restore sidebar preferences from localStorage on mount
  React.useEffect(() => {
    try {
      const savedCollapsed = localStorage.getItem("mailr_rail_collapsed");
      if (savedCollapsed !== null) {
        setIsRailCollapsed(savedCollapsed === "true");
      }
      const savedWidth = localStorage.getItem("mailr_mail_list_width");
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= 260 && parsed <= 700) {
          setMailListWidth(parsed);
        }
      }
    } catch {
      // LocalStorage access restricted or unavailable
    }
  }, []);

  const handleToggleRail = React.useCallback(() => {
    setIsRailCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("mailr_rail_collapsed", String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleMailListWidthChange = React.useCallback((width: number) => {
    setMailListWidth(width);
    try {
      localStorage.setItem("mailr_mail_list_width", String(width));
    } catch {}
  }, []);

  const totalSidebarWidth = (isRailCollapsed ? 0 : 56) + mailListWidth;

  // Undo Send Grace Window (5 seconds)
  const [undoSendQueue, setUndoSendQueue] = React.useState<{
    id: string;
    payload: any;
    secondsRemaining: number;
  } | null>(null);
  const undoTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [composerPrefill, setComposerPrefill] = React.useState<{
    draftText: string;
    subject: string;
    to: string;
  } | null>(null);



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

  // Check URL for OAuth callback code or legacy token
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get("code");
      const urlToken = params.get("token");
      const email = params.get("email");
      const provider = params.get("provider");

      if (urlCode) {
        window.history.replaceState({}, document.title, window.location.pathname);
        apiFetch<{ token: string; user: any }>("/api/auth/exchange-code", {
          method: "POST",
          body: JSON.stringify({ code: urlCode }),
        })
          .then((res) => {
            if (res.token) {
              localStorage.setItem("mailr_token", res.token);
              if (email) {
                showToast(`Authenticated via ${provider || "OAuth"} (${email})`);
              }
              fetchData();
            }
          })
          .catch((err) => {
            console.error("Failed to exchange OAuth code for session token", err);
          });
      } else if (urlToken) {
        localStorage.setItem("mailr_token", urlToken);
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
    let isMounted = true;

    // Use short-lived stream ticket instead of exposing primary JWT in GET URL
    apiFetch<{ success: boolean; ticket: string }>("/api/messages/stream/ticket", {
      method: "POST",
    })
      .then((res) => {
        if (!isMounted) return;
        const streamUrl = res?.ticket
          ? `http://localhost:5000/api/messages/stream?ticket=${encodeURIComponent(res.ticket)}`
          : `http://localhost:5000/api/messages/stream?token=${encodeURIComponent(token)}`;

        eventSource = new EventSource(streamUrl);
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
      })
      .catch(() => {
        if (!isMounted) return;
        try {
          eventSource = new EventSource(`http://localhost:5000/api/messages/stream?token=${encodeURIComponent(token)}`);
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
      });

    return () => {
      isMounted = false;
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


  // Queue Send with 5-Second Undo Grace Period
  const handleQueueSend = (payload: any) => {
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);

    const queueId = Math.random().toString(36).substring(2, 9);
    setUndoSendQueue({
      id: queueId,
      payload,
      secondsRemaining: 5,
    });

    // Countdown interval
    const interval = setInterval(() => {
      setUndoSendQueue((prev) => {
        if (!prev || prev.id !== queueId) {
          clearInterval(interval);
          return null;
        }
        if (prev.secondsRemaining <= 1) {
          clearInterval(interval);
          // Dispatch email over network
          apiFetch("/api/messages/send", {
            method: "POST",
            body: JSON.stringify(prev.payload),
          })
            .then(() => {
              showToast("Email dispatched successfully.");
              fetchData();
            })
            .catch((err) => {
              showToast("Failed to dispatch: " + err.message);
            });
          return null;
        }
        return { ...prev, secondsRemaining: prev.secondsRemaining - 1 };
      });
    }, 1000);

    undoTimerRef.current = interval;
  };

  const handleCancelUndoSend = () => {
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    if (undoSendQueue) {
      setComposerPrefill({
        draftText: undoSendQueue.payload.bodyText,
        subject: undoSendQueue.payload.subject,
        to: undoSendQueue.payload.to,
      });
      setIsComposeOpen(true);
      setUndoSendQueue(null);
      showToast("Email sending cancelled. Draft restored.");
    }
  };

  const handleImmediateSend = () => {
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    if (undoSendQueue) {
      apiFetch("/api/messages/send", {
        method: "POST",
        body: JSON.stringify(undoSendQueue.payload),
      })
        .then(() => {
          showToast("Email dispatched immediately.");
          fetchData();
        })
        .catch((err) => {
          showToast("Failed to dispatch: " + err.message);
        });
      setUndoSendQueue(null);
    }
  };

  const handleSnooze = async (threadId: string, until: string | null) => {
    try {
      await apiFetch(`/api/messages/thread/${threadId}/snooze`, {
        method: "POST",
        body: JSON.stringify({ snoozedUntil: until }),
      });
      showToast(until ? `Thread snoozed until ${new Date(until).toLocaleString()}` : "Thread unsnoozed");
      fetchData();
    } catch (err: any) {
      console.error("Snooze error", err);
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


  // Command Palette Items configuration
  const commandPaletteItems: CommandItem[] = React.useMemo(() => [
    {
      id: "compose",
      category: "Actions",
      title: "Compose New Email",
      subtitle: "Write an email from any connected identity",
      shortcut: "C",
      icon: PenSquare,
      action: () => setIsComposeOpen(true),
    },
    {
      id: "briefing",
      category: "AI & Copilot",
      title: "Executive Morning Briefing",
      subtitle: "Daily overview of urgent items & meetings",
      icon: SunMedium,
      action: () => setIsBriefingOpen(true),
    },
    {
      id: "copilot",
      category: "AI & Copilot",
      title: "Toggle AI Copilot Drawer",
      subtitle: "Chat, generate thread notes, schedule calls",
      shortcut: "Cmd+J",
      icon: Bot,
      action: () => setIsCopilotOpen((p) => !p),
    },
    {
      id: "inbox",
      category: "Navigation",
      title: "Go to Inbox",
      icon: Inbox,
      action: () => setNavSection("inbox"),
    },
    {
      id: "priority",
      category: "Navigation",
      title: "Go to Priority AI",
      icon: Sparkles,
      action: () => setNavSection("priority"),
    },
    {
      id: "snoozed",
      category: "Navigation",
      title: "Go to Snoozed",
      icon: Clock,
      action: () => setNavSection("snoozed"),
    },
    {
      id: "scheduled",
      category: "Navigation",
      title: "Go to Scheduled",
      icon: Calendar,
      action: () => setNavSection("scheduled"),
    },
    {
      id: "starred",
      category: "Navigation",
      title: "Go to Starred",
      icon: Star,
      action: () => setNavSection("starred"),
    },
    {
      id: "sync",
      category: "Actions",
      title: "Deep Sync All Mailboxes",
      subtitle: "Ingest remote messages from all accounts",
      icon: RefreshCw,
      action: () => handleSyncNow(true),
    },
    {
      id: "toggle-rail",
      category: "Navigation",
      title: isRailCollapsed ? "Expand Left Sidebar" : "Collapse Left Sidebar",
      subtitle: "Toggle icon navigation rail on the far left",
      shortcut: "[",
      icon: isRailCollapsed ? PanelLeftOpen : PanelLeftClose,
      action: handleToggleRail,
    },
    {
      id: "reset-mail-list-width",
      category: "Navigation",
      title: "Reset Mail List Width",
      subtitle: "Reset email list sidebar to default 340px",
      icon: Columns,
      action: () => handleMailListWidthChange(340),
    },
    {
      id: "shortcuts",
      category: "Settings",
      title: "Keyboard Shortcuts Guide",
      shortcut: "?",
      icon: Keyboard,
      action: () => setIsShortcutsOpen(true),
    },
    {
      id: "settings",
      category: "Settings",
      title: "Mailr Settings & Bring-Your-Own-Key",
      icon: Settings,
      action: () => setIsSettingsOpen(true),
    },
  ], [handleSyncNow, isRailCollapsed, handleToggleRail, handleMailListWidthChange]);

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
      } else if (navSection === "snoozed") {
        // snoozed view
      } else if (navSection === "scheduled") {
        // scheduled view
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

  // Global Superhuman Shortcuts & Command Palette
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Command Palette: Cmd+K / Ctrl+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // 2. AI Copilot: Cmd+J / Ctrl+J
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsCopilotOpen((prev) => !prev);
        return;
      }

      // 3. Toggle navigation rail: Cmd+B / Ctrl+B
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handleToggleRail();
        return;
      }

      // If user is focused inside an input, textarea, or contentEditable element, ignore single-key hotkeys
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      // 3. Single-Key Hotkeys
      if (e.key === "?") {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        setIsComposeOpen(true);
      } else if (e.key === "/") {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      } else if (e.key === "z" || e.key === "Z") {
        // Undo send hotkey
        if (undoSendQueue) {
          e.preventDefault();
          handleCancelUndoSend();
        }
      } else if (e.key === "j" || e.key === "ArrowDown") {
        // Next conversation
        e.preventDefault();
        if (filteredThreads.length > 0) {
          const currentIndex = filteredThreads.findIndex((t) => t.id === selectedThreadId);
          const nextIndex = currentIndex < filteredThreads.length - 1 ? currentIndex + 1 : 0;
          const nextThread = filteredThreads[nextIndex];
          if (nextThread) {
            setSelectedThreadId(nextThread.id);
            fetchThreadDetail(nextThread.id);
          }
        }
      } else if (e.key === "k" || e.key === "ArrowUp") {
        // Previous conversation
        e.preventDefault();
        if (filteredThreads.length > 0) {
          const currentIndex = filteredThreads.findIndex((t) => t.id === selectedThreadId);
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredThreads.length - 1;
          const prevThread = filteredThreads[prevIndex];
          if (prevThread) {
            setSelectedThreadId(prevThread.id);
            fetchThreadDetail(prevThread.id);
          }
        }
      } else if (e.key === "e") {
        // Archive
        if (selectedThreadId) {
          e.preventDefault();
          handleArchive(selectedThreadId);
        }
      } else if (e.key === "s") {
        // Star
        if (selectedThread && selectedThreadId) {
          e.preventDefault();
          handleStarToggle(selectedThreadId, selectedThread.isStarred);
        }
      } else if (e.key === "r") {
        // Reply
        if (selectedThread) {
          e.preventDefault();
          const latestMsg = selectedThread.messages?.[selectedThread.messages.length - 1];
          setComposerPrefill({
            draftText: "",
            subject: selectedThread.subject?.startsWith("Re:") ? selectedThread.subject : `Re: ${selectedThread.subject || ""}`,
            to: latestMsg?.senderEmail || "",
          });
          setIsComposeOpen(true);
        }
      } else if (e.key === "[" || e.key === "]") {
        e.preventDefault();
        handleToggleRail();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredThreads, selectedThreadId, selectedThread, undoSendQueue, handleToggleRail]);

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${totalSidebarWidth}px` } as React.CSSProperties}
      className={cn(
        "h-screen w-screen overflow-hidden bg-background text-foreground flex",
        isDraggingSidebar && "[&_*]:select-none"
      )}
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
        onOpenBriefing={() => setIsBriefingOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        isRailCollapsed={isRailCollapsed}
        onToggleRail={handleToggleRail}
        mailListWidth={mailListWidth}
        onMailListWidthChange={handleMailListWidthChange}
        isDragging={isDraggingSidebar}
        setIsDragging={setIsDraggingSidebar}
      />

      {/* Third Pane: Reading / Action Detail View & AI Copilot Split */}
      <SidebarInset className="flex-1 flex flex-row h-screen overflow-hidden bg-background relative min-w-0">
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 transition-all duration-200 ease-in-out">
          <MailDisplay
            thread={selectedThread}
            accountsCount={accounts.length}
            onStarToggle={handleStarToggle}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onReplySuccess={fetchData}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onOpenCompose={() => setIsComposeOpen(true)}
            onOpenCopilot={() => setIsCopilotOpen((prev) => !prev)}
            isCopilotOpen={isCopilotOpen}
            onSnooze={handleSnooze}
          />
        </div>

        {/* Autonomous AI Copilot Drawer */}
        <AICopilotDrawer
          open={isCopilotOpen}
          onClose={() => setIsCopilotOpen(false)}
          activeThread={selectedThread}
          onInsertDraftToComposer={handleInsertDraftToComposer}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSelectThread={(id) => {
            setSelectedThreadId(id);
            fetchThreadDetail(id);
          }}
          onEmailSent={() => {
            showToast("Email dispatched successfully.");
            fetchData();
          }}
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
        onQueueSend={handleQueueSend}
        onSent={() => {
          showToast("Email queued for dispatch.");
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

      {/* Floating Undo Send Grace Window Banner */}
      {undoSendQueue && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-blue-500/50 text-slate-100 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-3 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center h-6 w-6">
              <span className="absolute text-[11px] font-bold text-blue-400">
                {undoSendQueue.secondsRemaining}
              </span>
              <svg className="h-6 w-6 -rotate-90">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="transparent"
                  className="text-slate-800"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="transparent"
                  strokeDasharray="63"
                  strokeDashoffset={63 - (63 * undoSendQueue.secondsRemaining) / 5}
                  className="text-blue-500 transition-all duration-1000 ease-linear"
                />
              </svg>
            </div>
            <div className="text-xs">
              Sending email to <strong className="text-blue-300">{undoSendQueue.payload.to}</strong>...
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelUndoSend}
              className="h-7 text-xs bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30 gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Undo (Z)
            </Button>
            <Button
              size="sm"
              onClick={handleImmediateSend}
              className="h-7 text-xs bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
            >
              Send Now
            </Button>
          </div>
        </div>
      )}

      {/* Superhuman Command Palette */}
      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        commands={commandPaletteItems}
      />

      {/* Superhuman Shortcuts Guide Dialog */}
      <ShortcutsDialog
        open={isShortcutsOpen}
        onOpenChange={setIsShortcutsOpen}
      />

      {/* Daily Executive Morning Briefing Dialog */}
      <MorningBriefingDialog
        open={isBriefingOpen}
        onOpenChange={setIsBriefingOpen}
        onSelectThread={(tId) => {
          setSelectedThreadId(tId);
          fetchThreadDetail(tId);
        }}
        onOpenComposerWithDraft={(draft, subj, to) => {
          handleInsertDraftToComposer(draft, subj, to);
        }}
      />

    </SidebarProvider>
  );
}
