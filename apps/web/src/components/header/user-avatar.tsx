"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  avatarUrl: string | null;
  className?: string;
}

const SIZE_PX = 32;

export function UserAvatar({ name, avatarUrl, className }: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const wrapperClass = cn(
    "flex size-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-accent text-xs font-medium uppercase text-accent-foreground",
    className,
  );

  if (avatarUrl && !imageFailed) {
    return (
      <span className={wrapperClass}>
        <Image
          src={avatarUrl}
          alt={name}
          width={SIZE_PX}
          height={SIZE_PX}
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="size-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      data-testid="user-avatar-initials"
      aria-hidden="true"
      className={wrapperClass}
    >
      {deriveInitials(name)}
    </span>
  );
}

function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words.at(0);
  if (!first) return "";
  const last = words.at(-1);
  if (!last || last === first) return first.charAt(0).toUpperCase();
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}
