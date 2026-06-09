"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";

export function MobileHeader() {
  return (
    <header
      data-testid="mobile-header"
      className="sticky top-0 z-30 flex h-12 items-center border-b border-border bg-background px-2 md:hidden"
    >
      <SidebarTrigger
        data-testid="mobile-sidebar-trigger"
        aria-label="Open navigation menu"
        className="size-10"
      />
    </header>
  );
}
