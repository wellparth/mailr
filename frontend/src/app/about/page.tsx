import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { Mail, Shield, Cpu, Layers, CheckCircle2, ArrowRight } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
              <Mail className="w-3.5 h-3.5" />
              <span>Our Mission & Architectural Philosophy</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
              Email should be provider agnostic.
            </h1>
            <p className="text-lg text-slate-300 leading-relaxed">
              Mailr was built on a simple premise: You shouldn&apos;t have to remember which provider hosts an address, nor should you have to juggle five different web apps just to check your mail.
            </p>
          </div>

          {/* Core Vision Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white">We are a Client, Not a Host</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Mailr is not an email provider. We don&apos;t host your MX records or lock you into a proprietary messaging silo. You keep your existing Google Workspace, Microsoft 365, or custom domain mailboxes. Mailr acts as the unified, AI-accelerated interface above them all.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white">Zero-Knowledge Token Security</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Privacy is not an afterthought. Sensitive OAuth refresh tokens and IMAP/SMTP passwords are encrypted with AES-256-GCM before entering our MySQL database. You can disconnect any mailbox at any time to purge cached data.
              </p>
            </div>
          </div>

          {/* Architectural Principles */}
          <div className="p-8 sm:p-12 rounded-3xl bg-slate-900 border border-slate-800 space-y-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white text-center">
              Our 4 Engineering Principles
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
              <div className="flex gap-4">
                <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white">1. Provider Adapter Architecture</h4>
                  <p className="text-slate-400 mt-1">
                    Instead of hard-coding provider quirks, Mailr uses a modular adapter layer that normalizes messages from Gmail API, MS Graph, and IMAP-Flow into a unified model.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white">2. AI as an Optional Superpower</h4>
                  <p className="text-slate-400 mt-1">
                    Core email must be rock solid, fast, and offline-capable without AI. AI features (triage, priority scoring, calendar detection) enhance the workflow without creating dependency.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white">3. Clear Identity Separation</h4>
                  <p className="text-slate-400 mt-1">
                    Every message in your unified inbox is color-coded with its originating account badge. Composing and replying automatically protects against cross-account identity leaks.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white">4. Self-Hostable & VPS Ready</h4>
                  <p className="text-slate-400 mt-1">
                    With Docker Compose, XAMPP local support, and Nginx reverse proxy configurations, teams and individuals can run Mailr on their own dedicated servers.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center pt-8">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-xl shadow-indigo-500/20 hover:scale-[1.02] transition-transform"
            >
              <span>Explore the Live App</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
