import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  Sparkles,
  Mail,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  CheckCircle2,
  Terminal,
  Zap,
  Lock,
  Globe,
  Inbox,
  Filter,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-20 pb-28 md:pt-32 md:pb-36">
          {/* Subtle glow background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-indigo-600/20 via-violet-600/15 to-transparent blur-[140px] pointer-events-none rounded-full" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            {/* Pill Announcement */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-8">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Next-Gen Provider-Agnostic Email Client with AI</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.1]">
              One client for every inbox you own.{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-indigo-200 bg-clip-text text-transparent">
                Supercharged by AI.
              </span>
            </h1>

            {/* Subheading */}
            <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Connect Google Workspace, Microsoft 365, Apple iCloud, and custom domain IMAP/SMTP into a unified, zero-distraction view. Triage with plain English commands, surface only priority emails, and auto-book calendar invites.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/app"
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-white font-semibold text-base shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <span>Launch Mailr Web App</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/about"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 font-semibold text-base hover:bg-slate-800 transition-all"
              >
                Read Architectural Blueprint
              </Link>
            </div>

            {/* Provider Support Chips */}
            <div className="mt-14 pt-10 border-t border-slate-800/60 max-w-4xl mx-auto">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-5">
                Native Adapters for Any Email Provider
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {[
                  { name: 'Google Workspace / Gmail', color: 'border-red-500/30 text-red-300 bg-red-500/10' },
                  { name: 'Microsoft 365 / Outlook', color: 'border-blue-500/30 text-blue-300 bg-blue-500/10' },
                  { name: 'Apple iCloud Mail', color: 'border-sky-500/30 text-sky-300 bg-sky-500/10' },
                  { name: 'Custom Domain IMAP & SMTP', color: 'border-purple-500/30 text-purple-300 bg-purple-500/10' },
                  { name: 'Zoho Mail', color: 'border-amber-500/30 text-amber-300 bg-amber-500/10' },
                  { name: 'Fastmail / Proton Bridge', color: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' },
                ].map((item) => (
                  <span
                    key={item.name}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${item.color}`}
                  >
                    {item.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Interactive Email Client Mockup Preview (UI/UX Pro Max Glass Card) */}
            <div className="mt-16 relative mx-auto max-w-5xl rounded-3xl border border-white/[0.1] bg-slate-900/80 backdrop-blur-2xl shadow-2xl shadow-indigo-950/60 overflow-hidden text-left glow-ambient">
              {/* Window Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-[#0c121e]/90 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-sm shadow-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80 shadow-sm shadow-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80 shadow-sm shadow-green-500/50" />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/80 px-3.5 py-1 rounded-lg border border-white/[0.08] shadow-inner">
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-mono text-[11px]">Cmd+K: &quot;Archive newsletters older than 7 days&quot;</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Live Interface</span>
                </div>
              </div>

              {/* Mockup Body: 3-pane email client layout */}
              <div className="grid grid-cols-12 h-[380px] text-xs">
                {/* Left Mini Rail */}
                <div className="col-span-3 border-r border-slate-800/80 bg-[#090d16] p-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                      <span>Accounts</span>
                      <span className="text-emerald-400 font-mono">3 Online</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-white flex items-center justify-between">
                        <span className="font-medium">All Inboxes</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-[10px] font-bold">14</span>
                      </div>
                      <div className="p-2 rounded-lg hover:bg-slate-800/50 text-slate-300 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="truncate">alex@acme-corp.com</span>
                      </div>
                      <div className="p-2 rounded-lg hover:bg-slate-800/50 text-slate-300 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="truncate">alex@gmail.com</span>
                      </div>
                      <div className="p-2 rounded-lg hover:bg-slate-800/50 text-slate-300 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        <span className="truncate">founder@startup.io</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-indigo-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px]">AES-256 Encrypted</span>
                  </div>
                </div>

                {/* Middle Messages List */}
                <div className="col-span-4 border-r border-slate-800/80 bg-slate-950 p-2 space-y-2 overflow-y-auto">
                  {/* Urgent Email Card */}
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-red-500/40 text-white space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-100">Elena Rostova</span>
                      <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] font-bold">
                        P1 URGENT
                      </span>
                    </div>
                    <div className="font-medium text-[11px] truncate text-slate-200">
                      URGENT: Signed Term Sheet & Legal Review required
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      The partners require your counter-signature before 5 PM...
                    </div>
                  </div>

                  {/* Meeting Proposal Card */}
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-indigo-500/30 text-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-200">David Chen</span>
                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-bold">
                        CALENDAR
                      </span>
                    </div>
                    <div className="font-medium text-[11px] truncate text-slate-300">
                      Quick Sync: Architecture Review & VPS Setup
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Are you available tomorrow at 3:00 PM for 30 mins?
                    </div>
                  </div>

                  {/* Normal Email */}
                  <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800 text-slate-400 space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Cloudflare Billing</span>
                      <span className="text-[9px]">3h ago</span>
                    </div>
                    <div className="truncate text-slate-300 font-medium">Invoice #INV-2026-904 processed</div>
                  </div>
                </div>

                {/* Right Reading View */}
                <div className="col-span-5 bg-[#090d16] p-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    {/* Meeting Proposal Banner */}
                    <div className="p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-500/40 text-indigo-200 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-[11px] text-indigo-300">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Proposed Booking: Quick Sync with David</span>
                      </div>
                      <div className="text-[10px] text-slate-300">
                        Tomorrow at 3:00 PM - 3:30 PM (30 mins)
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-medium text-[10px]">
                          Accept & Add to Calendar
                        </span>
                        <span className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer">
                          Export .ics
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-bold text-slate-100 text-sm">
                        Quick Sync: Architecture Review & VPS Setup
                      </h3>
                      <p className="text-[11px] text-slate-400">From: david@engineers.dev → To: founder@startup.io</p>
                    </div>

                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Hey Alex, I reviewed the Mailr Next.js frontend and Express backend. Would love to sync up tomorrow at 3:00 PM to finalize our Docker VPS deployment strategy.
                    </p>
                  </div>

                  {/* AI Quick Reply Chips */}
                  <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">AI Reply:</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] cursor-pointer">
                      Sounds good, booked!
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] cursor-pointer">
                      Propose 4 PM instead
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* THREE CORE SUPERPOWERS SECTION */}
        <section id="features" className="py-24 bg-[#070a12] border-t border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-xs uppercase tracking-wider text-indigo-400 font-semibold mb-3">
                Core Architectural Pillars
              </h2>
              <p className="text-3xl sm:text-4xl font-extrabold text-white">
                Engineered for speed, focus, and total inbox sovereignty.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="p-8 rounded-3xl glass-card space-y-4 hover:border-indigo-500/30">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-sm shadow-indigo-500/20">
                  <Terminal className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Natural Language Triage</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Press <kbd className="px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-mono">Cmd+K</kbd> and give natural instructions. Mailr parses the intent and bulk modifies your inboxes without tedious manual filters.
                </p>
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/[0.06] text-xs font-mono text-indigo-300">
                  &quot;Archive all GitHub notifications older than 3 days&quot;
                </div>
              </div>

              {/* Feature 2 */}
              <div className="p-8 rounded-3xl glass-card space-y-4 hover:border-red-500/30">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shadow-sm shadow-red-500/20">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Priority Inbox Surfacing</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Never miss crucial contracts, client questions, or server alerts. Mailr automatically scores every incoming thread and filters your view down to actionable P1/P2 priorities.
                </p>
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold pt-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Cuts daily email noise by up to 75%</span>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="p-8 rounded-3xl glass-card space-y-4 hover:border-violet-500/30">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shadow-sm shadow-violet-500/20">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Calendar Booking Proposals</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  When a client asks for a meeting, Mailr extracts the time, participants, and subject, generating one-click calendar events or downloadable standard <code className="text-violet-300">.ics</code> files.
                </p>
                <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold pt-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Supports Google Calendar, Outlook & Apple</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECURITY & ZERO-KNOWLEDGE SECTION */}
        <section className="py-24 bg-[#090d16] border-t border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Zero-Knowledge Security</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
                  Your credentials are never stored in plaintext. Period.
                </h2>
                <p className="text-base text-slate-300 leading-relaxed">
                  Every OAuth refresh token, IMAP/SMTP password, and Bring-Your-Own (BYOK) AI API key is encrypted using AES-256-GCM authenticated cipher with unique 12-byte initialization vectors and integrity tags.
                </p>

                <div className="space-y-3 pt-2">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-300">
                      <strong className="text-white">Strict Tenant Isolation:</strong> Messages and tokens are cryptographically bounded to your user account.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-300">
                      <strong className="text-white">Full Token Revocation:</strong> Disconnecting an account completely purges tokens and cached metadata.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-300">
                      <strong className="text-white">Docker VPS Self-Hosting:</strong> Deploy your own single-tenant instance on any Ubuntu/Debian server with Docker Compose.
                    </p>
                  </div>
                </div>
              </div>

              {/* Encryption Code Card */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 font-mono text-xs text-slate-300 shadow-xl overflow-x-auto">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4 text-slate-400">
                  <span>backend/src/utils/crypto.ts</span>
                  <span className="text-emerald-400">AES-256-GCM Verified</span>
                </div>
                <pre className="text-slate-300">
{`const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
let encrypted = cipher.update(plainToken, 'utf8', 'hex');
encrypted += cipher.final('hex');
const authTag = cipher.getAuthTag().toString('hex');

// Stored in MySQL as iv:authTag:ciphertext
return \`\${iv.toString('hex')}:\${authTag}:\${encrypted}\`;`}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* CALL TO ACTION */}
        <section className="py-20 bg-gradient-to-b from-[#090d16] to-[#0d1321] border-t border-slate-800/80 text-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white">
              Ready to take control of your inboxes?
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-xl mx-auto">
              Launch the web app now to test with pre-seeded demo accounts or connect your own Google, Outlook, and IMAP mailboxes in seconds.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link
                href="/app"
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-white font-semibold text-base shadow-xl shadow-indigo-500/30 hover:scale-[1.02] transition-transform"
              >
                Launch Mailr App →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
