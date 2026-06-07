"use client";

import { useMutation } from "@tanstack/react-query";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CoinsIcon,
  FolderIcon,
  LaptopMinimalIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MoonIcon,
  PaletteIcon,
  SettingsIcon,
  ShieldIcon,
  SunIcon,
  TagIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CLEAR_SESSION_PATH } from "@/lib/api-client";
import { signOut } from "@/lib/auth/sign-out";
import { navigateTo } from "@/lib/navigate";
import type { CurrentUser } from "@/lib/users/api-client";
import { cn } from "@/lib/utils";
import { UserAvatar } from "../user-avatar";

const COLLAPSE_STORAGE_KEY = "fortuna:sidebar:collapsed";

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

function sidebarItemClass({
  collapsed,
  active,
}: {
  collapsed: boolean;
  active?: boolean;
}): string {
  return cn(
    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
    active ? "bg-accent text-accent-foreground" : "hover:bg-accent/40",
    collapsed && "justify-center",
  );
}

export function Sidebar({ me }: { me: CurrentUser }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1") {
      setCollapsed(true);
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <aside
      data-testid="sidebar"
      data-state={collapsed ? "collapsed" : "expanded"}
      aria-label="Primary"
      className={cn(
        "sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex items-center px-4 py-4">
        <Link
          href="/"
          aria-label="Fortuna home"
          className="rounded-md font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? "F" : "Fortuna"}
        </Link>
      </div>

      <div className="px-2">
        <IdentityPopover me={me} collapsed={collapsed} />
      </div>

      <nav aria-label="Sections" className="flex flex-1 flex-col gap-1 p-2">
        {NAV_ITEMS.map((item) => (
          <SidebarNavLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="flex flex-col gap-1 p-2">
        <ThemeToggle collapsed={collapsed} />
        <CollapseToggle collapsed={collapsed} onToggle={toggleCollapsed} />
      </div>
    </aside>
  );
}

function SidebarNavLink({
  item,
  collapsed,
}: {
  item: NavItem;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href ||
    (item.href !== "/" && pathname?.startsWith(item.href));
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      data-testid={`sidebar-nav-${item.label.toLowerCase()}`}
      aria-current={isActive ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={sidebarItemClass({ collapsed, active: Boolean(isActive) })}
    >
      <Icon className="size-4" aria-hidden />
      {collapsed ? null : <span>{item.label}</span>}
    </Link>
  );
}

function IdentityPopover({
  me,
  collapsed,
}: {
  me: CurrentUser;
  collapsed: boolean;
}) {
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => navigateTo(CLEAR_SESSION_PATH),
  });

  return (
    <div className="flex flex-col gap-1">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-testid="sidebar-identity"
            aria-label="Account menu"
            className={cn(
              "flex items-center gap-3 rounded-md px-2 py-2 text-left outline-none transition hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring",
              collapsed && "justify-center",
            )}
          >
            <UserAvatar name={me.name} avatarUrl={me.avatarUrl} />
            {collapsed ? null : (
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{me.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {me.email}
                </span>
              </div>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="right"
          sideOffset={8}
          className="w-48"
          data-testid="sidebar-identity-menu"
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
          className="text-xs text-destructive"
        >
          Could not sign out. Please try again.
        </p>
      ) : null}
    </div>
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

function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const { setTheme } = useTheme();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Toggle theme"
          data-testid="sidebar-theme-toggle"
          title={collapsed ? "Theme" : undefined}
          className={sidebarItemClass({ collapsed })}
        >
          <PaletteIcon className="size-4" aria-hidden />
          {collapsed ? null : <span>Theme</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="right"
        sideOffset={8}
        data-testid="sidebar-theme-menu"
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

function CollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-pressed={collapsed}
      data-testid="sidebar-collapse-toggle"
      title={collapsed ? "Expand" : undefined}
      onClick={onToggle}
      className={sidebarItemClass({ collapsed })}
    >
      {collapsed ? (
        <ChevronRightIcon className="size-4" aria-hidden />
      ) : (
        <ChevronLeftIcon className="size-4" aria-hidden />
      )}
      {collapsed ? null : <span>Collapse</span>}
    </button>
  );
}
