import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Shield, Lock, EyeOff, Server, Database } from 'lucide-react';

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
              <span>Privacy & Security Commitments</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
              Privacy Policy & Data Security
            </h1>
            <p className="text-sm text-slate-400">
              Last modified: October 2026. Effective immediately across all Mailr client applications.
            </p>
          </div>

          <div className="space-y-8 text-sm text-slate-300 leading-relaxed">
            {/* Section 1 */}
            <section className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Lock className="w-4 h-4 text-emerald-400" />
                <h2>1. Zero-Knowledge Cryptographic Token Storage</h2>
              </div>
              <p>
                Mailr connects to third-party providers (Google, Microsoft, Apple, Yahoo, custom IMAP/SMTP servers) via OAuth 2.0 or secure protocols. We enforce military-grade <strong>AES-256-GCM authenticated encryption</strong> on all stored refresh tokens, access tokens, and mailbox passwords.
              </p>
              <p className="text-xs text-slate-400 font-mono bg-slate-950 p-3 rounded-lg border border-slate-800">
                Format: iv(12-byte hex) : authTag(16-byte hex) : ciphertext(hex)
              </p>
              <p>
                At no point are third-party credentials or API keys stored in plaintext in the database or server logs.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white">2. No AI Model Training on User Inboxes</h2>
              <p>
                We do not sell, rent, or monetize your email communications. Mailr will <strong>never use your email text, subject lines, attachments, or contact history to train foundational AI models</strong>.
              </p>
              <p>
                When you invoke natural language triage or calendar event extraction, prompts are processed via zero-retention enterprise endpoints or via your own Bring-Your-Own-Key (BYOK) API key.
              </p>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white">3. Google API Limited Use Disclosure</h2>
              <p>
                Mailr&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 underline"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white">4. Account Disconnection & Permanent Deletion</h2>
              <p>
                You retain complete sovereignty over your data. Disconnecting a mailbox from Mailr immediately:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-slate-400 text-xs">
                <li>Revokes the active OAuth connection with the upstream provider.</li>
                <li>Deletes the encrypted refresh tokens from the database.</li>
                <li>Purges cached email headers, snippets, and threads associated with that account.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white">5. GDPR & CCPA Compliance</h2>
              <p>
                Users residing in the European Economic Area (EEA) and California hold rights to access, rectify, export, or erase their stored account records upon request. Contact our Data Protection Officer at <code className="text-indigo-300">privacy@mailr.app</code>.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
