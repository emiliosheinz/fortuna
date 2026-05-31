import Image from "next/image";
import Link from "next/link";
import type { CurrentUser } from "@/lib/users/api-client";
import { AvatarMenu } from "./avatar-menu";

interface HeaderProps {
  me: CurrentUser;
}

export function Header({ me }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex w-full items-center justify-between gap-2 border-b border-border bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
      <Link
        href="/"
        className="flex items-center gap-2 rounded-md outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Image
          src="/fortuna-logo.png"
          alt="Fortuna"
          width={28}
          height={28}
          priority
          className="size-7"
        />
        <span className="text-base font-semibold tracking-tight text-foreground">
          Fortuna
        </span>
      </Link>
      <AvatarMenu me={me} />
    </header>
  );
}
