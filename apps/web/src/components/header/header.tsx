import Link from "next/link";
import type { CurrentUser } from "@/lib/users/api-client";
import { AvatarMenu } from "./avatar-menu";

interface HeaderProps {
  me: CurrentUser;
}

export function Header({ me }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="rounded-md text-base font-semibold tracking-tight text-foreground outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Fortuna
        </Link>
        <AvatarMenu me={me} />
      </div>
    </header>
  );
}
