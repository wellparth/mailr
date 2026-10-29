import prisma from '../db.js';
import { AIService } from './aiService.js';
import { ProposalStatus } from '@prisma/client';
import { LLMClient, AIProvider } from './llmClient.js';
import { decryptSecret } from '../utils/crypto.js';

export interface ActionItem {
  task: string;
  assignee?: string;
  deadline?: string;
  completed?: boolean;
}

export interface ThreadNotesResult {
  id: string;
  threadId: string;
  title: string;
  summary: string;
  actionItems: ActionItem[];
  keyDecisions: string[];
  rawMarkdown: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MeetingScheduleResult {
  proposalId: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  attendees: { email: string; name?: string }[];
  googleCalendarUrl: string;
  outlookCalendarUrl: string;
  office365CalendarUrl: string;
  icsDownloadUrl: string;
  calComUrl?: string;
  calendlyUrl?: string;
}

export class AgentService {
  /**
   * Resolve user BYOK credentials (OpenAI, Claude, Google Gemini, or Nvidia NIM)
   */
  static async getUserAIConfig(userId: string): Promise<{ provider: AIProvider; apiKey?: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiProvider: true, encryptedAiKey: true },
    });

    const rawProvider = (user?.aiProvider || 'openai').toLowerCase();
    const provider: AIProvider =
      rawProvider === 'claude' || rawProvider === 'google' || rawProvider === 'nvidia'
        ? rawProvider
        : 'openai';

    const apiKey = user?.encryptedAiKey ? decryptSecret(user.encryptedAiKey) : undefined;
    return { provider, apiKey };
  }

  /**
   * Synthesize a long email conversation into executive notes, action items, and key decisions.
   */
  static async generateThreadNotes(userId: string, threadId: string): Promise<ThreadNotesResult> {
    const thread = await prisma.thread.findFirst({
      where: { id: threadId, account: { userId } },
      include: {
        messages: {
          orderBy: { receivedAt: 'asc' },
          select: {
            id: true,
            senderName: true,
            senderEmail: true,
            subject: true,
            bodyText: true,
            snippet: true,
            receivedAt: true,
          },
        },
      },
    });

    if (!thread || thread.messages.length === 0) {
      throw new Error('Thread not found or has no messages to summarize.');
    }

    const messages = thread.messages;
    const cleanSubject = thread.subject.replace(/^(re:\s*|fwd:\s*)/i, '').trim();

    // Aggregate text
    const fullText = messages
      .map((m) => `[${m.senderName || m.senderEmail} at ${new Date(m.receivedAt).toLocaleString()}]: ${m.bodyText || m.snippet || ''}`)
      .join('\n\n');

    // Extract participants
    const participants = Array.from(new Set(messages.map((m) => m.senderName || m.senderEmail)));

    // Smart heuristic extraction of action items
    const actionItems: ActionItem[] = [];
    const lines = fullText.split('\n');

    lines.forEach((line) => {
      const lower = line.toLowerCase();
      if (
        lower.includes('please') ||
        lower.includes('will send') ||
        lower.includes('can you') ||
        lower.includes('action item') ||
        lower.includes('deadline') ||
        lower.includes('todo') ||
        lower.includes('by tomorrow') ||
        lower.includes('by friday') ||
        lower.includes('next steps') ||
        lower.includes('follow up')
      ) {
        const cleaned = line.replace(/^[-*•\d.]+\s*/, '').trim();
        if (cleaned.length > 10 && cleaned.length < 160 && !actionItems.some((a) => a.task === cleaned)) {
          // Detect deadline if mentioned
          let deadline: string | undefined;
          const deadlineMatch = cleaned.match(/(?:by|before|on)\s+([a-zA-Z]+(?:\s+\d{1,2})?|\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
          if (deadlineMatch) {
            deadline = deadlineMatch[0];
          }

          actionItems.push({
            task: cleaned,
            assignee: participants[0] || 'Unassigned',
            deadline,
            completed: false,
          });
        }
      }
    });

    // Default fallback action item if none detected
    if (actionItems.length === 0) {
      actionItems.push({
        task: `Review thread details and reply to ${participants[participants.length - 1] || 'sender'}`,
        assignee: 'You',
        deadline: 'Within 24 hours',
        completed: false,
      });
    }

    // Key decisions extraction
    const keyDecisions: string[] = [];
    if (fullText.toLowerCase().includes('agree') || fullText.toLowerCase().includes('confirmed')) {
      keyDecisions.push('Participants aligned on proposed direction.');
    }
    if (fullText.toLowerCase().includes('contract') || fullText.toLowerCase().includes('signed')) {
      keyDecisions.push('Agreement/documentation in active progression.');
    }
    if (fullText.toLowerCase().includes('meeting') || fullText.toLowerCase().includes('call')) {
      keyDecisions.push('Sync call requested or scheduled.');
    }
    if (keyDecisions.length === 0) {
      keyDecisions.push('Initial correspondence established.');
    }

    // Executive summary
    const latestSnippet = messages[messages.length - 1]?.snippet || messages[messages.length - 1]?.bodyText?.substring(0, 200) || '';
    const summary = `Thread between ${participants.slice(0, 3).join(', ')} regarding "${cleanSubject}". Conversation consists of ${messages.length} message(s). Most recent status: "${latestSnippet.substring(0, 180)}..."`;

    // Markdown document
    const rawMarkdown = [
      `# 📝 Meeting & Thread Notes: ${cleanSubject}`,
      `**Date**: ${new Date().toLocaleDateString()} | **Messages**: ${messages.length} | **Participants**: ${participants.join(', ')}`,
      '',
      '## 📌 Executive Summary',
      summary,
      '',
      '## 🎯 Action Items & Next Steps',
      ...actionItems.map((a, i) => `- [ ] **${a.task}** ${a.assignee ? `(@${a.assignee})` : ''} ${a.deadline ? `— *${a.deadline}*` : ''}`),
      '',
      '## 💡 Key Decisions & Context',
      ...keyDecisions.map((d) => `• ${d}`),
      '',
      '---',
      `*Generated automatically by Mailr AI Copilot on ${new Date().toLocaleString()}*`,
    ].join('\n');

    // Save or update in database
    const savedNote = await prisma.threadNote.upsert({
      where: {
        userId_threadId: {
          userId,
          threadId,
        },
      },
      create: {
        userId,
        threadId,
        title: `Notes: ${cleanSubject}`,
        summary,
        actionItems: actionItems as unknown as object,
        keyDecisions: keyDecisions as unknown as object,
        rawMarkdown,
      },
      update: {
        title: `Notes: ${cleanSubject}`,
        summary,
        actionItems: actionItems as unknown as object,
        keyDecisions: keyDecisions as unknown as object,
        rawMarkdown,
      },
    });

    return {
      id: savedNote.id,
      threadId: savedNote.threadId,
      title: savedNote.title,
      summary: savedNote.summary,
      actionItems: actionItems,
      keyDecisions: keyDecisions,
      rawMarkdown: savedNote.rawMarkdown,
      createdAt: savedNote.createdAt,
      updatedAt: savedNote.updatedAt,
    };
  }

  /**
   * Draft a context-aware email response based on user natural language instructions.
   */
  static async draftReply(
    userId: string,
    threadId: string,
    instructions: string,
    tone: 'professional' | 'concise' | 'friendly' | 'assertive' = 'professional'
  ): Promise<{ draft: string; subject: string; recipientEmail: string; recipientName: string }> {
    const thread = await prisma.thread.findFirst({
      where: { id: threadId, account: { userId } },
      include: {
        messages: {
          orderBy: { receivedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!thread || thread.messages.length === 0) {
      throw new Error('Thread not found');
    }

    const latest = thread.messages[0];
    const cleanSubject = thread.subject.startsWith('Re:') ? thread.subject : `Re: ${thread.subject}`;
    const recipientName = latest.senderName || latest.senderEmail.split('@')[0];

    // Check if user has a Cal.com or Calendly booking link
    const calendarConn = await prisma.calendarIntegration.findFirst({
      where: { userId, bookingUrl: { not: null } },
      orderBy: { isDefault: 'desc' },
    });

    const bookingUrl = calendarConn?.bookingUrl;

    // Attempt LLM generation if BYOK or server key available
    try {
      const { provider, apiKey } = await this.getUserAIConfig(userId);
      const effectiveKey = LLMClient.resolveApiKey(provider, apiKey);
      if (effectiveKey) {
        const prompt = `You are a professional email assistant. Draft an email reply in a ${tone} tone to the following message.
User instructions: "${instructions}"
${bookingUrl ? `If scheduling a call or meeting, include this booking link: ${bookingUrl}` : ''}

Thread Subject: "${thread.subject}"
Latest Message from ${recipientName} (${latest.senderEmail}):
"${latest.bodyText || latest.snippet || ''}"

Return ONLY the drafted response body ready to send.`;

        const response = await LLMClient.generate({
          provider,
          apiKey,
          userPrompt: prompt,
          temperature: 0.5,
        });

        if (response.text && response.text.trim().length > 20) {
          return {
            draft: response.text.trim(),
            subject: cleanSubject,
            recipientEmail: latest.senderEmail,
            recipientName,
          };
        }
      }
    } catch (llmErr) {
      console.warn('[AgentService] LLM draft generation failed, using intelligent template:', llmErr);
    }

    let greeting = `Hi ${recipientName},`;
    if (tone === 'friendly') greeting = `Hey ${recipientName}!`;
    if (tone === 'assertive') greeting = `Dear ${recipientName},`;

    let body = '';
    const instLower = instructions.toLowerCase();

    if (instLower.includes('meeting') || instLower.includes('schedule') || instLower.includes('call') || instLower.includes('book')) {
      body = `Thanks for getting in touch. I would be glad to sync with you regarding this.\n\n`;
      if (bookingUrl) {
        body += `Please feel free to find a time that works best on my calendar here:\n👉 ${bookingUrl}\n\n`;
      } else {
        body += `I have availability tomorrow between 2:00 PM – 5:00 PM or Thursday morning. Please let me know what works best on your end.\n\n`;
      }
      body += `Looking forward to speaking soon.`;
    } else if (instLower.includes('confirm') || instLower.includes('agree') || instLower.includes('accept')) {
      body = `Thanks for following up on "${thread.subject}".\n\nI confirm that everything looks good to proceed. Let's move forward with the next steps as outlined, and I'll keep you updated on progress.`;
    } else if (instLower.includes('decline') || instLower.includes('pass') || instLower.includes('no')) {
      body = `Thank you for reaching out regarding "${thread.subject}".\n\nUnfortunately, due to current project priorities and bandwidth, I will not be able to participate in this opportunity at this time. I appreciate your understanding and wish you the best.`;
    } else if (instLower.includes('delay') || instLower.includes('busy') || instLower.includes('later')) {
      body = `Thanks for your note. I am currently tied up with a critical deliverable today, but I will review this thoroughly and get back to you with detailed feedback by tomorrow afternoon.`;
    } else {
      // General custom prompt expansion
      body = `Thank you for following up on "${thread.subject}".\n\nRegarding your note: ${instructions}.\n\nPlease let me know if you need any additional details from my side in the interim.`;
    }

    const signoff = tone === 'friendly' ? 'Warmly,' : 'Best regards,';
    const draft = `${greeting}\n\n${body}\n\n${signoff}\nSent via Mailr`;

    return {
      draft,
      subject: cleanSubject,
      recipientEmail: latest.senderEmail,
      recipientName,
    };
  }

  /**
   * Schedule or extract meeting details from an email thread and generate
   * 1-click links for Google Calendar, Outlook Web, and Cal.com.
   */
  static async scheduleMeetingFromThread(
    userId: string,
    threadId: string,
    customOptions?: { title?: string; startTime?: Date; endTime?: Date }
  ): Promise<MeetingScheduleResult> {
    const thread = await prisma.thread.findFirst({
      where: { id: threadId, account: { userId } },
      include: {
        messages: {
          orderBy: { receivedAt: 'desc' },
          take: 2,
        },
      },
    });

    if (!thread || thread.messages.length === 0) {
      throw new Error('Thread not found');
    }

    const latest = thread.messages[0];
    const cleanSubject = thread.subject.replace(/^(re:\s*|fwd:\s*)/i, '').trim();

    // Check existing proposal or create new
    let proposal = await prisma.calendarProposal.findFirst({
      where: { messageId: latest.id },
    });

    const now = new Date();
    const defaultStart = customOptions?.startTime || new Date(now.getTime() + 24 * 60 * 60 * 1000);
    if (!customOptions?.startTime) {
      defaultStart.setHours(15, 0, 0, 0); // 3 PM default
    }
    const defaultEnd = customOptions?.endTime || new Date(defaultStart.getTime() + 30 * 60 * 1000);

    const attendees = [
      { email: latest.senderEmail, name: latest.senderName || latest.senderEmail.split('@')[0] },
    ];

    if (!proposal) {
      proposal = await prisma.calendarProposal.create({
        data: {
          userId,
          messageId: latest.id,
          title: customOptions?.title || `Meeting: ${cleanSubject}`,
          description: `Discussion regarding "${cleanSubject}". Scheduled via Mailr AI Copilot.`,
          startTime: defaultStart,
          endTime: defaultEnd,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          attendees: attendees as unknown as object,
          status: ProposalStatus.PROPOSED,
        },
      });
    }

    // Format ISO strings for Google and Outlook URLs (YYYYMMDDTHHMMSSZ)
    const formatUrlDate = (date: Date) =>
      date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const startIso = formatUrlDate(new Date(proposal.startTime));
    const endIso = formatUrlDate(new Date(proposal.endTime));
    const encodedTitle = encodeURIComponent(proposal.title);
    const encodedDesc = encodeURIComponent(proposal.description || '');

    // 1. Google Calendar 1-Click Link
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodedTitle}&dates=${startIso}/${endIso}&details=${encodedDesc}&add=${encodeURIComponent(
      latest.senderEmail
    )}`;

    // 2. Outlook Personal Web Calendar Deep Link
    const outlookCalendarUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodedTitle}&body=${encodedDesc}&startdt=${encodeURIComponent(
      proposal.startTime.toISOString()
    )}&enddt=${encodeURIComponent(proposal.endTime.toISOString())}&to=${encodeURIComponent(latest.senderEmail)}`;

    // 3. Microsoft 365 / Office 365 Work Calendar Deep Link
    const office365CalendarUrl = `https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodedTitle}&body=${encodedDesc}&startdt=${encodeURIComponent(
      proposal.startTime.toISOString()
    )}&enddt=${encodeURIComponent(proposal.endTime.toISOString())}&to=${encodeURIComponent(latest.senderEmail)}`;

    // 4. Downloadable .ics URL
    const icsDownloadUrl = `/api/ai/calendar/proposals/${proposal.id}/ics`;

    // 5. User's Cal.com / Calendly link if present
    const calConn = await prisma.calendarIntegration.findFirst({
      where: { userId, provider: 'CAL_COM' },
    });
    const calendlyConn = await prisma.calendarIntegration.findFirst({
      where: { userId, provider: 'CALENDLY' },
    });

    return {
      proposalId: proposal.id,
      title: proposal.title,
      description: proposal.description || '',
      startTime: proposal.startTime,
      endTime: proposal.endTime,
      timezone: proposal.timezone,
      attendees,
      googleCalendarUrl,
      outlookCalendarUrl,
      office365CalendarUrl,
      icsDownloadUrl,
      calComUrl: calConn?.bookingUrl || undefined,
      calendlyUrl: calendlyConn?.bookingUrl || undefined,
    };
  }

  /**
   * Main Conversational Agent: processes user query, invokes tools, and returns interactive cards.
   */
  static async chatWithAgent(userId: string, prompt: string, threadId?: string): Promise<{
    reply: string;
    actionType: 'NOTES_GENERATED' | 'DRAFT_CREATED' | 'MEETING_SCHEDULED' | 'TRIAGE_EXECUTED' | 'GENERAL_REPLY';
    actionPayload?: Record<string, unknown>;
  }> {
    const lower = prompt.toLowerCase();

    // Log user chat message
    await prisma.agentChatMessage.create({
      data: {
        userId,
        threadId: threadId || null,
        role: 'user',
        content: prompt,
      },
    });

    let reply = '';
    let actionType: 'NOTES_GENERATED' | 'DRAFT_CREATED' | 'MEETING_SCHEDULED' | 'TRIAGE_EXECUTED' | 'GENERAL_REPLY' = 'GENERAL_REPLY';
    let actionPayload: Record<string, unknown> | undefined;

    // 1. NOTES & SUMMARY TOOL
    if (threadId && (lower.includes('summar') || lower.includes('note') || lower.includes('action item') || lower.includes('tldr') || lower.includes('recap'))) {
      const notes = await this.generateThreadNotes(userId, threadId);
      reply = `I have analyzed this conversation and generated executive notes with ${notes.actionItems.length} action item(s). They are saved in your **Notes** tab.`;
      actionType = 'NOTES_GENERATED';
      actionPayload = { notes };
    }
    // 2. MEETING / CALENDAR TOOL
    else if (threadId && (lower.includes('calendar') || lower.includes('meet') || lower.includes('schedule') || lower.includes('call') || lower.includes('book'))) {
      const meeting = await this.scheduleMeetingFromThread(userId, threadId);
      reply = `I have prepared the calendar booking for "${meeting.title}". You can add it directly to **Google Calendar**, **Outlook**, or download the **.ics** file.`;
      actionType = 'MEETING_SCHEDULED';
      actionPayload = { meeting };
    }
    // 3. EMAIL DRAFT TOOL
    else if (threadId && (lower.includes('draft') || lower.includes('reply') || lower.includes('write') || lower.includes('respond') || lower.includes('say'))) {
      let tone: 'professional' | 'concise' | 'friendly' | 'assertive' = 'professional';
      if (lower.includes('friendly') || lower.includes('casual')) tone = 'friendly';
      else if (lower.includes('short') || lower.includes('concise')) tone = 'concise';
      else if (lower.includes('firm') || lower.includes('assertive')) tone = 'assertive';

      const draftResult = await this.draftReply(userId, threadId, prompt, tone);
      reply = `Here is a drafted response for ${draftResult.recipientName}. Click **Insert into Composer** to review and dispatch.`;
      actionType = 'DRAFT_CREATED';
      actionPayload = { draftResult };
    }
    // 4. TRIAGE / MAILBOX MANAGEMENT TOOL
    else if (lower.includes('archive') || lower.includes('mark read') || lower.includes('unread') || lower.includes('star') || lower.includes('delete')) {
      const triageRes = await AIService.executeTriage(userId, prompt);
      reply = `Executed triage: updated ${triageRes.affectedCount} message(s) matching your command.`;
      actionType = 'TRIAGE_EXECUTED';
      actionPayload = { triageRes };
    }
    // 5. GENERAL INBOX COPILOT CONVERSATION
    else {
      let answeredByLLM = false;
      try {
        const { provider, apiKey } = await this.getUserAIConfig(userId);
        const effectiveKey = LLMClient.resolveApiKey(provider, apiKey);
        if (effectiveKey) {
          let contextText = '';
          if (threadId) {
            const thread = await prisma.thread.findFirst({
              where: { id: threadId, account: { userId } },
              include: {
                messages: {
                  orderBy: { receivedAt: 'desc' },
                  take: 3,
                },
              },
            });
            if (thread) {
              contextText =
                `Active Email Thread: "${thread.subject}"\nMessages:\n` +
                thread.messages
                  .map(
                    (m) =>
                      `From: ${m.senderName || m.senderEmail} at ${new Date(m.receivedAt).toLocaleString()}:\n${
                        m.bodyText || m.snippet || ''
                      }`
                  )
                  .join('\n---\n');
            }
          }

          const llmRes = await LLMClient.generate({
            provider,
            apiKey,
            systemPrompt:
              'You are Mailr AI Copilot, a brilliant executive email assistant. Help the user answer questions about their emails, draft responses, manage calendar tasks, or organize their inbox concisely.',
            userPrompt: `${contextText ? `Email Context:\n${contextText}\n\n` : ''}User Question: ${prompt}`,
            temperature: 0.4,
          });

          if (llmRes.text && llmRes.text.trim().length > 0) {
            reply = llmRes.text.trim();
            answeredByLLM = true;
          }
        }
      } catch (llmErr) {
        console.warn('[AgentService] LLM general conversation failed, using fallback:', llmErr);
      }

      if (!answeredByLLM) {
        // If thread context is available, answer contextual questions
        if (threadId) {
          const thread = await prisma.thread.findFirst({
            where: { id: threadId, account: { userId } },
            include: {
              messages: {
                orderBy: { receivedAt: 'desc' },
                take: 2,
              },
            },
          });
          const latest = thread?.messages[0];
          reply = `I am reviewing the thread "${thread?.subject || 'this email'}". The most recent correspondence was from ${latest?.senderName || latest?.senderEmail || 'the sender'} mentioning: "${latest?.snippet?.substring(0, 150) || 'no snippet'}...". How would you like me to help? I can draft a reply, take notes, or schedule a calendar call.`;
        } else {
          reply = `Hello! I am your Mailr AI Copilot. I can draft responses, generate meeting notes from threads, manage your calendar bookings (Google, Outlook, Cal.com), and organize your inboxes. Select any email thread or give me a command!`;
        }
      }
    }

    // Save assistant reply
    await prisma.agentChatMessage.create({
      data: {
        userId,
        threadId: threadId || null,
        role: 'assistant',
        content: reply,
        actionPayload: actionPayload ? (actionPayload as any) : undefined,
      },
    });

    return {
      reply,
      actionType,
      actionPayload,
    };
  }
}
