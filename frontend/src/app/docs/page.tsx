'use client';

import * as React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import {
  BookOpen,
  Terminal,
  Server,
  HardDrive,
  Cpu,
  Mail,
  Shield,
  Layers,
  Key,
  Copy,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Paperclip,
  Calendar,
  Command,
  Database,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
  badge?: string;
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = React.useState<string>('overview');
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const sections: DocSection[] = [
    { id: 'overview', title: '1. Overview & Architecture', icon: Layers },
    { id: 'deployment', title: '2. Docker VPS Deployment', icon: Server, badge: 'Popular' },
    { id: 'providers', title: '3. Email Provider Setup', icon: Mail },
    { id: 'attachments', title: '4. Attachment Management', icon: HardDrive },
    { id: 'agent-tools', title: '5. AI Copilot (13 Tools)', icon: Cpu, badge: 'Agent' },
    { id: 'byok-models', title: '6. AI Models & BYOK', icon: Sparkles },
    { id: 'api-reference', title: '7. REST API & SSE Events', icon: Terminal },
    { id: 'shortcuts', title: '8. Keyboard Shortcuts', icon: Command },
  ];

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#070a12] text-slate-200">
      <Navbar />

      {/* Docs Header Banner */}
      <section className="border-b border-slate-800/80 bg-[#090d16] py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Mailr Documentation &amp; Knowledge Base</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Documentation &amp; Deployment Guide
              </h1>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                Everything you need to self-host Mailr on your VPS, connect multi-provider inboxes, configure local database storage, and deploy the autonomous AI Copilot agent.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/app"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold text-xs shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all"
              >
                <span>Launch App</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/pricing"
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors"
              >
                Self-Hosting Hub
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Documentation Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sticky Sidebar Navigation */}
          <aside className="lg:col-span-3 sticky top-24 space-y-2 bg-slate-900/50 p-3 rounded-2xl border border-slate-800/80 backdrop-blur-md">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-1.5">
              Documentation Index
            </div>
            <nav className="space-y-1">
              {sections.map((sec) => {
                const Icon = sec.icon;
                const isActive = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActiveSection(sec.id)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left cursor-pointer',
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-white' : 'text-slate-400')} />
                      <span className="truncate">{sec.title}</span>
                    </div>
                    {sec.badge && (
                      <span
                        className={cn(
                          'text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider',
                          isActive ? 'bg-white/20 text-white' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        )}
                      >
                        {sec.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Documentation Content Pane */}
          <main className="lg:col-span-9 space-y-10 min-w-0">
            {/* SECTION 1: OVERVIEW & ARCHITECTURE */}
            {activeSection === 'overview' && (
              <div className="space-y-6">
                <div className="space-y-2 border-b border-slate-800 pb-5">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
                    <Layers className="w-6 h-6 text-indigo-400" />
                    <span>System Architecture &amp; Local Storage</span>
                  </h2>
                  <p className="text-sm text-slate-400">
                    How Mailr stores your messages, threads, and AI Copilot chats locally on your own VPS host.
                  </p>
                </div>

                <div className="prose prose-invert max-w-none text-sm text-slate-300 space-y-4 leading-relaxed">
                  <p>
                    Mailr is a <strong>self-hostable, single-tenant, multi-account email client</strong> and autonomous AI Copilot. Unlike cloud SaaS email clients that proxy all communications through centralized company servers, Mailr is deployed directly on your own infrastructure (Ubuntu/Debian VPS, Docker, or home lab).
                  </p>

                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 font-mono text-xs">
                    <div className="text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                      Stack Architecture
                    </div>
                    <div className="text-slate-300 space-y-1">
                      <div>├── <strong className="text-white">Next.js 14 App Router</strong>: Responsive UI, shadcn sidebar-09, SSE listener, dark mode</div>
                      <div>├── <strong className="text-white">Node.js / Express API</strong>: Provider adapters, 13 agent tools, crypto manager, REST endpoints</div>
                      <div>├── <strong className="text-white">MySQL 8.0 (Local DB)</strong>: Stores messages, threads, credentials, notes, and AI chats</div>
                      <div>├── <strong className="text-white">Redis 7 (In-Memory)</strong>: Distributed cache for model catalogs, user AI configs, and triage states</div>
                      <div>└── <strong className="text-white">Nginx Reverse Proxy</strong>: Port 80/443 SSL termination, routing to frontend and backend</div>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white pt-2">Why Local Storage Matters for Privacy:</h3>
                  <ul className="list-disc pl-5 space-y-2 text-slate-300">
                    <li>
                      <strong>Zero Third-Party Cloud Inspection:</strong> Your email text, subject lines, recipients, and Copilot chats are stored in your MySQL instance. No SaaS vendor has access to your database.
                    </li>
                    <li>
                      <strong>Zero-Knowledge Token Security:</strong> All OAuth refresh tokens and IMAP/SMTP passwords are encrypted with AES-256-GCM using your private server key before entering MySQL.
                    </li>
                    <li>
                      <strong>Instant Cross-Account Search:</strong> Because emails are stored locally, full-text searches across all accounts complete in milliseconds without remote provider rate limits.
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* SECTION 2: DOCKER VPS DEPLOYMENT */}
            {activeSection === 'deployment' && (
              <div className="space-y-6">
                <div className="space-y-2 border-b border-slate-800 pb-5">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
                    <Server className="w-6 h-6 text-indigo-400" />
                    <span>Docker VPS Deployment Guide</span>
                  </h2>
                  <p className="text-sm text-slate-400">
                    Deploy Mailr on any Linux VPS (Hetzner, DigitalOcean, Linode, AWS) with a single command.
                  </p>
                </div>

                <div className="space-y-6 text-sm text-slate-300">
                  <div className="space-y-3">
                    <h3 className="text-base font-bold text-white">1. System Requirements</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                        <strong className="text-white block mb-1">CPU</strong>
                        1 vCPU minimum (2 vCPUs recommended)
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                        <strong className="text-white block mb-1">RAM</strong>
                        1 GB minimum (2 GB recommended for Redis)
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                        <strong className="text-white block mb-1">Storage</strong>
                        10 GB SSD / NVMe
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-white">2. Quick Start Commands</h3>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            'git clone https://github.com/wellparth/mailr.git\ncd mailr\ncp .env.example .env\ndocker compose up --build -d',
                            'docker-run'
                          )
                        }
                        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
                      >
                        {copiedId === 'docker-run' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === 'docker-run' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto">
{`# 1. Clone the repository
git clone https://github.com/wellparth/mailr.git
cd mailr

# 2. Configure environment keys
cp .env.example .env
nano .env

# 3. Launch all containers in background
docker compose up --build -d`}
                    </pre>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-base font-bold text-white">3. Environment Variables Reference</h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-4 font-semibold">Variable</th>
                            <th className="py-2.5 px-4 font-semibold">Description</th>
                            <th className="py-2.5 px-4 font-semibold">Default / Example</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                          <tr>
                            <td className="py-2.5 px-4 font-mono text-indigo-300">DATABASE_URL</td>
                            <td className="py-2.5 px-4">MySQL connection string for local data storage</td>
                            <td className="py-2.5 px-4 font-mono text-slate-400">mysql://user:pass@db:3306/mailr_dev</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-mono text-indigo-300">REDIS_URL</td>
                            <td className="py-2.5 px-4">Redis URL for fast caching &amp; pub/sub events</td>
                            <td className="py-2.5 px-4 font-mono text-slate-400">redis://redis:6379</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-mono text-indigo-300">ENCRYPTION_MASTER_KEY</td>
                            <td className="py-2.5 px-4">32-byte hex secret for AES-256-GCM token encryption</td>
                            <td className="py-2.5 px-4 font-mono text-slate-400">64-char hexadecimal string</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-mono text-indigo-300">JWT_SECRET</td>
                            <td className="py-2.5 px-4">Secret used to sign user session tokens</td>
                            <td className="py-2.5 px-4 font-mono text-slate-400">random_secure_secret_string</td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-4 font-mono text-indigo-300">SYNC_INTERVAL_MS</td>
                            <td className="py-2.5 px-4">Periodic background sync interval in milliseconds</td>
                            <td className="py-2.5 px-4 font-mono text-slate-400">45000 (45 seconds)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3: EMAIL PROVIDER SETUP */}
            {activeSection === 'providers' && (
              <div className="space-y-6">
                <div className="space-y-2 border-b border-slate-800 pb-5">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
                    <Mail className="w-6 h-6 text-indigo-400" />
                    <span>Email Provider Setup &amp; Connection</span>
                  </h2>
                  <p className="text-sm text-slate-400">
                    Connect Google Workspace, Microsoft 365, Apple iCloud, and custom domain IMAP/SMTP accounts.
                  </p>
                </div>

                <div className="space-y-6 text-sm text-slate-300">
                  {/* Google Workspace */}
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-white font-bold text-base">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <h3>Google Workspace / Gmail Setup</h3>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      You can connect Google accounts using either official <strong>Google Cloud OAuth 2.0</strong> or a <strong>Google App Password</strong>:
                    </p>
                    <div className="space-y-2 text-xs">
                      <div>• <strong>OAuth 2.0:</strong> Set <code className="text-indigo-300">GOOGLE_CLIENT_ID</code> and <code className="text-indigo-300">GOOGLE_CLIENT_SECRET</code> in <code className="text-slate-400">.env</code>. Redirect URI: <code className="text-indigo-300">http://your-server/api/auth/google/callback</code>.</div>
                      <div>• <strong>App Password (Instant):</strong> Enable 2-Step Verification in Google Account &rarr; Security &rarr; App Passwords &rarr; Generate 16-character password &rarr; Enter into Mailr under IMAP/SMTP. Host: <code className="text-slate-400">imap.gmail.com:993</code> (SSL) and <code className="text-slate-400">smtp.gmail.com:587</code> (STARTTLS).</div>
                    </div>
                  </div>

                  {/* Microsoft 365 */}
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-white font-bold text-base">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                      <h3>Microsoft 365 / Outlook Setup</h3>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Connect personal Outlook/Hotmail or enterprise Microsoft 365 accounts:
                    </p>
                    <div className="space-y-2 text-xs">
                      <div>• <strong>OAuth:</strong> Register an app in Azure Portal (App Registrations) &rarr; Add redirect URI <code className="text-indigo-300">http://your-server/api/auth/microsoft/callback</code> &rarr; Set <code className="text-indigo-300">MICROSOFT_CLIENT_ID</code> and secret.</div>
                      <div>• <strong>Standard IMAP:</strong> Host: <code className="text-slate-400">outlook.office365.com:993</code> | SMTP: <code className="text-slate-400">smtp.office365.com:587</code>.</div>
                    </div>
                  </div>

                  {/* Apple iCloud & Custom IMAP */}
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-white font-bold text-base">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <h3>Apple iCloud &amp; Custom Domain IMAP/SMTP</h3>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Supports any standard email server (Fastmail, Proton Bridge, Zoho, cPanel, Postfix/Dovecot):
                    </p>
                    <div className="space-y-2 text-xs">
                      <div>• <strong>Apple iCloud:</strong> Requires an Apple ID App-Specific Password. IMAP: <code className="text-slate-400">imap.mail.me.com:993</code> | SMTP: <code className="text-slate-400">smtp.mail.me.com:587</code>.</div>
                      <div>• <strong>Custom Domains:</strong> Use Mailr&apos;s built-in <strong>Test Connection Handshake</strong> before saving to verify both IMAP read and SMTP sending ports in real time.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 4: ATTACHMENT MANAGEMENT */}
            {activeSection === 'attachments' && (
              <div className="space-y-6">
                <div className="space-y-2 border-b border-slate-800 pb-5">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
                    <HardDrive className="w-6 h-6 text-indigo-400" />
                    <span>On-Demand Attachment Management Architecture</span>
                  </h2>
                  <p className="text-sm text-slate-400">
                    How Mailr bypasses heavy binaries during sync to keep your VPS database lean and fast.
                  </p>
                </div>

                <div className="space-y-5 text-sm text-slate-300 leading-relaxed">
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-sky-400" />
                      <span>Why Binaries are Bypassed During Sync</span>
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Inboxes often contain gigabytes of PDFs, ZIPs, spreadsheets, and videos. Downloading all of them during synchronization bloats the local database and makes syncing slow.
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Mailr solves this with <strong>On-Demand Origin Streaming + Local Disk Caching</strong>:
                    </p>
                    <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-400">
                      <li><strong>Sync Phase:</strong> Only the email body, subject, sender, and attachment metadata (<code className="text-indigo-300">filename</code>, <code className="text-indigo-300">sizeBytes</code>, <code className="text-indigo-300">contentType</code>, origin ID) are stored in MySQL.</li>
                      <li><strong>Download Phase:</strong> When you click &quot;Download&quot; in the reading pane, Mailr calls the origin mail provider directly (Gmail API, MS Graph, or IMAP stream) via <code className="text-indigo-300">GET /api/messages/attachment/:id/download</code>.</li>
                      <li><strong>Local Disk Cache:</strong> Fetched files are saved to <code className="text-slate-400">uploads/attachments/</code> on your VPS. Subsequent downloads are served instantly from disk without hitting the provider again.</li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <strong className="text-white block">Lean Database</strong>
                      A 10,000 email inbox with 15 GB of files takes only ~200 MB in MySQL.
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <strong className="text-white block">File Format Cards</strong>
                      Dedicated UI cards with distinct badges for PDFs, ZIPs, images, and documents.
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                      <strong className="text-white block">Zero Vendor Lock-in</strong>
                      Original files remain safely stored at your mail provider origin.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 5: AI COPILOT & 13 AGENT TOOLS */}
            {activeSection === 'agent-tools' && (
              <div className="space-y-6">
                <div className="space-y-2 border-b border-slate-800 pb-5">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
                    <Cpu className="w-6 h-6 text-indigo-400" />
                    <span>Autonomous AI Copilot: 13 Agent Tools</span>
                  </h2>
                  <p className="text-sm text-slate-400">
                    Mailr Copilot is not just a chatbot—it is an autonomous agent with 13 specialized tools.
                  </p>
                </div>

                <div className="space-y-4 text-sm text-slate-300">
                  <p className="text-xs text-slate-400">
                    When you speak to Copilot in natural language, it inspects your inboxes and calendar, autonomously selects the appropriate tools, executes them against your local database, and displays interactive cards with single-click actions.
                  </p>

                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-4 font-semibold">Tool Name</th>
                          <th className="py-2.5 px-4 font-semibold">Natural Language Trigger Example</th>
                          <th className="py-2.5 px-4 font-semibold">Action / UI Card Produced</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                        <tr>
                          <td className="py-2.5 px-4 font-mono text-indigo-300 font-semibold">search_and_read_emails</td>
                          <td className="py-2.5 px-4">&quot;Find emails from Alex about project budget&quot;</td>
                          <td className="py-2.5 px-4">Returns matching emails with snippets and sender tags</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-mono text-indigo-300 font-semibold">compose_email_draft</td>
                          <td className="py-2.5 px-4">&quot;Write a professional reply confirming Tuesday meeting&quot;</td>
                          <td className="py-2.5 px-4">Interactive Draft Card with 1-click &quot;Send Now&quot; button</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-mono text-indigo-300 font-semibold">schedule_calendar_event</td>
                          <td className="py-2.5 px-4">&quot;Book a 30m sync with Sarah tomorrow at 3 PM&quot;</td>
                          <td className="py-2.5 px-4">Meeting card + Google Cal &amp; Outlook links + .ics download</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-mono text-indigo-300 font-semibold">check_schedule_conflict</td>
                          <td className="py-2.5 px-4">&quot;Am I free on Thursday at 2 PM?&quot;</td>
                          <td className="py-2.5 px-4">Conflict check against local calendar proposals</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-mono text-indigo-300 font-semibold">detect_and_classify_emails</td>
                          <td className="py-2.5 px-4">&quot;Check if this email is promotional or spam&quot;</td>
                          <td className="py-2.5 px-4">Explains spam/promo signals with confidence level</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-mono text-indigo-300 font-semibold">batch_clean_unnecessary_emails</td>
                          <td className="py-2.5 px-4">&quot;Clean all newsletters older than 7 days&quot;</td>
                          <td className="py-2.5 px-4">1-click Archive, Trash, or Mark as Read batch action</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-mono text-indigo-300 font-semibold">get_morning_briefing</td>
                          <td className="py-2.5 px-4">&quot;Give me my morning executive briefing&quot;</td>
                          <td className="py-2.5 px-4">Interactive Morning Briefing Card with urgent action items</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-mono text-indigo-300 font-semibold">get_follow_up_suggestions</td>
                          <td className="py-2.5 px-4">&quot;Who do I need to follow up with?&quot;</td>
                          <td className="py-2.5 px-4">Follow-Up Reminders Card with draft reply buttons</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-mono text-indigo-300 font-semibold">search_contacts</td>
                          <td className="py-2.5 px-4">&quot;Find contact info for Emily&quot;</td>
                          <td className="py-2.5 px-4">Contacts directory card with 1-click compose link</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-mono text-indigo-300 font-semibold">summarize_thread</td>
                          <td className="py-2.5 px-4">&quot;Summarize this long email thread&quot;</td>
                          <td className="py-2.5 px-4">Executive summary with interactive checkboxes</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 6: BYOK & MODEL SELECTION */}
            {activeSection === 'byok-models' && (
              <div className="space-y-6">
                <div className="space-y-2 border-b border-slate-800 pb-5">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
                    <Sparkles className="w-6 h-6 text-indigo-400" />
                    <span>Bring-Your-Own-Key (BYOK) &amp; Models</span>
                  </h2>
                  <p className="text-sm text-slate-400">
                    Use your preferred AI provider or run local on-premises models.
                  </p>
                </div>

                <div className="space-y-5 text-sm text-slate-300 leading-relaxed">
                  <p className="text-xs text-slate-400">
                    Mailr does not force you into a proprietary AI model or add token markups. You configure your own API key directly in <strong>Settings &rarr; AI Copilot &amp; BYOK</strong>.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        <span>NVIDIA NIM</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Supports high-performance open models like <code className="text-indigo-300">nvidia/nemotron-3.5-bolt-e4b</code>, <code className="text-indigo-300">meta/llama-3.3-70b-instruct</code>, and <code className="text-indigo-300">mistralai/mixtral-8x22b-instruct</code>.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                        <span>OpenAI</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Supports <code className="text-indigo-300">gpt-4o</code>, <code className="text-indigo-300">gpt-4o-mini</code>, and latest models. Mailr dynamically fetches your active model catalog via the models API.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <span>Anthropic Claude</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Supports <code className="text-indigo-300">claude-3-5-sonnet-20241022</code> and <code className="text-indigo-300">claude-3-5-haiku-20241022</code> for nuanced email composition and executive summaries.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                        <span>Self-Hosted Local LLM (Ollama / vLLM)</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Point Mailr to <code className="text-indigo-300">http://localhost:11434/v1</code> for 100% private, air-gapped AI inference running on your own GPU.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 7: REST API & SSE EVENTS */}
            {activeSection === 'api-reference' && (
              <div className="space-y-6">
                <div className="space-y-2 border-b border-slate-800 pb-5">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
                    <Terminal className="w-6 h-6 text-indigo-400" />
                    <span>REST API &amp; Server-Sent Events (SSE)</span>
                  </h2>
                  <p className="text-sm text-slate-400">
                    Comprehensive reference for Mailr&apos;s core backend API routes and real-time event stream.
                  </p>
                </div>

                <div className="space-y-6 text-sm text-slate-300">
                  <div className="space-y-3">
                    <h3 className="text-base font-bold text-white">Core API Endpoints</h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-800 font-mono text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-4 font-semibold">Method</th>
                            <th className="py-2.5 px-4 font-semibold">Endpoint</th>
                            <th className="py-2.5 px-4 font-semibold">Purpose</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                          <tr>
                            <td className="py-2 px-4 text-emerald-400 font-bold">GET</td>
                            <td className="py-2 px-4 text-white">/api/messages</td>
                            <td className="py-2 px-4 text-slate-400">Unified inbox threads with pagination, filter, and search</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-4 text-emerald-400 font-bold">GET</td>
                            <td className="py-2 px-4 text-white">/api/messages/threads/:id</td>
                            <td className="py-2 px-4 text-slate-400">Full conversation thread with all messages and attachments</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-4 text-blue-400 font-bold">POST</td>
                            <td className="py-2 px-4 text-white">/api/messages/send</td>
                            <td className="py-2 px-4 text-slate-400">Send an email from any connected identity</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-4 text-emerald-400 font-bold">GET</td>
                            <td className="py-2 px-4 text-white">/api/messages/attachment/:id/download</td>
                            <td className="py-2 px-4 text-slate-400">On-demand stream of file binary from origin mail provider</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-4 text-blue-400 font-bold">POST</td>
                            <td className="py-2 px-4 text-white">/api/agent/chat</td>
                            <td className="py-2 px-4 text-slate-400">Send prompt to AI Copilot; executes 13 autonomous tools</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-4 text-emerald-400 font-bold">GET</td>
                            <td className="py-2 px-4 text-white">/api/agent/history/:threadId?</td>
                            <td className="py-2 px-4 text-slate-400">Get locally stored conversation history for thread or inbox</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-4 text-emerald-400 font-bold">GET</td>
                            <td className="py-2 px-4 text-white">/api/messages/stream</td>
                            <td className="py-2 px-4 text-slate-400">Real-time SSE event stream for live incoming emails</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-base font-bold text-white">Server-Sent Events Payload</h3>
                    <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto">
{`// Dispatched immediately upon incoming email arrival:
{
  "type": "EMAIL_RECEIVED",
  "accountId": "acc_123",
  "threadId": "thr_456",
  "messageId": "msg_789",
  "senderName": "Sarah Jenkins",
  "senderEmail": "sarah@company.com",
  "subject": "Q3 Budget Review",
  "snippet": "Attached is the final spreadsheet for...",
  "receivedAt": "2026-11-19T14:30:00Z"
}`}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 8: KEYBOARD SHORTCUTS */}
            {activeSection === 'shortcuts' && (
              <div className="space-y-6">
                <div className="space-y-2 border-b border-slate-800 pb-5">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
                    <Command className="w-6 h-6 text-indigo-400" />
                    <span>Productivity Keyboard Shortcuts</span>
                  </h2>
                  <p className="text-sm text-slate-400">
                    Navigate, triage, and reply at lightning speed without lifting your hands from the keyboard.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="font-bold text-white">Actions &amp; AI</div>
                    <div className="space-y-2 text-slate-300">
                      <div className="flex items-center justify-between">
                        <span>Compose Email</span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px]">C</kbd>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Command Omnibar</span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px]">Cmd+K</kbd>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Toggle AI Copilot</span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px]">Cmd+J</kbd>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Executive Briefing</span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px]">Cmd+B</kbd>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="font-bold text-white">Email Triage</div>
                    <div className="space-y-2 text-slate-300">
                      <div className="flex items-center justify-between">
                        <span>Archive Thread</span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px]">E</kbd>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Star / Unstar</span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px]">S</kbd>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Reply</span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px]">R</kbd>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Close Pane / Dialog</span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px]">Esc</kbd>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
