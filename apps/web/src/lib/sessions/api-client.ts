import { apiClient } from "@/lib/api-client";

export interface SessionListItem {
  id: string;
  deviceLabel: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export const sessionsApi = {
  list: () => apiClient.get<SessionListItem[]>("/api/v1/users/me/sessions"),
  revoke: (sessionId: string) =>
    apiClient.delete(
      `/api/v1/users/me/sessions/${encodeURIComponent(sessionId)}`,
    ),
};
