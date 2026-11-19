import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Shield, Lock, HardDrive, Server, Database, CheckCircle2, Cpu } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Header */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <Shield className="w-3.5 h-3.5" />
              <span>Self-Hosted Data Sovereignty</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
              Data Sovereignty &amp; Local Storage Architecture
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Mailr is 100% self-hosted software. All email messages, conversation threads, attachments, and AI Copilot chats are stored locally on your own VPS or server database. There are zero third-party privacy concerns because there is no SaaS middleman.
            </p>
          </div>

          <div className="space-y-8 text-sm text-slate-300 leading-relaxed">
            {/* Section 1: Zero Cloud Middleman */}
            <section className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <h2>1. Why Privacy Concerns Do Not Exist in Self-Hosted Mailr</h2>
              </div>
              <p>
                In closed commercial SaaS email clients, users are forced to trust a venture-backed company not to read their inboxes, train LLMs on their emails, or monetize metadata for ads.
              </p>
              <p>
                Mailr eliminates this entire problem by design: <strong>you run Mailr on your own VPS, home lab, or local machine</strong>. There is no central Mailr cloud server, no telemetry or phone-home tracking, no analytics cookies, and no advertisements. You are the sole custodian and administrator of your application.
              </p>
            </section>

            {/* Section 2: Local MySQL & Redis Storage */}
            <section className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Database className="w-4 h-4 text-indigo-400" />
                <h2>2. Local Storage Architecture for Emails &amp; Copilot Chats</h2>
              </div>
              <p>
                Instead of relying on slow, ephemeral live-fetching roundtrips that restrict offline usage, Mailr ingests and indexes your messages directly into your local database:
              </p>
              <ul className="space-y-2 text-xs text-slate-300 pt-1">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Full Message Bodies:</strong> Email headers, full HTML and plaintext bodies, and attachment records are stored in your local MySQL instance. This enables instantaneous multi-inbox switching and instant full-text search.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Copilot Chat History:</strong> Your conversations with the autonomous AI agent—including drafts composed, calendar proposals, triage actions, and tool execution logs—are persisted locally in the <code className="text-indigo-300">AgentChatMessage</code> table on your VPS.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">In-Memory Redis Caching:</strong> Active AI models, user configuration, and thread summaries are cached in your local Redis instance with automatic fallback, maximizing speed without data leaving your server.
                  </span>
                </li>
              </ul>
            </section>

            {/* Section 3: Zero-Knowledge Credential Encryption */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Lock className="w-4 h-4 text-emerald-400" />
                <h2>3. Zero-Knowledge Cryptographic Token Storage</h2>
              </div>
              <p>
                Mailr connects directly to your upstream email providers (Google Workspace, Microsoft 365, Apple iCloud, Fastmail, or custom IMAP/SMTP). All stored OAuth refresh tokens, access tokens, and mailbox passwords are encrypted with military-grade <strong>AES-256-GCM authenticated cipher</strong>:
              </p>
              <p className="text-xs text-slate-400 font-mono bg-slate-950 p-3 rounded-lg border border-slate-800">
                Payload Format: iv(12-byte hex) : authTag(16-byte hex) : ciphertext(hex)
              </p>
              <p>
                The encryption key (<code className="text-emerald-400 font-mono">ENCRYPTION_KEY</code>) is specified exclusively in your server&apos;s environment file and is never accessible to anyone outside your server.
              </p>
            </section>

            {/* Section 4: BYOK AI */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Cpu className="w-4 h-4 text-purple-400" />
                <h2>4. Direct Bring-Your-Own-Key (BYOK) AI Architecture</h2>
              </div>
              <p>
                Mailr does not route AI requests through any intermediary proxy. When you use the autonomous Copilot agent or its 13 specialized tools:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-slate-400 text-xs">
                <li>Prompts are transmitted directly from your VPS to the AI provider endpoint using your personal API key (e.g., NVIDIA NIM, OpenAI, Anthropic, Google Gemini).</li>
                <li>You can also point Mailr to a self-hosted local model runner (such as Ollama or vLLM) for 100% air-gapped, on-premises AI inference with zero external API calls.</li>
                <li>Your email data is never used to train third-party foundation models.</li>
              </ul>
            </section>

            {/* Section 5: Account Disconnection */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Server className="w-4 h-4 text-sky-400" />
                <h2>5. Complete Data Erasure &amp; Control</h2>
              </div>
              <p>
                Because all data resides in your own database, you have complete control. Disconnecting a mailbox deletes its stored credentials, messages, and threads from your MySQL database. You can also clear your AI Copilot conversation history at any time with a single click.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
