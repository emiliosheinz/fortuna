"use client";

import { useMutation } from "@tanstack/react-query";
import {
  CoinsIcon,
  FolderIcon,
  LaptopMinimalIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MoonIcon,
  PaletteIcon,
  SettingsIcon,
  ShieldIcon,
  SidebarIcon,
  SunIcon,
  TagIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { type ComponentType, useEffect, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { CLEAR_SESSION_PATH } from "@/lib/api-client";
import { signOut } from "@/lib/auth/sign-out";
import { navigateTo } from "@/lib/navigate";
import type { CurrentUser } from "@/lib/users/api-client";
import { UserAvatar } from "../user-avatar";

type IconComponent = ComponentType<{
  className?: string;
  "aria-hidden"?: boolean;
}>;

interface NavItem {
  label: string;
  href: string;
  icon: IconComponent;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboardIcon },
  { label: "Transactions", href: "/transactions", icon: CoinsIcon },
  { label: "Categories", href: "/categories", icon: FolderIcon },
  { label: "Tags", href: "/tags", icon: TagIcon },
];

export function Sidebar({ me }: { me: CurrentUser }) {
  useCloseMobileSidebarOnNavigate();
  const { state } = useSidebar();
  return (
    <ShadcnSidebar
      collapsible="icon"
      data-testid="sidebar"
      data-state={state}
      className="border-r border-border"
    >
      <SidebarHeader>
        <IdentityPopover me={me} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => (
              <SidebarNavItem key={item.href} item={item} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <CollapseToggle />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </ShadcnSidebar>
  );
}

function useCloseMobileSidebarOnNavigate() {
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  useEffect(() => {
    if (isMobile && pathname !== previousPathname.current) {
      setOpenMobile(false);
    }
    previousPathname.current = pathname;
  }, [pathname, isMobile, setOpenMobile]);
}

function SidebarNavItem({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href ||
    (item.href !== "/" && pathname?.startsWith(item.href));
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={Boolean(isActive)}
        tooltip={item.label}
      >
        <Link
          href={item.href}
          data-testid={`sidebar-nav-${item.label.toLowerCase()}`}
          aria-current={isActive ? "page" : undefined}
        >
          <Icon aria-hidden />
          <span className="transition-opacity duration-200 group-data-[collapsible=icon]:opacity-0">
            {item.label}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function IdentityPopover({ me }: { me: CurrentUser }) {
  const { isMobile } = useSidebar();
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => navigateTo(CLEAR_SESSION_PATH),
  });

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              data-testid="sidebar-identity"
              aria-label="Account menu"
              tooltip={me.name}
              className="p-0.5! data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:h-12! group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:gap-0! group-data-[collapsible=icon]:p-0.5!"
            >
              <UserAvatar
                name={me.name}
                avatarUrl={me.avatarUrl}
                className="size-7"
              />
              <div className="flex min-w-0 flex-col text-left transition-opacity duration-200 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
                <span className="truncate text-sm font-medium">{me.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {me.email}
                </span>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={8}
            className="w-48"
            data-testid="sidebar-identity-menu"
            // The mobile sidebar renders inside a Radix Sheet whose trapped
            // FocusScope bounces focus back into the dialog on open; that
            // focusin lands outside this portaled content and would otherwise
            // trigger the dropdown's auto-dismiss.
            onFocusOutside={(event) => event.preventDefault()}
          >
            <IdentityMenuLink
              href="/settings/account"
              label="Account"
              icon={UserIcon}
              testId="identity-menu-account"
            />
            <IdentityMenuLink
              href="/settings/preferences"
              label="Settings"
              icon={SettingsIcon}
              testId="identity-menu-settings"
            />
            <IdentityMenuLink
              href="/settings/sessions"
              label="Sessions"
              icon={ShieldIcon}
              testId="identity-menu-sessions"
            />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="identity-menu-sign-out"
              disabled={signOutMutation.isPending}
              onSelect={(event) => {
                event.preventDefault();
                signOutMutation.mutate();
              }}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
            >
              <LogOutIcon className="mr-2 size-4" aria-hidden />
              {signOutMutation.isPending ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {signOutMutation.isError ? (
          <p
            role="alert"
            data-testid="sign-out-error"
            className="px-2 pt-1 text-xs text-destructive"
          >
            Could not sign out. Please try again.
          </p>
        ) : null}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function IdentityMenuLink({
  href,
  label,
  icon: Icon,
  testId,
}: {
  href: string;
  label: string;
  icon: IconComponent;
  testId: string;
}) {
  return (
    <DropdownMenuItem asChild data-testid={testId}>
      <Link href={href}>
        <Icon className="mr-2 size-4" aria-hidden />
        {label}
      </Link>
    </DropdownMenuItem>
  );
}

function ThemeToggle() {
  const { setTheme } = useTheme();
  const { isMobile } = useSidebar();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          data-testid="sidebar-theme-toggle"
          aria-label="Toggle theme"
          tooltip="Theme"
        >
          <PaletteIcon aria-hidden />
          <span className="transition-opacity duration-200 group-data-[collapsible=icon]:opacity-0">
            Theme
          </span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side={isMobile ? "top" : "right"}
        sideOffset={8}
        data-testid="sidebar-theme-menu"
        // See identity popover above — same FocusScope-vs-portal interaction.
        onFocusOutside={(event) => event.preventDefault()}
      >
        <DropdownMenuItem
          data-testid="theme-light"
          onClick={() => setTheme("light")}
        >
          <SunIcon className="mr-2 size-4" aria-hidden /> Light
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="theme-dark"
          onClick={() => setTheme("dark")}
        >
          <MoonIcon className="mr-2 size-4" aria-hidden /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="theme-system"
          onClick={() => setTheme("system")}
        >
          <LaptopMinimalIcon className="mr-2 size-4" aria-hidden /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CollapseToggle() {
  const { toggleSidebar, state } = useSidebar();
  const isCollapsed = state === "collapsed";
  return (
    <SidebarMenuButton
      data-testid="sidebar-collapse-toggle"
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-pressed={isCollapsed}
      tooltip={isCollapsed ? "Expand" : undefined}
      onClick={toggleSidebar}
    >
      <SidebarIcon aria-hidden />
      <span className="transition-opacity duration-200 group-data-[collapsible=icon]:opacity-0">
        Collapse
      </span>
    </SidebarMenuButton>
  );
}
