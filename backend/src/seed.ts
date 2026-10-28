import bcrypt from 'bcryptjs';
import prisma from './db.js';
import { ProviderType, PriorityLevel, ProposalStatus } from '@prisma/client';
import { encryptSecret } from './utils/crypto.js';

async function seed() {
  console.log('🌱 Seeding Mailr database with multi-account demo data...');

  const demoEmail = 'alex@mailr.app';
  const passwordHash = await bcrypt.hash('password123', 10);
  const encryptedAiKey = encryptSecret('sk-demo-openai-encrypted-key-sample');

  // Upsert user
  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      name: 'Alex Gorde',
      passwordHash,
      aiProvider: 'openai',
      encryptedAiKey,
    },
  });

  console.log(`👤 User ready: ${user.email} (Password: password123)`);

  // Account 1: Google Workspace
  const acmeAccount = await prisma.emailAccount.upsert({
    where: {
      userId_emailAddress: {
        userId: user.id,
        emailAddress: 'alex@acme-corp.com',
      },
    },
    update: {},
    create: {
      userId: user.id,
      provider: ProviderType.GMAIL,
      emailAddress: 'alex@acme-corp.com',
      displayName: 'Alex (Acme Corp)',
      colorCode: '#2563eb', // Blue
      syncStatus: 'IDLE',
      lastSyncedAt: new Date(),
    },
  });

  // Account 2: Personal Gmail
  const personalAccount = await prisma.emailAccount.upsert({
    where: {
      userId_emailAddress: {
        userId: user.id,
        emailAddress: 'alex.personal@gmail.com',
      },
    },
    update: {},
    create: {
      userId: user.id,
      provider: ProviderType.GMAIL,
      emailAddress: 'alex.personal@gmail.com',
      displayName: 'Alex (Personal)',
      colorCode: '#059669', // Emerald
      syncStatus: 'IDLE',
      lastSyncedAt: new Date(),
    },
  });

  // Account 3: Custom Domain IMAP / SMTP
  const startupAccount = await prisma.emailAccount.upsert({
    where: {
      userId_emailAddress: {
        userId: user.id,
        emailAddress: 'founder@startuplab.io',
      },
    },
    update: {},
    create: {
      userId: user.id,
      provider: ProviderType.IMAP_SMTP,
      emailAddress: 'founder@startuplab.io',
      displayName: 'Founder (StartupLab)',
      colorCode: '#7c3aed', // Purple
      imapHost: 'mail.startuplab.io',
      imapPort: 993,
      imapSecure: true,
      smtpHost: 'mail.startuplab.io',
      smtpPort: 587,
      smtpSecure: false,
      encryptedCredentials: encryptSecret(JSON.stringify({ password: 'samplePassword123' })),
      syncStatus: 'IDLE',
      lastSyncedAt: new Date(),
    },
  });

  console.log('📫 3 Connected Accounts created (Google Workspace, Personal Gmail, Custom IMAP).');

  // Thread 1: Urgent Term Sheet on Acme Corp
  const thread1 = await prisma.thread.create({
    data: {
      accountId: acmeAccount.id,
      remoteThreadId: 'th_001',
      subject: 'URGENT: Signed Term Sheet & Legal Review required by 5 PM',
      snippet: 'Hi Alex, please find attached the revised Series-A term sheet. The lead investors need your counter-signature before 5:00 PM EST today.',
      priorityScore: 98,
      priorityLevel: PriorityLevel.URGENT,
      priorityReason: 'Impending hard deadline today from lead legal counsel regarding financing.',
      isStarred: true,
      lastMessageAt: new Date(Date.now() - 15 * 60 * 1000), // 15 mins ago
      messages: {
        create: {
          accountId: acmeAccount.id,
          remoteMessageId: 'msg_001',
          senderName: 'Elena Rostova',
          senderEmail: 'elena@vcfund.com',
          recipientList: ['alex@acme-corp.com'],
          subject: 'URGENT: Signed Term Sheet & Legal Review required by 5 PM',
          snippet: 'Hi Alex, please find attached the revised Series-A term sheet. The lead investors need your counter-signature before 5:00 PM EST today.',
          bodyHtml: `<p>Hi Alex,</p><p>Please find attached the revised <strong>Series-A Term Sheet</strong> reflecting the valuation adjustments we agreed on yesterday.</p><p style="color:#b91c1c; font-weight:bold;">Action Required: The partners require your counter-signature by 5:00 PM EST today to finalize board allocation.</p><p>Best regards,<br/>Elena Rostova<br/>Partner, Sequoia Horizon Capital</p>`,
          bodyText: `Hi Alex,\n\nPlease find attached the revised Series-A Term Sheet reflecting the valuation adjustments we agreed on yesterday.\n\nAction Required: The partners require your counter-signature by 5:00 PM EST today to finalize board allocation.\n\nBest regards,\nElena Rostova\nPartner, Sequoia Horizon Capital`,
          isRead: false,
          isFlagged: true,
          hasAttachments: true,
          receivedAt: new Date(Date.now() - 15 * 60 * 1000),
        },
      },
    },
  });

  // Thread 2: Calendar Proposal on Custom Domain IMAP
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(15, 0, 0, 0);
  const endTomorrow = new Date(tomorrow.getTime() + 30 * 60 * 1000);

  const thread2 = await prisma.thread.create({
    data: {
      accountId: startupAccount.id,
      remoteThreadId: 'th_002',
      subject: 'Quick Sync: Discuss Mailr Product Architecture & VPS Launch',
      snippet: 'Are you available tomorrow at 3:00 PM for a 30-minute sync to review the Express backend and Docker VPS setup?',
      priorityScore: 82,
      priorityLevel: PriorityLevel.HIGH,
      priorityReason: 'Direct meeting proposal with specific proposed time slot from key technical partner.',
      lastMessageAt: new Date(Date.now() - 45 * 60 * 1000),
      messages: {
        create: {
          accountId: startupAccount.id,
          remoteMessageId: 'msg_002',
          senderName: 'David Chen',
          senderEmail: 'david@engineers.dev',
          recipientList: ['founder@startuplab.io'],
          subject: 'Quick Sync: Discuss Mailr Product Architecture & VPS Launch',
          snippet: 'Are you available tomorrow at 3:00 PM for a 30-minute sync to review the Express backend and Docker VPS setup?',
          bodyHtml: `<p>Hey Alex,</p><p>I have gone through the Next.js frontend and Express backend specs for Mailr. It looks rock solid.</p><p><strong>Are you available tomorrow at 3:00 PM for a 30-minute sync?</strong> We can quickly align on the Docker VPS deployment and MySQL XAMPP replication before opening it to beta users.</p><p>Cheers,<br/>David</p>`,
          bodyText: `Hey Alex,\n\nI have gone through the Next.js frontend and Express backend specs for Mailr. It looks rock solid.\n\nAre you available tomorrow at 3:00 PM for a 30-minute sync? We can quickly align on the Docker VPS deployment and MySQL XAMPP replication before opening it to beta users.\n\nCheers,\nDavid`,
          isRead: false,
          receivedAt: new Date(Date.now() - 45 * 60 * 1000),
          calendarProposals: {
            create: {
              userId: user.id,
              title: 'Quick Sync: Mailr Product Architecture & VPS Launch',
              description: 'Review Next.js frontend, Express API, and Docker VPS deployment with David Chen.',
              startTime: tomorrow,
              endTime: endTomorrow,
              timezone: 'Asia/Kolkata',
              attendees: [{ email: 'david@engineers.dev', name: 'David Chen' }, { email: 'founder@startuplab.io', name: 'Alex Gorde' }],
              status: ProposalStatus.PROPOSED,
            },
          },
        },
      },
    },
  });

  // Thread 3: Invoice on Personal Account
  const thread3 = await prisma.thread.create({
    data: {
      accountId: personalAccount.id,
      remoteThreadId: 'th_003',
      subject: 'Invoice #INV-2026-904 from Cloudflare Inc',
      snippet: 'Your monthly invoice for Cloudflare Pro Plan ($20.00 USD) has been processed. Thank you for your business.',
      priorityScore: 72,
      priorityLevel: PriorityLevel.HIGH,
      priorityReason: 'Receipt / Invoice confirmation for cloud infrastructure billing.',
      lastMessageAt: new Date(Date.now() - 3 * 3600 * 1000),
      messages: {
        create: {
          accountId: personalAccount.id,
          remoteMessageId: 'msg_003',
          senderName: 'Cloudflare Billing',
          senderEmail: 'billing@cloudflare.com',
          recipientList: ['alex.personal@gmail.com'],
          subject: 'Invoice #INV-2026-904 from Cloudflare Inc',
          snippet: 'Your monthly invoice for Cloudflare Pro Plan ($20.00 USD) has been processed. Thank you for your business.',
          bodyHtml: `<p>Hello Alex,</p><p>This is a confirmation that your payment of <strong>$20.00 USD</strong> for invoice <strong>#INV-2026-904</strong> was successfully processed.</p><p>Thank you for choosing Cloudflare!</p>`,
          bodyText: `Hello Alex,\n\nThis is a confirmation that your payment of $20.00 USD for invoice #INV-2026-904 was successfully processed.\n\nThank you for choosing Cloudflare!`,
          isRead: true,
          hasAttachments: true,
          receivedAt: new Date(Date.now() - 3 * 3600 * 1000),
        },
      },
    },
  });

  // Thread 4: Low Priority Newsletter
  const thread4 = await prisma.thread.create({
    data: {
      accountId: acmeAccount.id,
      remoteThreadId: 'th_004',
      subject: 'The Modern Web Digest: Next.js 15 & AI Engineering Trends',
      snippet: 'Welcome to issue #84 of Modern Web Digest! Today we explore React Server Components, Turbopack, and local LLM execution patterns.',
      priorityScore: 22,
      priorityLevel: PriorityLevel.LOW,
      priorityReason: 'Automated newsletter with marketing and tutorial links.',
      lastMessageAt: new Date(Date.now() - 8 * 3600 * 1000),
      messages: {
        create: {
          accountId: acmeAccount.id,
          remoteMessageId: 'msg_004',
          senderName: 'Modern Web Digest',
          senderEmail: 'newsletter@modernweb.dev',
          recipientList: ['alex@acme-corp.com'],
          subject: 'The Modern Web Digest: Next.js 15 & AI Engineering Trends',
          snippet: 'Welcome to issue #84 of Modern Web Digest! Today we explore React Server Components, Turbopack, and local LLM execution patterns.',
          bodyHtml: `<h3>Modern Web Digest #84</h3><p>In this edition, we dive into full-stack agentic coding, database connection pooling with MySQL, and responsive multi-account interfaces.</p><p><small><a href="#unsubscribe">Unsubscribe from this newsletter</a></small></p>`,
          bodyText: `Modern Web Digest #84\n\nIn this edition, we dive into full-stack agentic coding, database connection pooling with MySQL, and responsive multi-account interfaces.\n\nUnsubscribe from this newsletter`,
          isRead: true,
          receivedAt: new Date(Date.now() - 8 * 3600 * 1000),
        },
      },
    },
  });

  console.log(`✅ Seeded 4 threads and messages across 3 accounts (User: ${demoEmail}).`);
}

seed()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
