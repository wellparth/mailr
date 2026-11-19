"use client";

import * as React from "react";
import {
  Inbox,
  Sparkles,
  Newspaper,
  Clock,
  Calendar,
  SunMedium,
  Keyboard,
  Star,
  Send,
  FileText,
  Trash2,
  Plus,
  Search,
  Server,
  LogOut,
  Settings,
  Mail,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Layers,
  Image as ImageIcon,
  Paperclip,
  Filter,
  RefreshCw,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ConnectedAccount {
  id: string;
  provider: string;
  emailAddress: string;
  displayName: string;
  colorCode: string;
  syncStatus: string;
  lastSyncedAt?: string;
}

export interface ThreadItem {
  id: string;
  accountId: string;
  subject: string;
  snippet?: string;
  priorityScore: number;
  priorityLevel: "URGENT" | "HIGH" | "NORMAL" | "LOW";
  priorityReason?: string;
  isStarred: boolean;
  isArchived: boolean;
  isNewsletter?: boolean;
  snoozedUntil?: string | null;
  lastMessageAt: string;
  account: {
    id: string;
    emailAddress: string;
    displayName: string;
    colorCode: string;
    provider: string;
  };
  messages: Array<{
    id: string;
    senderName?: string;
    senderEmail: string;
    subject: string;
    snippet?: string;
    isRead: boolean;
    receivedAt: string;
    hasAttachments?: boolean;
    calendarProposals?: Array<{ id: string; title: string }>;
  }>;
}

interface MailSidebarProps {
  user: { id: string; email: string; name: string } | null;
  accounts: ConnectedAccount[];
  threads: ThreadItem[];
  selectedThreadId: string | null;
  onSelectThread: (id: string) => void;
  activeNav: string;
  onNavChange: (nav: any) => void;
  onOpenBriefing?: () => void;
  onOpenShortcuts?: () => void;
  selectedAccountId: string;
  onAccountChange: (accountId: string) => void;
  unreadOnly: boolean;
  onUnreadOnlyChange: (val: boolean) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenCompose: () => void;
  onOpenConnectModal: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onTriagePromptSubmit: (prompt: string) => void;
  triageRunning: boolean;
  onSyncNow?: () => void;
  syncing?: boolean;
  totalThreads?: number;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onDeepSyncNow?: () => void;
  isRailCollapsed?: boolean;
  onToggleRail?: () => void;
  mailListWidth?: number;
  onMailListWidthChange?: (width: number) => void;
  isDragging?: boolean;
  setIsDragging?: (dragging: boolean) => void;
}

export function MailSidebar({
  user,
  accounts,
  threads,
  selectedThreadId,
  onSelectThread,
  activeNav,
  onNavChange,
  selectedAccountId,
  onAccountChange,
  unreadOnly,
  onUnreadOnlyChange,
  searchQuery,
  onSearchChange,
  onOpenCompose,
  onOpenConnectModal,
  onOpenSettings,
  onLogout,
  onTriagePromptSubmit,
  triageRunning,
  onSyncNow,
  syncing = false,
  totalThreads,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onDeepSyncNow,
  onOpenBriefing,
  onOpenShortcuts,
  isRailCollapsed = false,
  onToggleRail,
  mailListWidth = 340,
  onMailListWidthChange,
  isDragging = false,
  setIsDragging,
}: MailSidebarProps) {
  const [nlInput, setNlInput] = React.useState("");

  // Resize handler for Mail List Sidebar
  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startWidth = mailListWidth;

      setIsDragging?.(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        const delta = moveEvent.clientX - startX;
        const minWidth = 260;
        const maxWidth = Math.max(minWidth, Math.min(680, window.innerWidth - 420));
        const newWidth = Math.min(Math.max(startWidth + delta, minWidth), maxWidth);
        onMailListWidthChange?.(newWidth);
      };

      const handleMouseUp = () => {
        setIsDragging?.(false);
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
    [mailListWidth, onMailListWidthChange, setIsDragging]
  );

  const handleDoubleClick = React.useCallback(() => {
    onMailListWidthChange?.(340);
  }, [onMailListWidthChange]);

  // Calculate unread counts
  const unreadCount = React.useMemo(() => {
    return threads.filter((t) => t.messages[0] && !t.messages[0].isRead).length;
  }, [threads]);

  const priorityCount = React.useMemo(() => {
    return threads.filter(
      (t) =>
        (t.priorityLevel === "URGENT" || t.priorityLevel === "HIGH") &&
        t.messages[0] &&
        !t.messages[0].isRead
    ).length;
  }, [threads]);

  const newsletterCount = React.useMemo(() => {
    return threads.filter(
      (t) =>
        (t.isNewsletter || t.messages.some((m: any) => m.isNewsletter || m.unsubscribeUrl)) &&
        t.messages[0] &&
        !t.messages[0].isRead
    ).length;
  }, [threads]);

  const navItems = [
    { title: "Inbox", id: "inbox", icon: Inbox, badge: unreadCount },
    { title: "Priority AI", id: "priority", icon: Sparkles, badge: priorityCount, badgeColor: "text-emerald-400 bg-emerald-950/80 border-emerald-500/40" },
    { title: "Newsletters", id: "newsletters", icon: Newspaper, badge: newsletterCount, badgeColor: "text-purple-400 bg-purple-950/80 border-purple-500/40" },
    { title: "Snoozed", id: "snoozed", icon: Clock },
    { title: "Scheduled", id: "scheduled", icon: Calendar },
    { title: "Starred", id: "starred", icon: Star },
    { title: "Sent", id: "sent", icon: Send },
    { title: "Trash", id: "trash", icon: Trash2 },
  ];

  const handleTriageKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && nlInput.trim()) {
      onTriagePromptSubmit(nlInput.trim());
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  // Expanding primary rail state on hover
  const [isRailHovered, setIsRailHovered] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const isExpanded = isRailHovered || userMenuOpen;

  return (
    <Sidebar
      collapsible="icon"
      className={cn(
        "overflow-visible border-r border-border [&>[data-sidebar=sidebar]]:flex-row",
        isDragging && "transition-none [&_*]:transition-none"
      )}
    >
      {/* =========================================
          PRIMARY RAIL SIDEBAR (56px -> 220px on hover)
          - 56px compact icon rail by default
          - Smoothly grows to the right on hover to 220px (no bounce, instant ease-out)
          - Reveals full names, badges, inboxes, and profile
          ========================================= */}
      <div
        className={cn(
          "relative shrink-0",
          isRailCollapsed ? "w-0 overflow-hidden" : "w-[56px]"
        )}
      >
        <div
          onMouseEnter={() => setIsRailHovered(true)}
          onMouseLeave={() => setIsRailHovered(false)}
          className={cn(
            "absolute left-0 top-0 bottom-0 z-40 border-r border-border bg-card/95 backdrop-blur-md flex flex-col justify-between shrink-0 select-none overflow-hidden will-change-[width] transition-[width,box-shadow] duration-150 ease-out",
            isRailCollapsed
              ? "!w-0 opacity-0 pointer-events-none"
              : isExpanded
              ? "!w-[220px] shadow-2xl ring-1 ring-border/50"
              : "!w-[56px] shadow-none"
          )}
        >
          {/* Top: Brand Monogram + Title + Collapse Rail Button */}
          <div className="h-14 px-2 border-b border-border/40 flex items-center justify-between shrink-0 overflow-hidden">
            <div
              onClick={() => {
                onNavChange("inbox");
                onAccountChange("all");
              }}
              className="flex items-center gap-2.5 cursor-pointer group/brand min-w-0"
              title="Mailr Unified Home"
            >
              <div className="h-9 w-9 p-0 flex items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-md group-hover/brand:from-sky-500 group-hover/brand:to-indigo-500 shrink-0 transition-transform active:scale-95 ml-0.5">
                <Mail className="h-4.5 w-4.5" />
              </div>
              <div className={cn("flex flex-col min-w-0 whitespace-nowrap transition-opacity duration-150", isExpanded ? "opacity-100" : "opacity-0 pointer-events-none")}>
                <span className="font-bold text-sm text-foreground tracking-tight leading-none">Mailr</span>
                <span className="text-[10px] text-muted-foreground mt-0.5 leading-none">Client &amp; Agent</span>
              </div>
            </div>

            {onToggleRail && (
              <button
                type="button"
                onClick={onToggleRail}
                className={cn(
                  "h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors cursor-pointer shrink-0 ml-auto mr-1",
                  isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                title="Collapse sidebar ([ or Ctrl+B)"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Middle: Compose + Folders + Inboxes */}
          <div className="flex-1 py-2 overflow-y-auto overflow-x-hidden px-2 space-y-1.5">
            {/* 1. Primary Compose Action */}
            <button
              type="button"
              onClick={onOpenCompose}
              className="w-full h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm active:scale-95 cursor-pointer flex items-center px-2.5 gap-2.5 whitespace-nowrap overflow-hidden shrink-0"
              title="Compose Email (C)"
            >
              <Plus className="h-4 w-4 stroke-[2.5] shrink-0 ml-0.5" />
              <span className={cn("truncate flex-1 text-left text-xs font-medium transition-opacity duration-150", isExpanded ? "opacity-100" : "opacity-0 pointer-events-none")}>
                New Message
              </span>
              {isExpanded && (
                <kbd className="text-[10px] bg-primary-foreground/20 px-1.5 py-0.5 rounded font-mono shrink-0">C</kbd>
              )}
            </button>

            <div className="border-t border-border/40 mx-1 my-1 shrink-0" />

            {/* 2. Primary Navigation Folders */}
            <div className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = activeNav === item.id;
                const Icon = item.icon;
                return (
                  <div key={item.id} className="relative">
                    <button
                      type="button"
                      onClick={() => onNavChange(item.id as any)}
                      className={cn(
                        "w-full h-8 rounded-lg flex items-center px-2.5 gap-2.5 whitespace-nowrap overflow-hidden transition-colors cursor-pointer shrink-0 text-left",
                        isActive
                          ? "bg-secondary text-foreground font-medium shadow-sm border border-border"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                      )}
                      title={isExpanded ? undefined : `${item.title} ${item.badge ? `(${item.badge})` : ""}`}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 ml-0.5",
                          item.id === "priority" && isActive && "text-emerald-400"
                        )}
                      />
                      <span className={cn("truncate flex-1 text-xs font-medium transition-opacity duration-150", isExpanded ? "opacity-100" : "opacity-0 pointer-events-none")}>
                        {item.title}
                      </span>

                      {/* Unread badge indicator */}
                      {Boolean(item.badge && item.badge > 0) && (
                        isExpanded ? (
                          <span
                            className={cn(
                              "px-1.5 py-0.2 rounded-full text-[10px] font-bold border shrink-0 transition-opacity duration-150",
                              item.badgeColor || "bg-sky-500 text-white border-background"
                            )}
                          >
                            {item.badge}
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "absolute top-1 right-1.5 h-2.5 min-w-2.5 px-0.5 rounded-full text-[8px] font-bold flex items-center justify-center border pointer-events-none",
                              item.badgeColor || "bg-sky-500 text-white border-background"
                            )}
                          >
                            {item.badge}
                          </span>
                        )
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border/40 mx-1 my-1 shrink-0" />

            {/* 3. Connected Accounts Rail (Direct Account Switching) */}
            <div className="space-y-0.5">
              {/* Unified Inbox Switcher */}
              <button
                type="button"
                onClick={() => onAccountChange("all")}
                className={cn(
                  "w-full h-8 rounded-lg flex items-center px-2.5 gap-2.5 whitespace-nowrap overflow-hidden transition-colors cursor-pointer shrink-0 text-left",
                  selectedAccountId === "all"
                    ? "bg-sky-500/20 text-sky-400 ring-2 ring-sky-500 font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
                title={isExpanded ? undefined : "All Connected Accounts (Unified)"}
              >
                <Layers className="h-4 w-4 shrink-0 text-sky-400 ml-0.5" />
                <span className={cn("truncate flex-1 text-xs font-medium transition-opacity duration-150", isExpanded ? "opacity-100" : "opacity-0 pointer-events-none")}>
                  Unified Inbox
                </span>
                {isExpanded && (
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">{accounts.length}</span>
                )}
              </button>

              {/* Individual Inboxes */}
              {accounts.map((acc) => {
                const isAccActive = selectedAccountId === acc.id;
                const providerLetter =
                  acc.provider === "GMAIL"
                    ? "G"
                    : acc.provider === "OUTLOOK"
                    ? "O"
                    : "M";
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => onAccountChange(acc.id)}
                    className={cn(
                      "w-full h-8.5 rounded-lg flex items-center px-2 gap-2 whitespace-nowrap overflow-hidden transition-colors cursor-pointer shrink-0 text-left relative",
                      isAccActive
                        ? "bg-secondary text-foreground font-medium ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                    )}
                    title={isExpanded ? undefined : `${acc.displayName || acc.emailAddress} (${acc.provider})`}
                  >
                    <span
                      className="h-6 w-6 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 text-white shadow-xs"
                      style={{
                        backgroundColor: acc.colorCode || "#2563eb",
                      }}
                    >
                      {providerLetter}
                    </span>

                    <div className={cn("flex flex-col min-w-0 flex-1 truncate transition-opacity duration-150", isExpanded ? "opacity-100" : "opacity-0 pointer-events-none")}>
                      <span className="truncate text-xs font-medium text-foreground">
                        {acc.displayName || acc.emailAddress}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {acc.emailAddress}
                      </span>
                    </div>

                    {isAccActive && (
                      <span className={cn(
                        "bg-sky-400 rounded-full shrink-0",
                        isExpanded ? "h-1.5 w-1.5 ml-auto mr-0.5" : "absolute left-0.5 top-2 bottom-2 w-0.5 rounded-r bg-sky-400"
                      )} />
                    )}
                  </button>
                );
              })}

              {/* Quick Add Another Account */}
              <button
                type="button"
                onClick={onOpenConnectModal}
                className="w-full h-8 rounded-lg border border-dashed border-border/80 hover:border-sky-400 text-muted-foreground hover:text-sky-400 transition-colors flex items-center px-2.5 gap-2.5 whitespace-nowrap overflow-hidden cursor-pointer shrink-0 text-left"
                title="Add another email account"
              >
                <Plus className="h-3.5 w-3.5 shrink-0 ml-0.5" />
                <span className={cn("truncate text-xs font-medium transition-opacity duration-150", isExpanded ? "opacity-100" : "opacity-0 pointer-events-none")}>
                  Add Account
                </span>
              </button>
            </div>
          </div>

          {/* Bottom: Profile & Account Settings Menu */}
          <div className="h-14 p-2 border-t border-border/40 flex items-center shrink-0 overflow-hidden">
            <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="w-full h-10 rounded-xl hover:bg-secondary transition-colors flex items-center px-1 gap-2.5 cursor-pointer overflow-hidden text-left"
                  title={user?.name || "Account Menu"}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-8 w-8 rounded-lg border border-border">
                      <AvatarFallback className="rounded-lg text-xs font-semibold bg-secondary text-foreground">
                        {getInitials(user?.name || user?.email || "U")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                  </div>

                  <div className={cn("flex flex-col min-w-0 flex-1 truncate transition-opacity duration-150", isExpanded ? "opacity-100" : "opacity-0 pointer-events-none")}>
                    <span className="text-xs font-semibold text-foreground truncate">
                      {user?.name || "Mailr User"}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {user?.email || "self-hosted"}
                    </span>
                  </div>

                  {isExpanded && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto mr-1" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="end"
                className="w-56 bg-card border-border shadow-2xl rounded-xl p-1 text-sm z-50"
              >
                <DropdownMenuLabel className="font-normal px-2 py-1.5">
                  <div className="flex flex-col space-y-0.5">
                    <p className="text-sm font-medium leading-none text-foreground">
                      {user?.name || "Mailr User"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground truncate mt-1">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border/60 my-1" />
                <DropdownMenuItem
                  onClick={onOpenConnectModal}
                  className="cursor-pointer gap-2 py-2 px-2.5 rounded-lg hover:bg-secondary"
                >
                  <Server className="h-4 w-4 text-sky-400" />
                  <span>Connect New Email</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onOpenCompose}
                  className="cursor-pointer gap-2 py-2 px-2.5 rounded-lg hover:bg-secondary"
                >
                  <ImageIcon className="h-4 w-4 text-emerald-400" />
                  <span>New Email with Images</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onOpenSettings}
                  className="cursor-pointer gap-2 py-2 px-2.5 rounded-lg hover:bg-secondary"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span>Security &amp; Keys</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/60 my-1" />
                <DropdownMenuItem
                  onClick={onLogout}
                  className="cursor-pointer gap-2 py-2 px-2.5 rounded-lg text-rose-400 hover:bg-rose-500/10 focus:bg-rose-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* =========================================
          SECONDARY DRAWER SIDEBAR (320px)
          Designed for high-speed triage & navigation:
          - Inbox scope switcher
          - Unreads only filter
          - Realtime keyword search
          - Natural Language AI Triage Omnibar
          - Thread items with priority badges & attachments
          ========================================= */}
      <Sidebar
        collapsible="none"
        style={{ width: `${mailListWidth}px`, minWidth: `${mailListWidth}px`, maxWidth: `${mailListWidth}px` }}
        className={cn(
          "hidden md:flex border-r border-border bg-background flex-col relative shrink-0 h-full",
          isDragging ? "select-none transition-none" : "transition-[width] duration-200 ease-in-out"
        )}
      >
        {/* Drawer Header */}
        <SidebarHeader className="gap-2.5 border-b border-border p-3.5 bg-card/20 shrink-0">
          <div className="flex w-full items-center justify-between gap-1.5">
            {/* Left cluster: Sidebar toggle button + Quick New (if collapsed) + Account Switcher */}
            <div className="flex items-center gap-1.5 min-w-0">
              {onToggleRail && (
                <button
                  type="button"
                  onClick={onToggleRail}
                  className={cn(
                    "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer",
                    isRailCollapsed
                      ? "bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 border border-sky-500/30 shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                  title={isRailCollapsed ? "Expand left sidebar ([ or Ctrl+B)" : "Collapse left sidebar ([ or Ctrl+B)"}
                >
                  {isRailCollapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeft className="h-3.5 w-3.5" />
                  )}
                </button>
              )}

              {/* Quick Compose when rail is collapsed */}
              {isRailCollapsed && (
                <button
                  type="button"
                  onClick={onOpenCompose}
                  className="h-7 px-2 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1 font-medium shadow-sm transition-transform active:scale-95 cursor-pointer shrink-0"
                  title="Compose Email (C)"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">New</span>
                </button>
              )}

              {/* Account Switcher Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 text-xs font-medium text-foreground bg-secondary/60 hover:bg-secondary px-2 py-1.5 rounded-md border border-border/50 max-w-[170px] truncate transition-colors outline-none cursor-pointer">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: selectedAccount?.colorCode || "#38bdf8",
                    }}
                  />
                  <span className="truncate">
                    {selectedAccount ? selectedAccount.emailAddress : "All Accounts"}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 ml-auto" />
                </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-64 bg-card border-border shadow-xl rounded-xl p-1"
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold px-2 py-1">
                  Active Inboxes
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => onAccountChange("all")}
                  className={`gap-2 text-xs py-2 px-2.5 rounded-lg cursor-pointer ${
                    selectedAccountId === "all" ? "bg-secondary font-medium" : ""
                  }`}
                >
                  <Layers className="h-3.5 w-3.5 text-sky-400" />
                  <div className="flex flex-col">
                    <span>Unified Inbox</span>
                    <span className="text-[10px] text-muted-foreground">
                      All connected accounts ({accounts.length})
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/60 my-1" />
                {accounts.map((acc) => (
                  <DropdownMenuItem
                    key={acc.id}
                    onClick={() => onAccountChange(acc.id)}
                    className={`gap-2 text-xs py-2 px-2.5 rounded-lg cursor-pointer ${
                      selectedAccountId === acc.id ? "bg-secondary font-medium" : ""
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: acc.colorCode }}
                    />
                    <div className="flex flex-col truncate">
                      <span className="truncate font-medium">{acc.displayName || acc.emailAddress}</span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {acc.emailAddress} ({acc.provider})
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-border/60 my-1" />
                <DropdownMenuItem
                  onClick={onOpenConnectModal}
                  className="gap-2 text-xs py-2 px-2.5 rounded-lg cursor-pointer text-sky-400 hover:bg-sky-500/10 font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Connect another account</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>

            {/* Actions: Sync Button & Unreads Switch */}
            <div className="flex items-center gap-1.5">
              {onSyncNow && (
                <button
                  type="button"
                  onClick={onSyncNow}
                  disabled={syncing}
                  title="Sync inbox now"
                  className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin text-sky-400" : ""}`} />
                </button>
              )}
              <div className="h-3 w-px bg-border/60 mx-0.5" />
              <Label htmlFor="unreads-filter" className="text-xs text-muted-foreground cursor-pointer">
                Unreads
              </Label>
              <Switch
                id="unreads-filter"
                checked={unreadOnly}
                onCheckedChange={onUnreadOnlyChange}
                className="scale-75 data-[state=checked]:bg-sky-500"
              />
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <SidebarInput
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search sender, subject, words..."
              className="pl-8 h-8 text-xs bg-secondary/30 border-border/50 focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* AI Natural Language Triage Omnibar */}
          <div className="relative w-full space-y-1.5">
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-950/40 to-sky-950/40 border border-emerald-500/30 rounded-lg px-2.5 py-1.5">
              <Sparkles className={`h-3.5 w-3.5 text-emerald-400 shrink-0 ${triageRunning ? 'animate-spin' : ''}`} />
              <input
                type="text"
                value={nlInput}
                onChange={(e) => setNlInput(e.target.value)}
                onKeyDown={handleTriageKeyDown}
                placeholder="AI Triage (e.g. urgent meetings)..."
                disabled={triageRunning}
                className="bg-transparent border-none text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none w-full"
              />
              <span className="text-[10px] text-muted-foreground/60 border border-border/60 rounded px-1 shrink-0">
                ↵
              </span>
            </div>
          </div>
        </SidebarHeader>

        {/* Email count and deep sync status header */}
        <div className="px-3 py-1.5 bg-muted/20 border-b border-border/40 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
          <span>
            {threads.length > 0 ? (
              <>Showing <strong className="text-foreground">{threads.length}</strong> of {totalThreads || threads.length} emails</>
            ) : (
              "0 emails"
            )}
          </span>
          {onDeepSyncNow && accounts.length > 0 && (
            <button
              type="button"
              onClick={onDeepSyncNow}
              disabled={syncing}
              className="text-[10px] text-sky-400 hover:text-sky-300 font-medium hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="Sync all past emails from your connected accounts"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${syncing ? "animate-spin" : ""}`} />
              <span>Full Sync</span>
            </button>
          )}
        </div>

        {/* Email Thread List */}
        <SidebarContent className="p-0 overflow-y-auto">
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              {threads.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <Mail className="h-8 w-8 text-muted-foreground/40 mb-2 stroke-[1.5]" />
                  <p className="text-xs font-medium text-foreground">
                    {accounts.length === 0
                      ? "No Inboxes Connected"
                      : unreadOnly
                      ? "Zero Unread Emails"
                      : "No Emails Found"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px] leading-relaxed">
                    {accounts.length === 0
                      ? "Connect Google, Outlook, or IMAP/SMTP accounts to begin syncing."
                      : unreadOnly
                      ? "You've read everything in this view."
                      : "No messages match your current filters."}
                  </p>
                  {accounts.length === 0 && (
                    <button
                      onClick={onOpenConnectModal}
                      className="mt-3 px-3 py-1.5 text-xs bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg transition-colors font-medium flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Connect Inboxes</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {threads.map((thread) => {
                    const isSelected = selectedThreadId === thread.id;
                    const latestMessage = thread.messages[0];
                    const isUnread = latestMessage ? !latestMessage.isRead : false;
                    const hasCalendar = latestMessage?.calendarProposals && latestMessage.calendarProposals.length > 0;
                    const hasAttachment = latestMessage?.hasAttachments;

                    return (
                      <button
                        key={thread.id}
                        onClick={() => onSelectThread(thread.id)}
                        className={`w-full text-left p-3 flex flex-col gap-1.5 transition-colors group relative cursor-pointer ${
                          isSelected
                            ? "bg-secondary text-foreground"
                            : "hover:bg-secondary/40 text-muted-foreground"
                        }`}
                      >
                        {/* Active vertical bar indicator */}
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-sky-500" />
                        )}

                        {/* Top row: Sender, account dot, date */}
                        <div className="flex items-center justify-between w-full gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isUnread && (
                              <span className="h-2 w-2 rounded-full bg-sky-400 shrink-0" />
                            )}
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: thread.account?.colorCode || "#94a3b8" }}
                              title={thread.account?.emailAddress}
                            />
                            <span
                              className={`text-xs truncate ${
                                isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80"
                              }`}
                            >
                              {latestMessage?.senderName || latestMessage?.senderEmail || "Unknown Sender"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {selectedAccountId === "all" && thread.account && (
                              <span
                                className="text-[9px] px-1.5 py-0.2 rounded-full border font-medium truncate max-w-[80px]"
                                style={{
                                  borderColor: `${thread.account.colorCode || '#38bdf8'}40`,
                                  backgroundColor: `${thread.account.colorCode || '#38bdf8'}15`,
                                  color: thread.account.colorCode || '#38bdf8',
                                }}
                                title={`Received on ${thread.account.emailAddress}`}
                              >
                                {thread.account.displayName || thread.account.emailAddress.split("@")[0]}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {formatShortDate(thread.lastMessageAt)}
                            </span>
                          </div>
                        </div>

                        {/* Subject + Badges */}
                        <div className="flex items-center gap-1.5 w-full">
                          <span
                            className={`text-xs truncate flex-1 ${
                              isUnread ? "font-semibold text-foreground" : "text-foreground/90"
                            }`}
                          >
                            {thread.subject || "(No Subject)"}
                          </span>

                          {/* Multi-message count pill */}
                          {thread.messages.length > 1 && (
                            <span className="text-[9px] font-semibold text-muted-foreground/80 bg-secondary px-1 py-0 rounded border border-border/40">
                              {thread.messages.length}
                            </span>
                          )}

                          {/* Priority Badge */}
                          {thread.priorityLevel === "URGENT" && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 uppercase">
                              Urgent
                            </Badge>
                          )}
                          {thread.priorityLevel === "HIGH" && (
                            <Badge className="bg-emerald-950 text-emerald-300 border-emerald-500/30 text-[9px] px-1 py-0 h-4">
                              Priority
                            </Badge>
                          )}

                          {/* Image / Attachment Indicator */}
                          {hasAttachment && (
                            <span title="Contains attachments or images">
                              <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                            </span>
                          )}

                          {/* Calendar Proposal Icon */}
                          {hasCalendar && (
                            <span title="Calendar Meeting Detected">
                              <Calendar className="h-3 w-3 text-sky-400 shrink-0" />
                            </span>
                          )}
                        </div>

                        {/* Snippet / Preview */}
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {thread.snippet || latestMessage?.snippet || "No preview available"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Load More Button */}
              {hasMore && (
                <div className="p-3 border-t border-border/40">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onLoadMore}
                    disabled={isLoadingMore}
                    className="w-full text-xs h-8 border-dashed border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/60 cursor-pointer"
                  >
                    {isLoadingMore
                      ? "Loading more emails..."
                      : `Load More Emails (${threads.length} of ${totalThreads || threads.length})`}
                  </Button>
                </div>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Draggable Vertical Resize Handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize mail list sidebar"
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          className={cn(
            "absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-30 group flex items-center justify-center select-none",
            isDragging && "cursor-col-resize pointer-events-auto"
          )}
          title="Drag to resize mail list, double-click to reset (340px)"
        >
          {/* Vertical line indicator */}
          <div
            className={cn(
              "w-0.5 h-full transition-colors",
              isDragging
                ? "bg-sky-500 w-1 shadow-[0_0_10px_rgba(56,189,248,0.7)]"
                : "bg-transparent group-hover:bg-sky-500/60 group-hover:w-0.5"
            )}
          />

          {/* Grip pill visible on hover or active dragging */}
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-4 h-8 rounded-full bg-card border border-border/80 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none",
              isDragging && "opacity-100 bg-sky-600 border-sky-400 text-white"
            )}
          >
            <GripVertical className={cn("h-3 w-3", isDragging ? "text-white" : "text-muted-foreground")} />
          </div>
        </div>
      </Sidebar>
    </Sidebar>
  );
}

function formatShortDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
