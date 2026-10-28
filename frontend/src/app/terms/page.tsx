import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
              Terms of Service
            </h1>
            <p className="text-sm text-slate-400">
              Effective as of October 2026.
            </p>
          </div>

          <div className="space-y-8 text-sm text-slate-300 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">1. Service Description</h2>
              <p>
                Mailr provides a unified, cross-platform email client interface enabling users to aggregate and manage third-party mail accounts (Google, Microsoft, IMAP/SMTP, and compatible services) through one application. Mailr is not an email hosting provider.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">2. Acceptable Use Policy</h2>
              <p>
                You agree not to use Mailr to transmit unsolicited bulk emails (spam), phish, distribute malicious attachments, or violate the terms of service of any connected upstream mail provider.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">3. Third-Party Provider Terms</h2>
              <p>
                By connecting an account from Google, Microsoft, or any other provider, you remain subject to that provider&apos;s independent acceptable use policies, rate limits, and authentication protocols.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">4. Self-Hosting & Docker VPS Deployment</h2>
              <p>
                Users utilizing self-hosted Docker VPS deployments are solely responsible for securing server keys, maintaining SSL/TLS certificates, running database backups, and updating Docker container dependencies.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white">5. Termination</h2>
              <p>
                You may terminate your Mailr account at any time by deleting your account profile and connected mailboxes in the application settings.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
