import { apiClient } from "@/lib/api-client";

export interface SessionListItem {
  id: string;
  deviceLabel: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export const SESSIONS_QUERY_KEY = ["sessions", "list"] as const;

export const sessionsApi = {
  list: () => apiClient.get<SessionListItem[]>("/api/users/me/sessions"),
  revoke: (sessionId: string) =>
    apiClient.delete(`/api/users/me/sessions/${encodeURIComponent(sessionId)}`),
};
