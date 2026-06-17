"use client";

import { LaptopMinimalIcon, MoonIcon, SunIcon } from "lucide-react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeSwitcher() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-haspopup="menu"
          aria-label="Toggle theme"
          variant="ghost"
          size="icon"
          className="cursor-pointer"
          data-testid="theme-toggle"
        >
          <SunIcon
            aria-hidden
            className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0"
          />
          <MoonIcon
            aria-hidden
            className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100"
          />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent data-testid="theme-menu">
        <DropdownMenuItem asChild data-testid="theme-light">
          <button type="button" onClick={() => setTheme("light")}>
            <SunIcon aria-hidden /> Light
          </button>
        </DropdownMenuItem>
        <DropdownMenuItem asChild data-testid="theme-dark">
          <button type="button" onClick={() => setTheme("dark")}>
            <MoonIcon aria-hidden /> Dark
          </button>
        </DropdownMenuItem>
        <DropdownMenuItem asChild data-testid="theme-system">
          <button type="button" onClick={() => setTheme("system")}>
            <LaptopMinimalIcon aria-hidden /> System
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
