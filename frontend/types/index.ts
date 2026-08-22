export type EmailStatus =
  | "PENDING"
  | "QUEUED"
  | "PROCESSING"
  | "SENT"
  | "FAILED"
  | "RATE_LIMITED";

export interface SenderSummary {
  fromEmail: string;
  label: string;
}

export interface EmailRow {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledFor: string;
  sentAt: string | null;
  lastError: string | null;
  attempts: number;
  sender: SenderSummary;
}

export interface PaginatedEmails {
  items: EmailRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface ScheduleCampaignResponse {
  campaign: {
    id: string;
    subject: string;
    startTime: string;
    totalRecipients: number;
  };
  recipientCount: number;
}

export interface SendersResponse {
  senders: { id: string; label: string; fromEmail: string }[];
}
