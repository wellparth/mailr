import Link from 'next/link';
import { Mail, Shield, Lock, Server } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-[#070a12] text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Bio */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg text-white">Mailr</span>
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed">
              The AI-powered multi-account email client. Provider agnostic, privacy-first, with zero-knowledge token encryption.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
              <Shield className="w-3.5 h-3.5" />
              <span>AES-256-GCM Encrypted Keys</span>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-4">
              Product
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/#features" className="hover:text-white transition-colors">
                  AI Triage Engine
                </Link>
              </li>
              <li>
                <Link href="/#priority" className="hover:text-white transition-colors">
                  Priority Inbox
                </Link>
              </li>
              <li>
                <Link href="/#calendar" className="hover:text-white transition-colors">
                  Calendar Proposals
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white transition-colors">
                  Pricing Plans
                </Link>
              </li>
              <li>
                <Link href="/app" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                  Launch Web App →
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-4">
              Company
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Contact Support
                </Link>
              </li>
              <li>
                <a href="#vps" className="hover:text-white transition-colors">
                  Docker VPS Docs
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Security */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-4">
              Security & Legal
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li className="text-slate-500 pt-2 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Zero-knowledge token storage</span>
              </li>
              <li className="text-slate-500 flex items-center gap-1.5">
                <Server className="w-3 h-3 text-slate-400" />
                <span>XAMPP & Docker VPS Ready</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} Mailr Inc. All rights reserved. Provider-agnostic email client.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-slate-400">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-400">
              Terms
            </Link>
            <Link href="/contact" className="hover:text-slate-400">
              Security
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
