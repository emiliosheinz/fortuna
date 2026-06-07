"use client";

import { AuthGuard, useAuth } from "@/components/auth/auth-guard";
import { NewTransactionFab } from "@/components/new-transaction-fab";
import { Sidebar } from "@/components/sidebar/sidebar";

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
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar me={me} />
      <div className="relative flex min-h-screen flex-1 flex-col">
        {children}
        <NewTransactionFab />
      </div>
    </div>
  );
}
