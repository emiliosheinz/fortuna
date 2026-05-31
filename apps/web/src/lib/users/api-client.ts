import { apiClient } from "@/lib/api-client";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export const usersApi = {
  getMe: () => apiClient.get<CurrentUser>("/api/users/me"),
  deleteAccount: () =>
    apiClient.delete("/api/users/me", { body: { confirm: true } }),
};
