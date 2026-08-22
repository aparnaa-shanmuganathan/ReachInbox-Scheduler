import type { PaginatedEmails, ScheduleCampaignResponse, SendersResponse } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? "Request failed");
  }

  return res.json() as Promise<T>;
}

export const api = {
  googleLoginUrl: () => `${API_URL}/api/auth/google`,

  getScheduledEmails: (token: string, page = 1) =>
    request<PaginatedEmails>(`/api/emails/scheduled?page=${page}&pageSize=25`, token),

  getSentEmails: (token: string, page = 1) =>
    request<PaginatedEmails>(`/api/emails/sent?page=${page}&pageSize=25`, token),

  scheduleCampaign: (token: string, formData: FormData) =>
    request<ScheduleCampaignResponse>("/api/campaigns", token, {
      method: "POST",
      body: formData,
    }),

  getSenders: (token: string) => request<SendersResponse>("/api/senders", token),
};
