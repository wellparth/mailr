'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import {
  Check,
  Sparkles,
  Server,
  Shield,
  Database,
  Terminal,
  Cpu,
  ArrowRight,
  HardDrive,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { useState } from 'react';

export default function PricingPage() {
  const [copied, setCopied] = useState(false);

  const dockerComposeCode = `version: '3.8'

services:
  mailr-db:
    image: mysql:8.0
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: mailr_root_secret
      MYSQL_DATABASE: mailr_dev
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"

  mailr-redis:
    image: redis:7-alpine
    restart: always
    ports:
      - "6379:6379"

  mailr-backend:
    image: mailr/backend:latest
    restart: always
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: "mysql://root:mailr_root_secret@mailr-db:3306/mailr_dev"
      REDIS_URL: "redis://mailr-redis:6379"
      ENCRYPTION_KEY: "change_me_to_a_32_byte_secret_hex"
      JWT_SECRET: "change_me_to_a_random_jwt_secret"
    depends_on:
      - mailr-db
      - mailr-redis

  mailr-frontend:
    image: mailr/frontend:latest
    restart: always
    ports:
      - "3000:3000"
    depends_on:
      - mailr-backend

volumes:
  mysql_data:`;

  const copyDockerCode = () => {
    navigator.clipboard.writeText(dockerComposeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <Shield className="w-3.5 h-3.5" />
              <span>100% Free &amp; Open Source Software</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
              Self-Hostable. Zero Subscriptions.
            </h1>
            <p className="text-lg text-slate-300">
              Mailr is not a closed web SaaS email client. It is a self-hostable tool deployed directly on your own VPS or home server. All emails, message threads, and AI Copilot chats are stored locally in your database—giving you complete data sovereignty with zero privacy concerns.
            </p>
          </div>

          {/* Value Props Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white">Local VPS Storage</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                All message bodies, conversation threads, calendar proposals, and AI Copilot chats are saved directly to your local MySQL database and Redis cache. No remote cloud middleman ever stores or inspects your mail.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white">No Privacy Concerns</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Because you run the server yourself, there is zero third-party telemetry, no advertising trackers, and no risk of a commercial provider mining your private communications. You own 100% of your data.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white">Multi-Inbox &amp; BYOK AI</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Connect unlimited Google, Microsoft 365, Apple iCloud, and custom domain IMAP/SMTP accounts. Power 13 autonomous AI Copilot tools using your own API keys or local models (NVIDIA NIM, Ollama, OpenAI).
              </p>
            </div>
          </div>

          {/* Comparison Table: Self-Hosted Mailr vs SaaS Email Clients */}
          <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl">
            <div className="p-6 sm:p-8 border-b border-slate-800 bg-[#0c121e]">
              <h2 className="text-2xl font-bold text-white">
                Self-Hosted Mailr vs. Traditional SaaS Email Clients
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Why running on your own VPS beats closed cloud email services.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-4 px-6">Feature</th>
                    <th className="py-4 px-6 text-emerald-400 font-bold">Mailr (Self-Hosted)</th>
                    <th className="py-4 px-6 text-slate-400">Commercial SaaS Clients</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr>
                    <td className="py-4 px-6 font-medium text-white">Monthly Cost</td>
                    <td className="py-4 px-6 text-emerald-400 font-semibold">$0 / Free Forever</td>
                    <td className="py-4 px-6 text-slate-400">$15 – $30 / user / month</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium text-white">Data Storage</td>
                    <td className="py-4 px-6 text-emerald-400 font-semibold">Local VPS (MySQL + Redis)</td>
                    <td className="py-4 px-6 text-slate-400">Vendor&apos;s Multi-Tenant Cloud</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium text-white">Copilot Chat History</td>
                    <td className="py-4 px-6 text-emerald-400 font-semibold">Stored locally on your server</td>
                    <td className="py-4 px-6 text-slate-400">Stored on vendor&apos;s cloud or ephemeral</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium text-white">Privacy &amp; Telemetry</td>
                    <td className="py-4 px-6 text-emerald-400 font-semibold">100% Data Sovereignty, Zero Tracking</td>
                    <td className="py-4 px-6 text-slate-400">Usage tracking, analytics &amp; ad telemetry</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium text-white">Connected Inboxes</td>
                    <td className="py-4 px-6 text-emerald-400 font-semibold">Unlimited (Gmail, Outlook, IMAP, iCloud)</td>
                    <td className="py-4 px-6 text-slate-400">Capped (e.g. 2 accounts on starter)</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium text-white">AI Copilot Tooling</td>
                    <td className="py-4 px-6 text-emerald-400 font-semibold">13 Autonomous Tools (Triage, Drafts, Cal, Spam)</td>
                    <td className="py-4 px-6 text-slate-400">Basic chatbots or paid add-ons</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium text-white">AI Model Choice</td>
                    <td className="py-4 px-6 text-emerald-400 font-semibold">BYOK: NVIDIA NIM, OpenAI, Anthropic, Ollama</td>
                    <td className="py-4 px-6 text-slate-400">Locked to vendor&apos;s choice</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Deployment Guide */}
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-white font-bold text-xl">
                  <Terminal className="w-5 h-5 text-indigo-400" />
                  <h2>One-Command Docker Compose Deployment</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Run Mailr with MySQL and Redis on any Ubuntu/Debian VPS or home lab.
                </p>
              </div>

              <button
                type="button"
                onClick={copyDockerCode}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-400" />
                    <span>Copy docker-compose.yml</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
              {dockerComposeCode}
            </pre>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs text-slate-400">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                <strong className="text-white block mb-1">1. Minimum Specs</strong>
                1 vCPU, 1 GB RAM, 10 GB disk space on any cloud VPS (Hetzner, DigitalOcean, AWS, Linode).
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                <strong className="text-white block mb-1">2. Local Credentials</strong>
                AES-256-GCM encryption key stays strictly in your server environment variables.
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                <strong className="text-white block mb-1">3. Offline Ready</strong>
                Full database indexing ensures fast email searches and message viewing without remote latency.
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="text-center pt-8 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Ready to take control of your inboxes?
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/app"
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold text-sm shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all"
              >
                <span>Launch Mailr Client</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/about"
                className="px-8 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors"
              >
                Read Architectural Blueprint
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
