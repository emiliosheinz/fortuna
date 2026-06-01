import { apiClient } from "@/lib/api-client";

export const signOut = () => apiClient.delete("/api/v1/auth/session");
