# Mailr — Implemented Features & Technical Status

> **Current Milestone**: Core Engine & Real-Time Live Sync Complete  
> **Last Updated**: 2026-10-28  
> **Active Branches**: `main` (Production), `develop` (Staging/Integration)  
> **Remote Repository**: [https://github.com/wellparth/mailr.git](https://github.com/wellparth/mailr.git)

---

## 1. Executive Summary of What Is Working

Mailr is a provider-agnostic, modern email client designed for high-speed triage, privacy-first credential encryption, and multi-inbox consolidation. The application is completely functional end-to-end for local development with Next.js 14, Node/Express, and MySQL (`mailr_dev`).

---

## 2. Frontend Architecture (Next.js 14 App Router)

* **Design System & UI**:
  * Built with **Tailwind CSS** and **shadcn/ui** components.
  * Native dark mode aesthetic with consistent slate/zinc neutral tones, high-contrast borders, and accessibility standards.
  * Global design skills installed: `ui-ux-pro-max`, `design-taste-frontend`, and `next-skills`.

* **Two-Tier Sidebar Layout (`sidebar-09`)**:
  * **56px Icon Rail**:
    * Mailr brand home icon.
    * 1-click **Compose** button.
    * Navigation icons for **Inbox**, **Priority**, **Starred**, **Sent**, **Drafts**, and **Trash** with live dynamic unread badges.
    * Direct account-switching circular avatars for connected inboxes.
    * Quick "Add Account" shortcut.
    * User profile avatar with dropdown menu (Settings, Connect Email, Compose with Images, Sign Out).
  * **320px High-Speed Drawer**:
    * Account scope dropdown: switch between **Unified Inbox** (all accounts) and individual accounts.
    * **Sync Now** manual trigger button with a rotating `RefreshCw` spinner.
    * **Unreads** filter switch toggle.
    * Real-time search omnibar (instant filtering across sender, subject, and snippet).
    * **AI Natural Language Triage Omnibar** with quick suggestion chips (Urgent Actions, Meeting Invites, Financial & Invoices).
    * Dynamic thread card list displaying sender, relative timestamp, subject, snippet preview, paperclip attachment indicator, and priority badge (`URGENT`, `HIGH`, `NORMAL`, `LOW`).

* **Reading & Action Detail Pane (`MailDisplay`)**:
  * **Zero-Account Onboarding State**: Prominently guides users when 0 accounts are connected, explaining privacy, multi-account consolidation, and instant setup.
  * **Thread Header**: Subject title, star/unstar toggle, archive button, trash button, and account attribution badge.
  * **AI Priority Banner**: Displays urgency score (e.g. 95/100) and actionable reasoning (e.g., *"Contains high-urgency keywords or immediate action deadline"*).
  * **AI Calendar Proposal Card**: Detects meeting dates, times, and attendees from message text with 1-click RFC 5545 `.ics` file download.
  * **Multi-Image Lightbox Gallery**: Previews embedded and attached images with zoom and download capabilities.
  * **AI Draft Reply Generator**: Pre-populates response drafts tailored to thread context.

* **Modal Dialogs & Wizards**:
  * **`ComposeDialog`**:
    * Multi-identity `From:` selector switching between connected accounts.
    * Drag-and-drop multi-image attachment tray with thumbnail previews, file size indicators, and one-click removal.
  * **`ConnectAccountDialog`**:
    * Dedicated provider selection: Google, Microsoft 365, IMAP/SMTP, iCloud, Yahoo, Zoho, Fastmail, Proton Bridge.
    * Automated IMAP/SMTP discovery based on entered domain.
  * **`OnboardingWizard`**: 3-step interactive setup wizard triggered when a user registers or has zero active accounts.
  * **`SettingsDialog`**: Zero-knowledge encryption documentation, security audit info, and active account count.

* **Public Marketing & Legal Pages**:
  * `/` — Landing page with hero section, feature showcase, and CTA.
  * `/about` — Mailr mission, open-core philosophy, and architecture.
  * `/pricing` — Transparent tier comparison table.
  * `/contact` — Contact and feedback submission.
  * `/privacy` — Privacy policy highlighting zero-knowledge credential handling.
  * `/terms` — Terms of service.
  * `/login` & `/register` — Authentication forms with single-line styled dividers and OAuth buttons.

---

## 3. Backend Architecture (Node.js + Express + TypeScript)

* **Database & ORM**:
  * MySQL 8 / MariaDB (XAMPP `127.0.0.1:3306/mailr_dev`).
  * Managed through **Prisma ORM** with relational schema (`users`, `email_accounts`, `folders`, `threads`, `messages`, `attachments`, `calendar_proposals`, `ai_triage_logs`).

* **Security & Zero-Knowledge Encryption**:
  * **AES-256-GCM** authenticated cipher with random 12-byte IV and 16-byte authentication tags.
  * Passwords, IMAP credentials, and OAuth tokens are never stored in plain text at rest.
  * JWT authentication with 7-day expiration supporting both HTTP `Bearer` headers and query string tokens.

* **Live IMAP/SMTP Engine**:
  * Integrated **`imapflow`** and **`mailparser`** (`simpleParser`).
  * Queries remote mailboxes over TLS/STARTTLS within an intelligent date cutoff (`SINCE`).
  * Converts raw RFC 822 MIME streams into sender metadata, recipient lists (`to`, `cc`, `bcc`), formatted HTML/text, snippets, and base64 attachments.

* **Auto Ingestion & Sync Pipeline (`SyncService`)**:
  * Message & thread deduplication.
  * AI urgency classification and priority scoring.
  * Meeting intent extraction and calendar proposal generation.
  * Background synchronization loop running every 3 minutes.

* **Real-Time Live Streaming (Server-Sent Events - SSE)**:
  * `GET /api/accounts/events`: Delivers instant notifications (`SYNC_COMPLETE`, `EMAIL_SAVED`) to connected browsers without manual polling.
  * 25-second heartbeat ping preventing proxy dropouts.

* **Endpoints Summary**:
  * **Auth**: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/auth/google/url`, `GET /api/auth/google/callback`, `GET /api/auth/microsoft/url`, `GET /api/auth/microsoft/callback`.
  * **Accounts**: `GET /api/accounts`, `POST /api/accounts/discover`, `POST /api/accounts/connect/imap-smtp`, `POST /api/accounts/connect/oauth`, `DELETE /api/accounts/:id`, `POST /api/accounts/:id/sync`, `POST /api/accounts/sync`, `GET /api/accounts/events`.
  * **Messages**: `GET /api/messages`, `GET /api/messages/thread/:id`, `PATCH /api/messages/thread/:id/star`, `PATCH /api/messages/thread/:id/archive`, `DELETE /api/messages/thread/:id`, `POST /api/messages/send`.
  * **AI**: `POST /api/ai/triage`, `POST /api/ai/suggest-reply`.
  * **System**: `GET /api/health`.

---

## 4. Git & GitHub Repository Status

* **Remote Repository**: `https://github.com/wellparth/mailr.git`
* **Clean Monorepo**: Strictly tracks `frontend/`, `backend/`, `nginx/`, `docker-compose.yml`, `README.md`, `project_plan.md`, `IMPLEMENTED.md`, and `ROADMAP.md`. All build artifacts (`.next/`, `dist/`), logs, and secrets (`.env`) are excluded.
* **Merged Pull Requests**:
  1. **PR #1 (`feat/imap-live-sync`)**: Live IMAP message fetching with mailparser and auto sync engine.
  2. **PR #2 (`feat/sse-live-sync-events`)**: SSE real-time sync stream, background worker, and manual sync UI.
* Both `main` and `develop` branches are up-to-date and cleanly synchronized.
