export interface NormalizedAttachment {
  filename: string;
  contentType: string;
  sizeBytes: number;
  filePath?: string;
  content?: Buffer;
}

export interface NormalizedMessage {
  remoteId: string;
  remoteThreadId: string;
  senderName: string;
  senderEmail: string;
  recipients: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  snippet: string;
  bodyHtml?: string;
  bodyText?: string;
  receivedAt: Date;
  isRead: boolean;
  isFlagged: boolean;
  isArchived?: boolean;
  hasAttachments: boolean;
  attachments?: NormalizedAttachment[];
}

export interface SendMailOptions {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  attachments?: {
    filename: string;
    content: Buffer;
    contentType: string;
  }[];
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface IEmailAdapter {
  connect(): Promise<void>;
  testConnection(): Promise<TestConnectionResult>;
  syncMessages(
    since: Date,
    onBatch: (messages: NormalizedMessage[]) => Promise<void>
  ): Promise<number>;
  sendMail(options: SendMailOptions): Promise<{ success: boolean; messageId: string }>;
  markAsRead(remoteMessageId: string, isRead: boolean): Promise<void>;
  archiveMessage(remoteMessageId: string): Promise<void>;
  deleteMessage(remoteMessageId: string): Promise<void>;
  disconnect(): Promise<void>;
}
