"use client";

import { AuthGuard, useAuth } from "@/components/auth/auth-guard";
import { Header } from "@/components/header/header";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export default function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps) {
  return (
    <AuthGuard>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </AuthGuard>
  );
}

function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const { me } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header me={me} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
