"use client";

import { AuthGuard, useAuth } from "@/components/auth/auth-guard";
import { NewTransactionFab } from "@/components/new-transaction-fab";
import { MobileHeader } from "@/components/sidebar/mobile-header";
import { Sidebar } from "@/components/sidebar/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

interface AuthenticatedShellProps {
  children: React.ReactNode;
  defaultSidebarOpen: boolean;
}

export function AuthenticatedShell({
  children,
  defaultSidebarOpen,
}: AuthenticatedShellProps) {
  return (
    <AuthGuard sidebarOpen={defaultSidebarOpen}>
      <ShellInterior defaultSidebarOpen={defaultSidebarOpen}>
        {children}
      </ShellInterior>
    </AuthGuard>
  );
}

function ShellInterior({
  children,
  defaultSidebarOpen,
}: AuthenticatedShellProps) {
  const { me } = useAuth();
  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <Sidebar me={me} />
      <div className="relative flex min-h-svh flex-1 flex-col pb-[calc(env(safe-area-inset-bottom)+6rem)]">
        <MobileHeader />
        {children}
        <NewTransactionFab />
      </div>
    </SidebarProvider>
  );
}
