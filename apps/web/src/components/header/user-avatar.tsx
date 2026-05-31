import Image from "next/image";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  avatarUrl: string | null;
  className?: string;
}

const SIZE_PX = 32;

export function UserAvatar({ name, avatarUrl, className }: UserAvatarProps) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={SIZE_PX}
        height={SIZE_PX}
        unoptimized
        className={cn("size-8 shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  const initials = deriveInitials(name);

  return (
    <span
      data-testid="user-avatar-initials"
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 select-none items-center justify-center rounded-full bg-accent text-xs font-medium uppercase text-accent-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}

function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  const first = words[0].charAt(0);
  const last = words[words.length - 1].charAt(0);
  return `${first}${last}`.toUpperCase();
}
