import { apiClient } from "@/lib/api-client";

export const signOut = () => apiClient.delete("/api/auth/session");
