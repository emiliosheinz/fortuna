"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LaptopMinimalIcon,
  MoonIcon,
  SunIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CurrentUser } from "@/lib/users/api-client";
import { cn } from "@/lib/utils";
import { UserAvatar } from "../user-avatar";

const COLLAPSE_STORAGE_KEY = "fortuna:sidebar:collapsed";

interface SidebarProps {
  me: CurrentUser;
}

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Cashflow", href: "/", icon: WalletIcon },
];

export function Sidebar({ me }: SidebarProps) {
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

      <Link
        href="/settings/account"
        data-testid="sidebar-identity"
        className={cn(
          "mx-2 flex items-center gap-3 rounded-md px-2 py-2 outline-none transition hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring",
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
      </Link>

      <nav aria-label="Sections" className="flex flex-1 flex-col gap-1 p-2">
        {NAV_ITEMS.map((item) => (
          <SidebarNavLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>

      <div
        className={cn(
          "flex items-center gap-1 border-t border-border p-2",
          collapsed && "flex-col",
        )}
      >
        <ThemeToggle />
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
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
        isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/40",
        collapsed && "justify-center",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {collapsed ? null : <span>{item.label}</span>}
    </Link>
  );
}

function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          data-testid="sidebar-theme-toggle"
          className="size-9"
        >
          <SunIcon
            className="size-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0"
            aria-hidden
          />
          <MoonIcon
            className="absolute size-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100"
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
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
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-pressed={collapsed}
      data-testid="sidebar-collapse-toggle"
      onClick={onToggle}
      className={cn("size-9", !collapsed && "ml-auto")}
    >
      {collapsed ? (
        <ChevronRightIcon className="size-4" aria-hidden />
      ) : (
        <ChevronLeftIcon className="size-4" aria-hidden />
      )}
    </Button>
  );
}
