# Mailr — AI-Powered Multi-Account Email Client

An AI-powered, multi-account email client built for high productivity, privacy, and speed. Natural language instructions triage recent messages, surface only priority emails, propose calendar bookings with `.ics` export, and protect all credentials with zero-knowledge AES-256-GCM encryption.

---

## ⚡ Architecture Overview

```text
mailr/
├── frontend/             # Next.js 14 App Router, Tailwind CSS, shadcn sidebar-09
│   ├── src/app/          # Landing, marketing pages, auth, and main client app
│   ├── src/components/   # Modular UI primitives, sidebar, reading pane, modals
│   └── Dockerfile
├── backend/              # Node.js + Express (TypeScript), Prisma ORM
│   ├── src/adapters/     # Gmail, Outlook, and Generic IMAP/SMTP adapters
│   ├── src/services/     # AI triage, priority scoring, calendar detection, SSE sync
│   ├── src/utils/        # AES-256-GCM cryptographic encryption utilities
│   ├── prisma/           # Database schema & migrations for MySQL
│   └── Dockerfile
├── nginx/                # Production reverse proxy configuration
│   └── nginx.conf
├── docker-compose.yml    # 1-Command production VPS container orchestration
├── .env.example          # Environment configuration template
└── README.md
```

---

## ✨ Features

- **Multi-Account & Provider Agnostic**:
  - Connect unlimited Google Mail, Microsoft Outlook, iCloud, Yahoo, Zoho, Fastmail, Proton, or custom IMAP/SMTP inboxes.
  - Live connection handshake tester validates IMAP/SMTP ports & TLS before saving.
  - Unified inbox view or isolate individual accounts via color-coded badges.

- **shadcn `sidebar-09` Interface**:
  - Primary 56px icon rail: Quick Compose (`+`), direct account switching avatars, core folders (`Inbox`, `Priority AI`, `Starred`, `Sent`, `Drafts`, `Trash`), and user profile menu.
  - Secondary 320px drawer: Account selector, Unreads toggle, real-time search, and AI natural language triage omnibar.
  - Reading pane: Clean email typography, zero-knowledge encryption badge, meeting detection widget, and smart reply composer.

- **AI Natural Language Triage**:
  - Run natural language queries like *"Surface urgent client action items and deadlines"* to triage your messages in real time.
  - Automatic priority scoring (0–100) with explainable AI reasoning tags.

- **Calendar Proposal Detection & `.ics` Export**:
  - Automatically identifies proposed meetings, schedules, and participants from email threads.
  - 1-click **Export `.ics`** downloads RFC 5545 calendar files directly importable into Apple Calendar, Google Calendar, or Outlook.

- **Multi-Image & File Attachments**:
  - Drag-and-drop or select multiple images (PNG, JPG, WebP, GIF, SVG) with instant thumbnail previews and file size indicators.
  - In-email Image Gallery with click-to-zoom Lightbox modal and download actions.

- **Zero-Knowledge AES-256-GCM Encryption**:
  - OAuth tokens, refresh tokens, and IMAP/SMTP secrets are encrypted at rest using an authenticated 256-bit AES-GCM cipher with unique 96-bit IVs.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js**: `v18+` or `v20+`
- **Database**: MySQL (e.g. from local **XAMPP** on `127.0.0.1:3306`)

### 2. Database Setup
1. Start MySQL from XAMPP Control Panel.
2. Create the database:
   ```sql
   CREATE DATABASE mailr_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

### 3. Backend Setup
```bash
cd backend
npm install
npx prisma db push
npm run dev
```
Backend runs on `http://localhost:5000`. Health check: `http://localhost:5000/api/health`.

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:3000`. Open `http://localhost:3000/app` to launch the client.

---

## 🔐 Environment Variables

Copy `.env.example` to `backend/.env`:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL="mysql://root:@127.0.0.1:3306/mailr_dev"
ENCRYPTION_MASTER_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
JWT_SECRET=super_secret_jwt_mailr_dev_key_2026_xyz
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000

# Optional: Google OAuth 2.0 Credentials (from Google Cloud Console)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

# Optional: Microsoft Outlook OAuth 2.0 Credentials (from Azure Portal)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=http://localhost:5000/api/auth/microsoft/callback
```

---

## 🐳 Production VPS Deployment (Docker Compose)

Deploy the entire stack (Frontend + Backend + MySQL + Nginx) with a single command on your VPS:

```bash
docker compose up --build -d
```

Nginx automatically routes traffic:
- `http://your-server/` → Next.js Frontend
- `http://your-server/api/` → Express Backend API

---

## 📄 License
MIT License. Built for performance and privacy.
