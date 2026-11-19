'use client';

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
  HardDrive,
  Cpu,
  BookOpen,
  Server,
  Download,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#070a12] text-slate-200">
      <Navbar />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-20 pb-24 md:pt-32 md:pb-32">
          {/* Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[450px] bg-gradient-to-tr from-indigo-600/20 via-violet-600/15 to-transparent blur-[130px] pointer-events-none rounded-full" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            {/* Pill Announcement */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-8">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>100% Free &amp; Open Source &bull; Self-Hostable Email Client &amp; AI Agent</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.1]">
              One inbox for all your email.{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-indigo-200 bg-clip-text text-transparent">
                Self-hosted on your VPS.
              </span>
            </h1>

            {/* Subheading */}
            <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Connect Google Workspace, Microsoft 365, Apple iCloud, and custom domain IMAP/SMTP into a unified workspace. All messages and AI Copilot chats are stored locally in your database—no SaaS subscriptions, zero telemetry, and complete data sovereignty.
            </p>

            {/* Main Action CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/app"
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-white font-semibold text-sm shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <span>Launch Mailr Client</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/docs"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 font-semibold text-sm hover:bg-slate-800 transition-all"
              >
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span>Read Documentation</span>
              </Link>
              <Link
                href="/pricing"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white font-medium text-sm transition-all"
              >
                <Server className="w-4 h-4" />
                <span>Docker VPS Setup</span>
              </Link>
            </div>

            {/* Provider Support Chips */}
            <div className="mt-14 pt-8 border-t border-slate-800/60 max-w-4xl mx-auto">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-4">
                Native Adapters for Any Email Provider
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {[
                  { name: 'Google Workspace / Gmail', color: 'border-red-500/30 text-red-300 bg-red-500/10' },
                  { name: 'Microsoft 365 / Outlook', color: 'border-blue-500/30 text-blue-300 bg-blue-500/10' },
                  { name: 'Apple iCloud Mail', color: 'border-sky-500/30 text-sky-300 bg-sky-500/10' },
                  { name: 'Custom Domain IMAP & SMTP', color: 'border-purple-500/30 text-purple-300 bg-purple-500/10' },
                  { name: 'Fastmail / Proton Bridge', color: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' },
                  { name: 'Zoho Mail', color: 'border-amber-500/30 text-amber-300 bg-amber-500/10' },
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
          </div>
        </section>

        {/* 4 CORE ARCHITECTURAL PILLARS */}
        <section id="features" className="py-20 bg-[#090d16] border-y border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Designed for Speed, Privacy, and AI Autonomy
              </h2>
              <p className="text-sm sm:text-base text-slate-400">
                Everything you need to command multiple email accounts from a single sovereign workspace.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Feature 1 */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3.5 hover:border-slate-700 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Mail className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Unified Multi-Inbox</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Manage work, personal, and freelance emails side-by-side with color badges, instant cross-account search, and unread filters.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3.5 hover:border-slate-700 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">13 Autonomous AI Tools</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Natural language Copilot executes tools to triage inbox, draft replies, detect spam, clean newsletters, and schedule calendar events.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3.5 hover:border-slate-700 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <HardDrive className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">100% Local Storage</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Full message text, threads, and AI chats are stored locally in your own MySQL + Redis instances. AES-256-GCM encrypted credentials.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3.5 hover:border-slate-700 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <Download className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">On-Demand Attachments</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Bypasses heavy PDFs and ZIPs during sync to keep your DB tiny. Fetches files on-demand directly from the mail provider with disk caching.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* AI MODEL FREEDOM SECTION */}
        <section className="py-20 bg-[#070a12]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="p-8 sm:p-12 rounded-3xl bg-slate-900 border border-slate-800 space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
                <div className="space-y-2 max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Bring-Your-Own-Key (BYOK) Freedom</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                    Power Your Copilot with Any LLM
                  </h2>
                  <p className="text-sm text-slate-400">
                    No token markups or model lock-in. Switch providers in Settings or run 100% private models on your own GPU.
                  </p>
                </div>

                <Link
                  href="/docs"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                >
                  <span>Explore Model Docs</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="font-bold text-white block">NVIDIA NIM</span>
                  <p className="text-slate-400">High-throughput models: Nemotron 3.5, Llama 3.3 70B, Mixtral 8x22B.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="font-bold text-white block">OpenAI</span>
                  <p className="text-slate-400">GPT-4o and GPT-4o-mini with live model catalog discovery.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="font-bold text-white block">Anthropic Claude</span>
                  <p className="text-slate-400">Claude 3.5 Sonnet &amp; Haiku for nuanced email drafting.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="font-bold text-white block">Local LLM (Ollama)</span>
                  <p className="text-slate-400">Run completely offline on your own machine at localhost:11434.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 1-COMMAND QUICKSTART */}
        <section className="py-20 bg-[#090d16] border-t border-slate-800/80">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Deploy Mailr on Your VPS in 60 Seconds
            </h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Single command launch with Docker Compose. Nginx, MySQL, Redis, and Next.js bundled together.
            </p>

            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-left text-emerald-400 overflow-x-auto shadow-xl">
              <span className="text-slate-500"># Clone &amp; Launch</span>
              <br />
              git clone https://github.com/wellparth/mailr.git &amp;&amp; cd mailr
              <br />
              docker compose up --build -d
            </div>

            <div className="pt-2 flex items-center justify-center gap-4">
              <Link
                href="/docs"
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5"
              >
                <span>Read Full Setup &amp; Provider Guides &rarr;</span>
              </Link>
            </div>
          </div>
        </section>

        {/* CALL TO ACTION */}
        <section className="py-20 bg-gradient-to-b from-[#090d16] to-[#070a12] text-center border-t border-slate-800/80">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Ready to own your email client?
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
              Launch the client in your browser or self-host your own instance with Docker.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/app"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold text-sm shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all"
              >
                Launch Mailr App
              </Link>
              <Link
                href="/docs"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white font-semibold text-sm transition-colors"
              >
                Documentation
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
