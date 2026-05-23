import Link from "next/link";
import { Suspense } from "react";
import { SignInErrorBanner } from "@/components/sign-in-error-banner";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background">
      <span className="text-2xl font-semibold text-foreground">Fortuna</span>
      <Button asChild>
        <Link href="/api/auth/sign-in" prefetch={false}>
          Sign in with Google
        </Link>
      </Button>
      <Suspense fallback={null}>
        <SignInErrorBanner />
      </Suspense>
    </div>
  );
}
