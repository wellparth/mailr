'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { Check, Sparkles, Zap, Shield, HelpCircle } from 'lucide-react';

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(true);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
              Simple, transparent pricing.
            </h1>
            <p className="text-lg text-slate-300">
              Pick the plan that fits your workflow. Start free, or supercharge your daily communication with AI superpowers.
            </p>

            {/* Toggle Switch */}
            <div className="flex items-center justify-center gap-3 pt-6">
              <span className={`text-sm font-medium ${!isYearly ? 'text-white' : 'text-slate-400'}`}>
                Monthly
              </span>
              <button
                type="button"
                onClick={() => setIsYearly(!isYearly)}
                className="relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-slate-800 transition-colors duration-200 ease-in-out focus:outline-none"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-indigo-500 shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isYearly ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-sm font-medium flex items-center gap-1.5 ${isYearly ? 'text-white' : 'text-slate-400'}`}>
                <span>Yearly</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Save 20%
                </span>
              </span>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Tier 1: Starter */}
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">Starter</h3>
                <p className="text-xs text-slate-400">
                  Essential unified email for individuals and freelancers.
                </p>
                <div className="text-3xl font-extrabold text-white">
                  $0{' '}
                  <span className="text-sm font-normal text-slate-400">/ forever</span>
                </div>

                <ul className="space-y-3 pt-4 text-xs text-slate-300">
                  {[
                    'Connect up to 2 email accounts',
                    'Unified inbox view with color badges',
                    'Standard IMAP, SMTP & Gmail/Outlook',
                    'Local full-text email search',
                    'AES-256-GCM token encryption',
                  ].map((feat) => (
                    <li key={feat} className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/app"
                className="w-full text-center py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm transition-colors"
              >
                Start for Free
              </Link>
            </div>

            {/* Tier 2: Pro Founder (Featured) */}
            <div className="relative p-8 rounded-3xl bg-slate-900 border-2 border-indigo-500/80 shadow-2xl shadow-indigo-950/60 flex flex-col justify-between space-y-6">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-[11px] font-bold tracking-wide uppercase shadow-md">
                Most Popular
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Pro Founder</h3>
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                </div>
                <p className="text-xs text-slate-300">
                  Full AI superpowers for professionals, founders, and creators.
                </p>
                <div className="text-3xl font-extrabold text-white">
                  ${isYearly ? '10' : '12'}{' '}
                  <span className="text-sm font-normal text-slate-400">/ month</span>
                </div>

                <ul className="space-y-3 pt-4 text-xs text-slate-200">
                  {[
                    'Unlimited connected email accounts',
                    'AI Natural Language Triage (Cmd+K)',
                    'Intelligent Priority Inbox Surfacing (P1-P4)',
                    'Smart Calendar Booking Proposals (.ics & sync)',
                    'AI Reply Draft Assistant',
                    'Bring-Your-Own-Key (OpenAI / Gemini / Anthropic)',
                    'Fast delta sync & real-time SSE push',
                  ].map((feat) => (
                    <li key={feat} className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/app"
                className="w-full text-center py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold text-sm shadow-lg shadow-indigo-500/30 hover:scale-[1.02] transition-transform"
              >
                Upgrade to Pro
              </Link>
            </div>

            {/* Tier 3: Business / Team */}
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">Team & Business</h3>
                <p className="text-xs text-slate-400">
                  For startups and small teams managing shared domains.
                </p>
                <div className="text-3xl font-extrabold text-white">
                  ${isYearly ? '24' : '29'}{' '}
                  <span className="text-sm font-normal text-slate-400">/ seat / month</span>
                </div>

                <ul className="space-y-3 pt-4 text-xs text-slate-300">
                  {[
                    'Everything in Pro Founder',
                    'Shared role-based domain inboxes (e.g. sales@)',
                    'Docker VPS self-hosting setup guide & support',
                    'Custom SMTP relay rate-limit management',
                    'Team member permission controls',
                    'Priority 24/7 technical support',
                  ].map((feat) => (
                    <li key={feat} className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/contact"
                className="w-full text-center py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm transition-colors"
              >
                Contact Enterprise
              </Link>
            </div>
          </div>

          {/* Pricing FAQ */}
          <div className="pt-12 border-t border-slate-800/80 max-w-3xl mx-auto space-y-6">
            <h3 className="text-2xl font-bold text-white text-center">Frequently Asked Questions</h3>
            <div className="space-y-4 text-sm">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <h4 className="font-semibold text-white">Can I bring my own OpenAI or Gemini API key?</h4>
                <p className="text-slate-400 mt-1 text-xs">
                  Yes! In the Settings panel, you can enter your personal API key. It is encrypted at rest using AES-256-GCM.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <h4 className="font-semibold text-white">Can I deploy Mailr on my own Docker VPS?</h4>
                <p className="text-slate-400 mt-1 text-xs">
                  Absolutely. Mailr includes complete Docker Compose configurations with MySQL, Redis, Next.js, and Nginx.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
