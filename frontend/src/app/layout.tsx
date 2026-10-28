import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mailr — AI-Powered Multi-Account Email Client',
  description:
    'One client for every inbox you own. Provider-agnostic email with natural language triage, priority inbox, calendar proposals, and zero-knowledge encryption.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
