# Mailr — Product Roadmap & Upcoming Features

> **Strategic Objective**: Transform the working core engine into a full-fledged, multi-tenant SaaS web application with a single-codebase dual deployment model (**Hosted Cloud SaaS** vs. **Community Self-Hosted**).  
> **Last Updated**: 2026-10-28

---

## 1. Architectural Strategy: Single Codebase Dual-Deployment

Rather than maintaining two distinct codebases (which causes maintenance overhead and code drift), Mailr uses an environment flag:

```env
DEPLOYMENT_MODE="cloud"        # or "self_hosted"
```

| Dimension | Hosted Cloud SaaS (`DEPLOYMENT_MODE="cloud"`) | Self-Hosted Instance (`DEPLOYMENT_MODE="self_hosted"`) |
| :--- | :--- | :--- |
| **Monetization** | Stripe subscription tiers (Free, Pro at $15/mo) | Completely free & unlocked |
| **Account Limit** | Free: 2 accounts; Pro: Unlimited | Unlimited accounts |
| **AI Features** | Managed credits / Central API key | Bring-Your-Own-Key (BYOK) for OpenAI/Anthropic/Gemini |
| **Attachment Storage** | Cloudflare R2 / AWS S3 storage with quotas | Local VPS Docker volume (`/uploads`) |
| **UI Display** | "Upgrade to Pro" banner & Billing portal | "Self-Hosted Community Edition" badge |

---

## 2. Priority Feature Tracks (`feat/*`)

### Phase 1: SaaS Monetization & Deployment Mode Gates
- [ ] **Branch: `feat/billing-stripe-subscriptions`**
  - **Prisma Schema Update**:
    - Add `subscriptionTier` enum (`FREE`, `PRO`, `ENTERPRISE`) to `User`.
    - Add `stripeCustomerId`, `stripeSubscriptionId`, and `subscriptionStatus` (`ACTIVE`, `PAST_DUE`, `CANCELED`).
  - **Stripe Integration**:
    - Install `stripe` SDK on the backend.
    - Implement `POST /api/billing/create-checkout-session` for subscription upgrades.
    - Implement `POST /api/billing/create-portal-session` for payment method updates and invoice history.
    - Implement `POST /api/billing/webhook` with signature verification for `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.
  - **Frontend Pricing & Billing Flow**:
    - Wire `/pricing` tier CTA buttons to initiate checkout for authenticated users.
    - Add a Billing tab in `SettingsDialog` showing current plan, renewal date, and "Manage Subscription" button.

- [ ] **Branch: `feat/deployment-mode-toggle`**
  - Create `backend/src/utils/featureGates.ts`:
    - Helper `isSelfHosted()`: checks `process.env.DEPLOYMENT_MODE === 'self_hosted'`.
    - Helper `canAddAccount(user, currentCount)`: returns `true` if self-hosted or user is `PRO`; restricts free users to 2 accounts.
    - Helper `canUseAI(user)`: enforces monthly triage token quotas in cloud mode; returns `true` in self-hosted mode.
  - Expose `GET /api/system/config` so the frontend knows whether to render billing buttons or the self-hosted badge.

---

### Phase 2: Outbound Email Dispatch & Image Handling
- [ ] **Branch: `feat/outbound-email-dispatch`**
  - Implement full outbound sending in `backend/src/services/mailSendService.ts`:
    - **IMAP/SMTP**: Dispatch via Nodemailer using encrypted SMTP credentials.
    - **Google Workspace / Gmail**: Dispatch via Gmail API (`messages.send`).
    - **Microsoft 365 / Outlook**: Dispatch via Microsoft Graph API (`/me/sendMail`).
  - **Multi-Image Attachment Delivery**:
    - Process image attachments from `ComposeDialog` as standard MIME `multipart/mixed` and inline `multipart/related`.
    - Save sent messages directly to the `SENT` folder in the database and local IMAP folder.

---

### Phase 3: OAuth Verification & Enterprise Identity
- [ ] **Branch: `feat/oauth-google-microsoft-live`**
  - Configure production Google Cloud OAuth consent screen (scopes: `https://mail.google.com/`, `https://www.googleapis.com/auth/calendar.events`).
  - Configure Azure AD app registration (scopes: `Mail.ReadWrite`, `Mail.Send`, `offline_access`).
  - Implement automatic token refresh rotation with background refresh token decryption and re-encryption.

---

### Phase 4: User Experience, Signatures & BYOK
- [ ] **Branch: `feat/user-settings-signatures-byok`**
  - **Rich Signatures**: Add HTML/plain-text signature configuration per connected inbox, automatically appended when opening `ComposeDialog`.
  - **User Profile Management**: Allow users to update their display name, avatar image, and password.
  - **BYOK (Bring Your Own Key)**:
    - Settings UI allowing self-hosted users (and cloud power users) to enter their own OpenAI, Anthropic, or Gemini API keys.
    - Keys are encrypted with AES-256-GCM before saving to `users.encrypted_ai_key`.

---

### Phase 5: Cloud Storage & Infrastructure Hardening
- [ ] **Branch: `feat/cloud-s3-storage`**
  - Multi-provider attachment storage adapter:
    - `LocalStorageAdapter`: saves files to local disk/volume (default for self-hosters).
    - `S3StorageAdapter`: saves files to Cloudflare R2 / AWS S3 with signed URLs (for cloud SaaS).
- [ ] **Branch: `feat/security-hardening`**
  - Implement `express-rate-limit` on `/api/auth/*` (brute-force defense) and `/api/ai/*` (token quota defense).
  - Password reset flow with time-expiring HMAC signed tokens.
  - Production Docker Compose verification with Nginx reverse proxy and automated Let's Encrypt SSL certificates.

---

## 3. Bug Fixes & Refinements Tracker (`bug/*`)

- [ ] **Branch: `bug/dev-build-cache-cleanup`**
  - Add an npm script `clean:build` to purge `.next` and `dist` before rebuilding to prevent stale chunk errors during hot-reloads.
- [ ] **Branch: `bug/imap-reconnect-backoff`**
  - Add exponential backoff retry logic to `ImapSmtpAdapter` so transient network glitches or server resets don't flag accounts with `ERROR` status prematurely.

---

## 4. Immediate Next Step Decision

| Proposed Next Branch | Value | Complexity |
| :--- | :--- | :--- |
| **`feat/billing-stripe-subscriptions`** | Enables direct SaaS revenue, tier limits, and Stripe webhooks | Medium |
| **`feat/outbound-email-dispatch`** | Enables actual email sending with multi-image attachments | Low-Medium |
| **`feat/deployment-mode-toggle`** | Formalizes Cloud vs Self-Hosted feature gates | Low |
