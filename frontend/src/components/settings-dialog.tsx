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
  Lock,
  Server,
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Cpu,
  Bot,
  Link as LinkIcon,
  RefreshCw,
  Database,
  Bell,
  Send,
  MessageSquare,
  Newspaper,
  Inbox,
  Zap,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountsCount: number;
}

export interface AIModelItem {
  id: string;
  name: string;
  provider: string;
  description?: string;
  isRecommended?: boolean;
}

export function SettingsDialog({
  open,
  onOpenChange,
  accountsCount,
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = React.useState<"ai" | "inbox" | "alerts" | "calendar" | "security">("ai");

  // Inbox & Newsletter Bundling State
  const [bundleNewsletters, setBundleNewsletters] = React.useState(false);
  const [newsletterDeliveryTime, setNewsletterDeliveryTime] = React.useState("08:00");
  const [savingNewsletters, setSavingNewsletters] = React.useState(false);

  // Real-Time IMAP IDLE Push State
  const [idleStatus, setIdleStatus] = React.useState<any>(null);

  // Urgent Inbound Alerts State
  const [alertsEnabled, setAlertsEnabled] = React.useState(false);
  const [alertThreshold, setAlertThreshold] = React.useState<"URGENT" | "HIGH">("URGENT");
  const [telegramBotToken, setTelegramBotToken] = React.useState("");
  const [telegramChatId, setTelegramChatId] = React.useState("");
  const [hasTelegramToken, setHasTelegramToken] = React.useState(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = React.useState("");
  const [hasDiscordWebhook, setHasDiscordWebhook] = React.useState(false);
  const [discordMasked, setDiscordMasked] = React.useState<string | null>(null);

  const [slackWebhookUrl, setSlackWebhookUrl] = React.useState("");
  const [hasSlackWebhook, setHasSlackWebhook] = React.useState(false);
  const [slackMasked, setSlackMasked] = React.useState<string | null>(null);
  const [testingSlack, setTestingSlack] = React.useState(false);
  const [slackTestResult, setSlackTestResult] = React.useState<{ success: boolean; message: string } | null>(null);

  const [customWebhookUrl, setCustomWebhookUrl] = React.useState("");
  const [hasCustomWebhook, setHasCustomWebhook] = React.useState(false);
  const [customMasked, setCustomMasked] = React.useState<string | null>(null);
  const [testingCustom, setTestingCustom] = React.useState(false);
  const [customTestResult, setCustomTestResult] = React.useState<{ success: boolean; message: string } | null>(null);

  const [savingAlerts, setSavingAlerts] = React.useState(false);
  const [testingTelegram, setTestingTelegram] = React.useState(false);
  const [testingDiscord, setTestingDiscord] = React.useState(false);
  const [telegramTestResult, setTelegramTestResult] = React.useState<{ success: boolean; message: string } | null>(null);
  const [discordTestResult, setDiscordTestResult] = React.useState<{ success: boolean; message: string } | null>(null);

  // AI & BYOK State
  const [aiProvider, setAiProvider] = React.useState<"openai" | "claude" | "google" | "nvidia">("nvidia");
  const [aiModel, setAiModel] = React.useState<string>("");
  const [availableModels, setAvailableModels] = React.useState<AIModelItem[]>([]);
  const [loadingModels, setLoadingModels] = React.useState(false);
  const [isCustomModel, setIsCustomModel] = React.useState(false);
  const [customModelInput, setCustomModelInput] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [hasCustomKey, setHasCustomKey] = React.useState(false);
  const [testingKey, setTestingKey] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(null);
  const [savingAI, setSavingAI] = React.useState(false);

  // Calendar State
  const [calComUrl, setCalComUrl] = React.useState("");
  const [calendlyUrl, setCalendlyUrl] = React.useState("");
  const [savingCal, setSavingCal] = React.useState(false);

  // Status banner
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);
  const [redisStatus, setRedisStatus] = React.useState<{ connected: boolean; mode: string; redisUrl: string; memoryKeysCount: number } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Dynamically fetch active model list for provider
  const loadModels = React.useCallback(async (provider: string, customApiKey?: string) => {
    try {
      setLoadingModels(true);
      let res: any;
      if (customApiKey && customApiKey.trim().length > 0) {
        res = await apiFetch("/api/agent/models", {
          method: "POST",
          body: JSON.stringify({ provider, apiKey: customApiKey.trim() }),
        });
      } else {
        res = await apiFetch(`/api/agent/models?provider=${provider}`);
      }
      if (res && res.models && res.models.length > 0) {
        setAvailableModels(res.models);
      }
    } catch (err) {
      console.warn("Failed to load models list", err);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  // Load existing configuration on open
  React.useEffect(() => {
    if (open) {
      // 1. Load BYOK
      apiFetch("/api/agent/byok")
        .then((res) => {
          if (res) {
            const prov = res.provider || "nvidia";
            setAiProvider(prov);
            if (res.model) {
              setAiModel(res.model);
            }
            setHasCustomKey(Boolean(res.hasCustomKey));
            loadModels(prov);
          }
        })
        .catch(() => {});

      // 2. Load Calendar
      apiFetch("/api/agent/calendar/integrations")
        .then((res) => {
          if (res && res.integrations) {
            const cal = res.integrations.find((i: any) => i.provider === "CAL_COM");
            const cly = res.integrations.find((i: any) => i.provider === "CALENDLY");
            if (cal?.bookingUrl) setCalComUrl(cal.bookingUrl);
            if (cly?.bookingUrl) setCalendlyUrl(cly.bookingUrl);
          }
        })
        .catch(() => {});

      // 3. Load Redis Status
      apiFetch("/api/agent/redis/status")
        .then((res) => {
          if (res) setRedisStatus(res);
        })
        .catch(() => {});

      // 4. Load Urgent Alert Settings
      apiFetch("/api/alerts/config")
        .then((res: any) => {
          if (res) {
            setAlertsEnabled(Boolean(res.alertsEnabled));
            setAlertThreshold(res.alertThreshold || "URGENT");
            setTelegramChatId(res.telegramChatId || "");
            setHasTelegramToken(Boolean(res.hasTelegramToken));
            setHasDiscordWebhook(Boolean(res.hasDiscordWebhook));
            setDiscordMasked(res.discordWebhookUrlMasked || null);
            setHasSlackWebhook(Boolean(res.hasSlackWebhook));
            setSlackMasked(res.slackWebhookUrlMasked || null);
            setHasCustomWebhook(Boolean(res.hasCustomWebhook));
            setCustomMasked(res.customWebhookUrlMasked || null);
          }
        })
        .catch(() => {});

      // 5. Load Newsletter Bundling Settings
      apiFetch("/api/agent/newsletters/settings")
        .then((res: any) => {
          if (res) {
            setBundleNewsletters(Boolean(res.bundleNewsletters));
            setNewsletterDeliveryTime(res.newsletterDeliveryTime || "08:00");
          }
        })
        .catch(() => {});

      // 6. Load IMAP IDLE Push Listener Diagnostics
      apiFetch("/api/accounts/idle/status")
        .then((res: any) => {
          if (res) setIdleStatus(res);
        })
        .catch(() => {});

      setTestResult(null);
    }
  }, [open, loadModels]);

  const handleSelectProvider = (prov: "openai" | "claude" | "google" | "nvidia") => {
    setAiProvider(prov);
    setTestResult(null);
    setIsCustomModel(false);
    loadModels(prov, apiKey);
  };

  // Test API Key
  const handleTestApiKey = async () => {
    if (!apiKey.trim() && !hasCustomKey) {
      setTestResult({ success: false, message: "Please enter an API key to test." });
      return;
    }

    try {
      setTestingKey(true);
      setTestResult(null);
      const res = await apiFetch("/api/agent/byok/test", {
        method: "POST",
        body: JSON.stringify({
          provider: aiProvider,
          apiKey: apiKey.trim(),
          model: (isCustomModel ? customModelInput : aiModel) || undefined,
        }),
      });

      if (res && res.success) {
        setTestResult({ success: true, message: res.message || "Connection verified!" });
      } else {
        setTestResult({ success: false, message: res?.message || "Failed to verify key with provider." });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "API test request failed" });
    } finally {
      setTestingKey(false);
    }
  };

  // Save BYOK credentials & model selection
  const handleSaveAIConfig = async () => {
    try {
      setSavingAI(true);
      const chosenModel = isCustomModel ? customModelInput.trim() : aiModel.trim();
      const res = await apiFetch("/api/agent/byok", {
        method: "POST",
        body: JSON.stringify({
          provider: aiProvider,
          apiKey: apiKey.trim() ? apiKey.trim() : undefined,
          model: chosenModel || undefined,
        }),
      });

      if (res && res.success) {
        setHasCustomKey(Boolean(res.hasCustomKey));
        setApiKey("");
        showToast(`AI settings saved. Provider: ${aiProvider.toUpperCase()}${chosenModel ? ` • ${chosenModel}` : ""}`);
      }
    } catch (err: any) {
      alert("Failed to save AI settings: " + err.message);
    } finally {
      setSavingAI(false);
    }
  };

  // Save Calendar links
  const handleSaveCalendar = async () => {
    try {
      setSavingCal(true);
      await Promise.all([
        apiFetch("/api/agent/calendar/integrations", {
          method: "POST",
          body: JSON.stringify({ provider: "CAL_COM", bookingUrl: calComUrl }),
        }),
        apiFetch("/api/agent/calendar/integrations", {
          method: "POST",
          body: JSON.stringify({ provider: "CALENDLY", bookingUrl: calendlyUrl }),
        }),
      ]);
      showToast("Calendar booking links saved successfully.");
    } catch (err: any) {
      alert("Failed to save calendar settings: " + err.message);
    } finally {
      setSavingCal(false);
    }
  };

  const handleSaveAlerts = async () => {
    try {
      setSavingAlerts(true);
      const res: any = await apiFetch("/api/alerts/config", {
        method: "POST",
        body: JSON.stringify({
          alertsEnabled,
          alertThreshold,
          telegramBotToken: telegramBotToken || undefined,
          telegramChatId,
          discordWebhookUrl: discordWebhookUrl || undefined,
          slackWebhookUrl: slackWebhookUrl || undefined,
          customWebhookUrl: customWebhookUrl || undefined,
        }),
      });

      if (res && res.success) {
        setHasTelegramToken(Boolean(res.hasTelegramToken));
        setHasDiscordWebhook(Boolean(res.hasDiscordWebhook));
        setHasSlackWebhook(Boolean(res.hasSlackWebhook));
        setHasCustomWebhook(Boolean(res.hasCustomWebhook));
        if (telegramBotToken) setTelegramBotToken("");
        if (discordWebhookUrl) setDiscordWebhookUrl("");
        if (slackWebhookUrl) setSlackWebhookUrl("");
        if (customWebhookUrl) setCustomWebhookUrl("");
        showToast("Urgent alert preferences saved successfully!");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to save alert settings");
    } finally {
      setSavingAlerts(false);
    }
  };

  const handleTestSlack = async () => {
    try {
      setTestingSlack(true);
      setSlackTestResult(null);
      const res = await apiFetch<{ success: boolean; message: string }>("/api/alerts/test", {
        method: "POST",
        body: JSON.stringify({
          channel: "slack",
          slackWebhookUrl: slackWebhookUrl || undefined,
        }),
      });
      setSlackTestResult(res);
    } catch (err: any) {
      setSlackTestResult({ success: false, message: err.message || "Test failed" });
    } finally {
      setTestingSlack(false);
    }
  };

  const handleTestCustom = async () => {
    try {
      setTestingCustom(true);
      setCustomTestResult(null);
      const res = await apiFetch<{ success: boolean; message: string }>("/api/alerts/test", {
        method: "POST",
        body: JSON.stringify({
          channel: "custom",
          customWebhookUrl: customWebhookUrl || undefined,
        }),
      });
      setCustomTestResult(res);
    } catch (err: any) {
      setCustomTestResult({ success: false, message: err.message || "Test failed" });
    } finally {
      setTestingCustom(false);
    }
  };

  const handleSaveNewsletters = async () => {
    try {
      setSavingNewsletters(true);
      await apiFetch("/api/agent/newsletters/settings", {
        method: "POST",
        body: JSON.stringify({
          bundleNewsletters,
          newsletterDeliveryTime,
        }),
      });
      showToast("Inbox & newsletter bundling settings saved!");
    } catch (err: any) {
      showToast(err.message || "Failed to save newsletter settings");
    } finally {
      setSavingNewsletters(false);
    }
  };

  const handleTestTelegram = async () => {
    try {
      setTestingTelegram(true);
      setTelegramTestResult(null);
      const res = await apiFetch<{ success: boolean; message: string }>("/api/alerts/test", {
        method: "POST",
        body: JSON.stringify({
          channel: "telegram",
          telegramBotToken: telegramBotToken || undefined,
          telegramChatId: telegramChatId || undefined,
        }),
      });
      setTelegramTestResult(res);
    } catch (err: any) {
      setTelegramTestResult({ success: false, message: err.message || "Test failed" });
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleTestDiscord = async () => {
    try {
      setTestingDiscord(true);
      setDiscordTestResult(null);
      const res = await apiFetch<{ success: boolean; message: string }>("/api/alerts/test", {
        method: "POST",
        body: JSON.stringify({
          channel: "discord",
          discordWebhookUrl: discordWebhookUrl || undefined,
        }),
      });
      setDiscordTestResult(res);
    } catch (err: any) {
      setDiscordTestResult({ success: false, message: err.message || "Test failed" });
    } finally {
      setTestingDiscord(false);
    }
  };

  const providers = [
    {
      id: "nvidia",
      name: "NVIDIA NIM",
      desc: "Nemotron 3.5 Bolt (Free Cloud LLM)",
      placeholder: "nvapi-...",
      badge: "Default & Free",
    },
    {
      id: "openai",
      name: "OpenAI",
      desc: "GPT-4o & GPT-4o-mini models",
      placeholder: "sk-proj-...",
      badge: "Industry Standard",
    },
    {
      id: "claude",
      name: "Anthropic Claude",
      desc: "High-reasoning Claude 3.5 Sonnet & Haiku",
      placeholder: "sk-ant-api03-...",
      badge: "Elite Writing",
    },
    {
      id: "google",
      name: "Google Gemini",
      desc: "Fast & multimodal (Gemini 1.5 Flash / Pro)",
      placeholder: "AIzaSy...",
      badge: "Multimodal",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card border-border text-foreground shadow-2xl rounded-2xl p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-border bg-card/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-secondary text-foreground border border-border/60">
                <Sparkles className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">Settings & Preferences</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Configure your AI Copilot, calendar scheduling links, and encryption.
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 pt-3 border-t border-border/40 mt-3 text-xs">
            <button
              onClick={() => setActiveTab("ai")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === "ai"
                  ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              <span>AI Model & BYOK</span>
              {hasCustomKey && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("inbox")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === "inbox"
                  ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              <Newspaper className="h-3.5 w-3.5" />
              <span>Inbox & Newsletters</span>
              {bundleNewsletters && (
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("alerts")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === "alerts"
                  ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
              <span>Urgent Alerts</span>
              {alertsEnabled && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === "calendar"
                  ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Calendar & Scheduling</span>
              {(calComUrl || calendlyUrl) && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("security")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === "security"
                  ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Security & Keys</span>
            </button>
          </div>
        </DialogHeader>

        {/* Toast alert */}
        {toastMessage && (
          <div className="bg-emerald-950/80 border-b border-emerald-500/30 text-emerald-300 text-xs px-4 py-2 flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 max-h-[65vh] overflow-y-auto space-y-4 text-xs">
          {/* TAB 1: AI MODEL & BYOK */}
          {activeTab === "ai" && (
            <div className="space-y-4">
              <div className="bg-secondary/30 p-3 rounded-xl border border-border/60 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                    Bring Your Own Key (BYOK)
                  </span>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    AES-256-GCM Encrypted
                  </Badge>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Your keys are encrypted at rest with AES-256-GCM. When configured, Mailr Copilot will route draft generation, thread notes, and scheduling via your provider.
                </p>
              </div>

              {/* Provider Selection Grid */}
              <div className="space-y-2">
                <Label className="text-xs text-foreground font-medium">Select AI Provider:</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {providers.map((p) => {
                    const isSelected = aiProvider === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          handleSelectProvider(p.id as any);
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-sky-500/10 border-sky-500/60 ring-1 ring-sky-500/30"
                            : "bg-secondary/20 border-border/60 hover:bg-secondary/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground text-xs">{p.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                            {p.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">{p.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* API Key Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">
                    {aiProvider.toUpperCase()} API Key:
                  </Label>
                  {hasCustomKey && (
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Active Key Saved
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      hasCustomKey
                        ? "•••••••••••••••••••••••••••••••• (Leave blank to keep current)"
                        : providers.find((p) => p.id === aiProvider)?.placeholder || "Enter API key..."
                    }
                    className="h-9 pr-10 text-xs bg-secondary/30 border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Active Model Selector */}
              <div className="space-y-2 bg-secondary/20 p-3 rounded-xl border border-border/50">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 text-sky-400" />
                    <span>Active AI Model:</span>
                    {availableModels.length > 0 && (
                      <span className="text-[10px] text-muted-foreground font-normal">
                        ({availableModels.length} available)
                      </span>
                    )}
                  </Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => loadModels(aiProvider, apiKey)}
                      disabled={loadingModels}
                      className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                      title="Fetch latest active model list from provider"
                    >
                      <RefreshCw className={`h-3 w-3 ${loadingModels ? "animate-spin" : ""}`} />
                      <span>{loadingModels ? "Fetching..." : "Refresh"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomModel(!isCustomModel);
                        if (!isCustomModel) {
                          setCustomModelInput(aiModel);
                        }
                      }}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                    >
                      {isCustomModel ? "Pick from list" : "Custom ID"}
                    </button>
                  </div>
                </div>

                {isCustomModel ? (
                  <div className="space-y-1">
                    <Input
                      type="text"
                      value={customModelInput}
                      onChange={(e) => setCustomModelInput(e.target.value)}
                      placeholder="e.g. meta/llama-3.3-70b-instruct, gpt-4o, or custom model"
                      className="h-9 text-xs bg-secondary/40 border-border"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Enter any exact model identifier supported by your {aiProvider.toUpperCase()} endpoint.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <select
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      disabled={loadingModels || availableModels.length === 0}
                      className="w-full h-9 rounded-md bg-secondary/40 border border-border px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                    >
                      {availableModels.length === 0 ? (
                        <option value={aiModel}>{aiModel || "Loading active models..."}</option>
                      ) : (
                        availableModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name || m.id} {m.isRecommended ? "⭐ (Recommended)" : ""}
                          </option>
                        ))
                      )}
                    </select>
                    {availableModels.find((m) => m.id === aiModel)?.description && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {availableModels.find((m) => m.id === aiModel)?.description}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Validation Result Alert */}
              {testResult && (
                <div
                  className={`p-2.5 rounded-lg border flex items-center gap-2 text-xs ${
                    testResult.success
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                      : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestApiKey}
                  disabled={testingKey || (!apiKey.trim() && !hasCustomKey)}
                  className="text-xs h-8 gap-1.5 border-border hover:bg-secondary cursor-pointer"
                >
                  <Cpu className={`h-3.5 w-3.5 ${testingKey ? "animate-spin" : ""}`} />
                  <span>{testingKey ? "Testing..." : "Test Connection"}</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveAIConfig}
                  disabled={savingAI}
                  className="text-xs h-8 gap-1.5 bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
                >
                  <span>{savingAI ? "Saving..." : "Save AI Settings"}</span>
                </Button>
              </div>
            </div>
          )}

          {/* TAB: INBOX & NEWSLETTER BUNDLING */}
          {activeTab === "inbox" && (
            <div className="space-y-4">
              {/* Header Description */}
              <div className="bg-secondary/30 p-3.5 rounded-xl border border-border/60 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 shrink-0 mt-0.5">
                  <Newspaper className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    Autonomous Newsletter Bundling & Executive Rollup
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                    Prevent marketing emails, Substack issues, and promotional newsletters from interrupting your focus. Mailr intercepts newsletters, bundles them away from your primary inbox, and synthesizes them into your daily Morning Briefing.
                  </p>
                </div>
              </div>

              {/* Toggle Card */}
              <div className="p-4 rounded-xl border border-border/60 bg-secondary/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold text-foreground">
                      Bundle Newsletters into Executive Digest
                    </Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Automatically archive incoming newsletters to keep your primary inbox at Zero.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-card/60 px-2.5 py-1 rounded-lg border border-border/60">
                    <span className="text-[11px] font-medium text-foreground">
                      {bundleNewsletters ? "Bundling Active" : "Disabled"}
                    </span>
                    <input
                      type="checkbox"
                      checked={bundleNewsletters}
                      onChange={(e) => setBundleNewsletters(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-600"
                    />
                  </label>
                </div>

                {/* Delivery Time Picker */}
                <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-4">
                  <div>
                    <Label className="text-xs font-medium text-foreground">
                      Executive Rollup Target Time
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      When your daily AI executive newsletter summary is compiled
                    </p>
                  </div>
                  <select
                    value={newsletterDeliveryTime}
                    onChange={(e) => setNewsletterDeliveryTime(e.target.value)}
                    className="h-8 rounded-lg bg-background border border-border px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="07:00">07:00 AM (Early Bird)</option>
                    <option value="08:00">08:00 AM (Morning Routine)</option>
                    <option value="09:00">09:00 AM (Workday Start)</option>
                    <option value="12:00">12:00 PM (Lunch Digest)</option>
                    <option value="18:00">06:00 PM (Evening Rollup)</option>
                  </select>
                </div>
              </div>

              {/* Information / Acceptance Checklist */}
              <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-3 text-xs space-y-2">
                <div className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-purple-400" />
                  What happens when enabled:
                </div>
                <ul className="text-[11px] text-purple-200/80 space-y-1 pl-4 list-disc">
                  <li>Inbound newsletters bypass the primary feed into your dedicated "Newsletters" view.</li>
                  <li>Every Morning Briefing synthesizes key industry announcements and bullet summaries.</li>
                  <li>You retain 1-click access to the original full text and unsubscribe links at any time.</li>
                </ul>
              </div>

              {/* Real-Time IMAP IDLE Push Status Card */}
              <div className="p-3.5 bg-secondary/20 rounded-xl border border-border/60 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${idleStatus?.isRealTimePushActive ? "bg-emerald-500/20 text-emerald-400" : "bg-sky-500/20 text-sky-400"}`}>
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                      <span>Real-Time Push Ingestion (IMAP IDLE)</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${idleStatus?.isRealTimePushActive ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-secondary text-muted-foreground border border-border/60"}`}>
                        {idleStatus?.isRealTimePushActive ? "SUB-SECOND PUSH ACTIVE" : "POLLING FALLBACK (45s)"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {idleStatus?.isRealTimePushActive
                        ? `Persistent TCP socket active. Remote mail server pushes incoming messages the millisecond they arrive.`
                        : `Safety-net polling loop active (every 45s). Connected accounts automatically negotiate persistent IDLE sockets.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveNewsletters}
                  disabled={savingNewsletters}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-8 px-4 font-medium shadow-sm cursor-pointer"
                >
                  {savingNewsletters ? "Saving..." : "Save Inbox Preferences"}
                </Button>
              </div>
            </div>
          )}

          {/* TAB: URGENT ALERTS (TELEGRAM & DISCORD) */}
          {activeTab === "alerts" && (
            <div className="space-y-4">
              {/* Header Card */}
              <div className="bg-secondary/30 p-3.5 rounded-xl border border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <Bell className="h-4 w-4 text-amber-400" />
                    Inbound Urgent Push Notifications
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer bg-card/60 px-2.5 py-1 rounded-lg border border-border/60">
                    <span className="text-[11px] font-medium text-foreground">Alerts Active</span>
                    <input
                      type="checkbox"
                      checked={alertsEnabled}
                      onChange={(e) => setAlertsEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-sky-600 focus:ring-sky-500 cursor-pointer accent-sky-600"
                    />
                  </label>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Mailr runs 24/7 on your server. When incoming emails are classified as Urgent by the AI scoring engine, get alerted on Telegram or Discord instantly with deep links back to the thread.
                </p>
              </div>

              {/* Priority Threshold Selector */}
              <div className="p-3.5 rounded-xl bg-secondary/20 border border-border/60 space-y-2">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span>Notification Threshold</span>
                </Label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setAlertThreshold("URGENT")}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      alertThreshold === "URGENT"
                        ? "bg-red-500/10 border-red-500/40 text-red-400 font-medium"
                        : "bg-secondary/30 border-border/60 text-muted-foreground hover:bg-secondary/60"
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      <span>🚨 Urgent Only</span>
                      {alertThreshold === "URGENT" && <CheckCircle2 className="h-3 w-3 ml-auto text-red-400" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Server outages, emergencies, urgent escalation requests.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAlertThreshold("HIGH")}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      alertThreshold === "HIGH"
                        ? "bg-amber-500/10 border-amber-500/40 text-amber-400 font-medium"
                        : "bg-secondary/30 border-border/60 text-muted-foreground hover:bg-secondary/60"
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      <span>⚡ Urgent + High</span>
                      {alertThreshold === "HIGH" && <CheckCircle2 className="h-3 w-3 ml-auto text-amber-400" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Includes client proposals, VIP inquiries, and time-sensitive threads.
                    </p>
                  </button>
                </div>
              </div>

              {/* Telegram Bot Section */}
              <div className="p-3.5 rounded-xl bg-secondary/20 border border-border/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400">
                      <Send className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground flex items-center gap-2 text-xs">
                        <span>Telegram Bot Integration</span>
                        {hasTelegramToken && (
                          <Badge variant="outline" className="text-[9px] text-emerald-400 border-emerald-500/30">
                            Configured
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Receive push messages on private Telegram chats or channels.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Telegram Bot Token</Label>
                    <Input
                      type="password"
                      value={telegramBotToken}
                      onChange={(e) => setTelegramBotToken(e.target.value)}
                      placeholder={hasTelegramToken ? "•••••••••••• (Leave blank to keep current)" : "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"}
                      className="h-8 text-xs bg-secondary/40 border-border font-mono"
                    />
                    <p className="text-[9px] text-muted-foreground">Obtain from @BotFather on Telegram</p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Telegram Chat ID</Label>
                    <Input
                      type="text"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      placeholder="e.g. 123456789 or -1001234567890"
                      className="h-8 text-xs bg-secondary/40 border-border font-mono"
                    />
                    <p className="text-[9px] text-muted-foreground">Find via @userinfobot or message updates</p>
                  </div>
                </div>

                {telegramTestResult && (
                  <div className={`p-2 rounded text-[11px] flex items-center gap-1.5 ${telegramTestResult.success ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30" : "bg-red-950/60 text-red-300 border border-red-500/30"}`}>
                    {telegramTestResult.success ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                    <span>{telegramTestResult.message}</span>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestTelegram}
                    disabled={testingTelegram || (!telegramBotToken && !hasTelegramToken) || !telegramChatId}
                    className="text-xs h-7 gap-1.5 border-border hover:bg-secondary cursor-pointer"
                  >
                    <span>{testingTelegram ? "Testing..." : "Test Telegram Ping"}</span>
                  </Button>
                </div>
              </div>

              {/* Discord Webhook Section */}
              <div className="p-3.5 rounded-xl bg-secondary/20 border border-border/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground flex items-center gap-2 text-xs">
                        <span>Discord Channel Webhook</span>
                        {hasDiscordWebhook && (
                          <Badge variant="outline" className="text-[9px] text-emerald-400 border-emerald-500/30">
                            Configured
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Post rich embeds to your private Discord server channel.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <Label className="text-[11px] text-muted-foreground">Discord Webhook URL</Label>
                  <Input
                    type="password"
                    value={discordWebhookUrl}
                    onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                    placeholder={hasDiscordWebhook ? (discordMasked || "•••••••••••• (Leave blank to keep)") : "https://discord.com/api/webhooks/..."}
                    className="h-8 text-xs bg-secondary/40 border-border font-mono"
                  />
                  <p className="text-[9px] text-muted-foreground">Created in Discord Server Settings &gt; Integrations &gt; Webhooks</p>
                </div>

                {discordTestResult && (
                  <div className={`p-2 rounded text-[11px] flex items-center gap-1.5 ${discordTestResult.success ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30" : "bg-red-950/60 text-red-300 border border-red-500/30"}`}>
                    {discordTestResult.success ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                    <span>{discordTestResult.message}</span>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestDiscord}
                    disabled={testingDiscord || (!discordWebhookUrl && !hasDiscordWebhook)}
                    className="text-xs h-7 gap-1.5 border-border hover:bg-secondary cursor-pointer"
                  >
                    <span>{testingDiscord ? "Testing..." : "Test Discord Ping"}</span>
                  </Button>
                </div>
              </div>

              {/* Slack Webhook Section */}
              <div className="p-3.5 rounded-xl bg-secondary/20 border border-border/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground flex items-center gap-2 text-xs">
                        <span>Slack Channel Webhook</span>
                        {hasSlackWebhook && (
                          <Badge variant="outline" className="text-[9px] text-emerald-400 border-emerald-500/30">
                            Configured
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Post instant agent alerts to your private or team Slack workspace.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <Label className="text-[11px] text-muted-foreground">Slack Webhook URL</Label>
                  <Input
                    type="password"
                    value={slackWebhookUrl}
                    onChange={(e) => setSlackWebhookUrl(e.target.value)}
                    placeholder={hasSlackWebhook ? (slackMasked || "•••••••••••• (Leave blank to keep)") : "https://hooks.slack.com/services/..."}
                    className="h-8 text-xs bg-secondary/40 border-border font-mono"
                  />
                  <p className="text-[9px] text-muted-foreground">Created via Slack API App &gt; Incoming Webhooks</p>
                </div>

                {slackTestResult && (
                  <div className={`p-2 rounded text-[11px] flex items-center gap-1.5 ${slackTestResult.success ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30" : "bg-red-950/60 text-red-300 border border-red-500/30"}`}>
                    {slackTestResult.success ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                    <span>{slackTestResult.message}</span>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestSlack}
                    disabled={testingSlack || (!slackWebhookUrl && !hasSlackWebhook)}
                    className="text-xs h-7 gap-1.5 border-border hover:bg-secondary cursor-pointer"
                  >
                    <span>{testingSlack ? "Testing..." : "Test Slack Ping"}</span>
                  </Button>
                </div>
              </div>

              {/* WhatsApp / Mobile Push Webhook Section */}
              <div className="p-3.5 rounded-xl bg-secondary/20 border border-border/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-green-500/15 text-green-400">
                      <Bell className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground flex items-center gap-2 text-xs">
                        <span>WhatsApp & Mobile Push Webhook</span>
                        {hasCustomWebhook && (
                          <Badge variant="outline" className="text-[9px] text-emerald-400 border-emerald-500/30">
                            Configured
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Dispatch alerts directly to WhatsApp (Twilio/Meta gateway), Pushover, ntfy.sh, or generic mobile webhook.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <Label className="text-[11px] text-muted-foreground">Webhook / WhatsApp Gateway Endpoint URL</Label>
                  <Input
                    type="password"
                    value={customWebhookUrl}
                    onChange={(e) => setCustomWebhookUrl(e.target.value)}
                    placeholder={hasCustomWebhook ? (customMasked || "•••••••••••• (Leave blank to keep)") : "https://ntfy.sh/my-topic OR https://api.pushover.net/..."}
                    className="h-8 text-xs bg-secondary/40 border-border font-mono"
                  />
                  <p className="text-[9px] text-muted-foreground">Receives POST JSON: <code>&#123; title, message, priority, url &#125;</code> for instant mobile delivery</p>
                </div>

                {customTestResult && (
                  <div className={`p-2 rounded text-[11px] flex items-center gap-1.5 ${customTestResult.success ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30" : "bg-red-950/60 text-red-300 border border-red-500/30"}`}>
                    {customTestResult.success ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                    <span>{customTestResult.message}</span>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestCustom}
                    disabled={testingCustom || (!customWebhookUrl && !hasCustomWebhook)}
                    className="text-xs h-7 gap-1.5 border-border hover:bg-secondary cursor-pointer"
                  >
                    <span>{testingCustom ? "Testing..." : "Test Mobile Ping"}</span>
                  </Button>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2 border-t border-border/50">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveAlerts}
                  disabled={savingAlerts}
                  className="text-xs h-8 gap-1.5 bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
                >
                  <span>{savingAlerts ? "Saving..." : "Save Alert Settings"}</span>
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: CALENDAR & SCHEDULING */}
          {activeTab === "calendar" && (
            <div className="space-y-4">
              <div className="bg-secondary/30 p-3 rounded-xl border border-border/60 space-y-1">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                  Autonomous Calendar & Booking Links
                </span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Link your booking availability below. When an incoming email asks to schedule a sync or meeting, Mailr Copilot can automatically embed your link in one click.
                </p>
              </div>

              {/* Cal.com Input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5 text-sky-400" />
                  <span>Cal.com Booking URL</span>
                </Label>
                <Input
                  type="url"
                  value={calComUrl}
                  onChange={(e) => setCalComUrl(e.target.value)}
                  placeholder="https://cal.com/your-username/30min"
                  className="h-8 text-xs bg-secondary/30 border-border"
                />
                <p className="text-[10px] text-muted-foreground">
                  e.g. https://cal.com/username
                </p>
              </div>

              {/* Calendly Input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5 text-sky-400" />
                  <span>Calendly Booking URL</span>
                </Label>
                <Input
                  type="url"
                  value={calendlyUrl}
                  onChange={(e) => setCalendlyUrl(e.target.value)}
                  placeholder="https://calendly.com/your-username/30min"
                  className="h-8 text-xs bg-secondary/30 border-border"
                />
                <p className="text-[10px] text-muted-foreground">
                  e.g. https://calendly.com/username
                </p>
              </div>

              {/* Google & Outlook Status Card */}
              <div className="p-3 rounded-xl bg-secondary/20 border border-border/60 space-y-2">
                <span className="text-[11px] font-semibold text-foreground">Direct Calendar Deep Links:</span>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5 p-2 rounded bg-card/40 border border-border/40">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    <span>Google Calendar (1-Click)</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded bg-card/40 border border-border/40">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    <span>Outlook Web (1-Click)</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-border/50">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveCalendar}
                  disabled={savingCal}
                  className="text-xs h-8 gap-1.5 bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
                >
                  <span>{savingCal ? "Saving..." : "Save Calendar Links"}</span>
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY & KEYS */}
          {activeTab === "security" && (
            <div className="space-y-4">
              <div className="bg-secondary/40 rounded-xl p-3 border border-border/50 space-y-2">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <Lock className="h-4 w-4 text-emerald-400" />
                  <span>AES-256-GCM Zero-Knowledge Storage</span>
                </div>
                <p className="leading-relaxed text-muted-foreground">
                  OAuth refresh tokens, IMAP passwords, SMTP secrets, and BYOK AI keys are never stored in plain text.
                  Every credential undergoes an authenticated AES-256-GCM cipher with a unique initialization vector and authentication tag.
                </p>
              </div>

              <div className="bg-secondary/40 rounded-xl p-3 border border-border/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-foreground font-medium">
                    <Database className="h-4 w-4 text-emerald-400" />
                    <span>Redis & Distributed State Bus</span>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${redisStatus?.connected ? "text-emerald-400 border-emerald-500/40" : "text-sky-400 border-sky-500/40"}`}>
                    {redisStatus?.mode === "redis" ? "Connected" : "In-Memory Resilient Cache"}
                  </Badge>
                </div>
                <p className="leading-relaxed text-muted-foreground">
                  Accelerates AI Copilot response times, caches active model matrices, and coordinates real-time agent pub/sub event broadcasting.
                </p>
                {redisStatus && (
                  <div className="pt-1 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/40 font-mono">
                    <span>Endpoint: <strong className="text-foreground">{redisStatus.redisUrl}</strong></span>
                    <span>Cached Entries: <strong className="text-foreground">{redisStatus.memoryKeysCount}</strong></span>
                  </div>
                )}
              </div>

              <div className="bg-secondary/40 rounded-xl p-3 border border-border/50 space-y-2">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <Server className="h-4 w-4 text-sky-400" />
                  <span>Docker VPS Deployment Ready</span>
                </div>
                <p className="leading-relaxed text-muted-foreground">
                  Mailr is containerized with Docker, docker-compose, and Nginx reverse proxy.
                  Self-host on any Linux VPS or run locally with MySQL XAMPP.
                </p>
              </div>

              <div className="flex items-center justify-between text-xs pt-2">
                <span className="text-muted-foreground">Connected Inboxes:</span>
                <span className="font-semibold text-foreground">{accountsCount} active</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-card/40 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
