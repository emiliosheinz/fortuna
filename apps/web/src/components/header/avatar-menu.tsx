"use client";

import { useMutation } from "@tanstack/react-query";
import { LaptopMinimalIcon, MoonIcon, SunIcon } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CLEAR_SESSION_PATH } from "@/lib/api-client";
import { signOut } from "@/lib/auth/sign-out";
import { navigateTo } from "@/lib/navigate";
import type { CurrentUser } from "@/lib/users/api-client";
import { UserAvatar } from "./user-avatar";

interface AvatarMenuProps {
  me: CurrentUser;
}

export function AvatarMenu({ me }: AvatarMenuProps) {
  const { theme, setTheme } = useTheme();
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      navigateTo(CLEAR_SESSION_PATH);
    },
  });

  return (
    <div className="flex flex-col items-end gap-2">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="rounded-full outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <UserAvatar name={me.name} avatarUrl={me.avatarUrl} />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-56"
          data-testid="avatar-menu"
        >
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium leading-tight">
              {me.name}
            </span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {me.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings/account">Account</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/categories">Categories</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/tags">Tags</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/sessions">Sessions</Link>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Theme</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={theme ?? "system"}
                onValueChange={setTheme}
              >
                <DropdownMenuRadioItem value="light" data-testid="theme-light">
                  <SunIcon aria-hidden className="mr-2 size-4" /> Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark" data-testid="theme-dark">
                  <MoonIcon aria-hidden className="mr-2 size-4" /> Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value="system"
                  data-testid="theme-system"
                >
                  <LaptopMinimalIcon aria-hidden className="mr-2 size-4" />{" "}
                  System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            data-testid="sign-out-menu-item"
            disabled={signOutMutation.isPending}
            onSelect={(event) => {
              event.preventDefault();
              signOutMutation.mutate();
            }}
          >
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
