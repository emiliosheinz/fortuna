"use client";

import { AuthGuard, useAuth } from "@/components/auth/auth-guard";
import { NewTransactionFab } from "@/components/new-transaction-fab";
import { MobileHeader } from "@/components/sidebar/mobile-header";
import { Sidebar } from "@/components/sidebar/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

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
    <SidebarProvider>
      <Sidebar me={me} />
      <div className="relative flex min-h-svh flex-1 flex-col">
        <MobileHeader />
        {children}
        <NewTransactionFab />
      </div>
    </SidebarProvider>
  );
}
