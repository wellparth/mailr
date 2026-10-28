"use client";

import * as React from "react";
import {
  Inbox,
  Sparkles,
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
  CheckCircle2,
  Calendar,
  Layers,
  Image as ImageIcon,
  Paperclip,
  Clock,
  Filter,
} from "lucide-react";

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
  onNavChange: (nav: "inbox" | "priority" | "starred" | "drafts" | "sent" | "trash") => void;
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
}: MailSidebarProps) {
  const [nlInput, setNlInput] = React.useState("");

  // Quick Triage Suggestions
  const triageChips = [
    { label: "⚡ Urgent Actions", prompt: "Surface urgent client action items and pending deadlines" },
    { label: "📅 Meeting Invites", prompt: "Find calendar invites and scheduling proposals" },
    { label: "💼 Financial & Invoices", prompt: "Show receipts, statements and billing updates" },
  ];

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

  const navItems = [
    { title: "Inbox", id: "inbox", icon: Inbox, badge: unreadCount },
    { title: "Priority AI", id: "priority", icon: Sparkles, badge: priorityCount, badgeColor: "text-emerald-400 bg-emerald-950/80 border-emerald-500/40" },
    { title: "Starred", id: "starred", icon: Star },
    { title: "Sent", id: "sent", icon: Send },
    { title: "Drafts", id: "drafts", icon: FileText },
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

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden border-r border-border [&>[data-sidebar=sidebar]]:flex-row"
    >
      {/* =========================================
          PRIMARY RAIL SIDEBAR (56px)
          Designed with strong purposeful workflows:
          - Brand Home
          - Compose Action
          - Connected Inboxes Rail (Direct 1-click switch & Add)
          - Core Folders
          - Profile & Account Status
          ========================================= */}
      <Sidebar
        collapsible="none"
        className="!w-[calc(var(--sidebar-width-icon)_+_1px)] border-r border-border bg-card/60 flex flex-col justify-between shrink-0"
      >
        {/* Top: Brand Monogram */}
        <SidebarHeader className="p-2 border-b border-border/40">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                onClick={() => {
                  onNavChange("inbox");
                  onAccountChange("all");
                }}
                className="h-10 w-10 p-0 flex items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-md hover:from-sky-500 hover:to-indigo-500 mx-auto cursor-pointer"
                tooltip="Mailr Unified Home"
              >
                <Mail className="h-5 w-5" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* Middle: Compose + Folders + Connected Inboxes Icons */}
        <SidebarContent className="py-2 overflow-y-auto">
          <SidebarGroup className="p-1">
            <SidebarGroupContent>
              <SidebarMenu className="gap-2">
                {/* 1. Primary Compose Action */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={onOpenCompose}
                    className="h-10 w-10 p-0 flex items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 mx-auto shadow-sm transition-transform active:scale-95"
                    tooltip="Compose Email (Attach images & docs)"
                  >
                    <Plus className="h-4 w-4 stroke-[2.5]" />
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <div className="my-1.5 border-t border-border/40 w-6 mx-auto" />

                {/* 2. Primary Navigation Folders */}
                {navItems.map((item) => {
                  const isActive = activeNav === item.id;
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.id} className="relative">
                      <SidebarMenuButton
                        onClick={() => onNavChange(item.id as any)}
                        isActive={isActive}
                        className={`h-9 w-9 p-0 flex items-center justify-center rounded-lg mx-auto transition-all ${
                          isActive
                            ? "bg-secondary text-foreground font-medium shadow-sm border border-border"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                        }`}
                        tooltip={`${item.title} ${item.badge ? `(${item.badge})` : ""}`}
                      >
                        <Icon
                          className={`h-4 w-4 ${
                            item.id === "priority" && isActive
                              ? "text-emerald-400"
                              : ""
                          }`}
                        />
                      </SidebarMenuButton>

                      {/* Unread badge indicator */}
                      {Boolean(item.badge && item.badge > 0) && (
                        <span
                          className={`absolute top-0 right-1 h-3 min-w-3 px-1 rounded-full text-[9px] font-bold flex items-center justify-center border pointer-events-none ${
                            item.badgeColor || "bg-sky-500 text-white border-background"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </SidebarMenuItem>
                  );
                })}

                <div className="my-1.5 border-t border-border/40 w-6 mx-auto" />

                {/* 3. Connected Accounts Rail Icons (Direct Account Switching) */}
                <div className="flex flex-col items-center gap-1.5 pt-1">
                  {/* Unified Inbox Switcher Icon */}
                  <button
                    onClick={() => onAccountChange("all")}
                    className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
                      selectedAccountId === "all"
                        ? "bg-sky-500/20 text-sky-400 ring-2 ring-sky-500"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                    title="All Connected Accounts (Unified)"
                  >
                    <Layers className="h-4 w-4" />
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
                        onClick={() => onAccountChange(acc.id)}
                        className={`relative h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs transition-all ${
                          isAccActive
                            ? "ring-2 ring-white scale-105"
                            : "opacity-75 hover:opacity-100 hover:scale-105"
                        }`}
                        style={{
                          backgroundColor: acc.colorCode || "#2563eb",
                          color: "#ffffff",
                        }}
                        title={`${acc.displayName || acc.emailAddress} (${acc.provider})`}
                      >
                        {providerLetter}
                        {isAccActive && (
                          <span className="absolute -left-1 top-2 bottom-2 w-0.5 bg-white rounded-r" />
                        )}
                      </button>
                    );
                  })}

                  {/* Quick Add Another Account Rail Button */}
                  <button
                    onClick={onOpenConnectModal}
                    className="h-8 w-8 rounded-lg border border-dashed border-border/80 hover:border-sky-400 text-muted-foreground hover:text-sky-400 flex items-center justify-center transition-colors"
                    title="Add another email account"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Bottom: Profile & Account Settings Menu */}
        <SidebarFooter className="p-2 border-t border-border/40">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="h-10 w-10 p-0 flex items-center justify-center rounded-xl hover:bg-secondary mx-auto relative cursor-pointer"
                    tooltip={user?.name || "Account Menu"}
                  >
                    <Avatar className="h-8 w-8 rounded-lg border border-border">
                      <AvatarFallback className="text-xs font-semibold bg-secondary text-foreground">
                        {getInitials(user?.name || user?.email || "U")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-emerald-500 border border-background" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="right"
                  align="end"
                  className="w-56 bg-card border-border shadow-2xl rounded-xl p-1 text-sm"
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
                    <span>Security & Keys</span>
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
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

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
        className="hidden flex-1 md:flex w-80 max-w-xs border-r border-border bg-background flex-col"
      >
        {/* Drawer Header */}
        <SidebarHeader className="gap-2.5 border-b border-border p-3.5 bg-card/20">
          <div className="flex w-full items-center justify-between">
            {/* Account Switcher Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 text-xs font-medium text-foreground bg-secondary/60 hover:bg-secondary px-2.5 py-1.5 rounded-md border border-border/50 max-w-[190px] truncate transition-colors outline-none cursor-pointer">
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

            {/* Unreads Switch */}
            <div className="flex items-center gap-1.5">
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

            {/* Quick Triage Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
              {triageChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => onTriagePromptSubmit(chip.prompt)}
                  disabled={triageRunning}
                  className="text-[10px] whitespace-nowrap px-2 py-0.5 rounded-full bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/50 transition-colors shrink-0"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </SidebarHeader>

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
                          <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                            {formatShortDate(thread.lastMessageAt)}
                          </span>
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
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
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
