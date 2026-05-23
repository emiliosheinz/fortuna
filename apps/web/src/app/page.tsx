import { Suspense } from "react";
import { SignInErrorBanner } from "@/components/sign-in-error-banner";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background">
      <span className="text-2xl font-semibold text-foreground">Fortuna</span>
      {/* Plain anchor (not next/link) so the click triggers a full browser
          navigation. The target route handler 303-redirects to Google, which
          must not be fetched via the App Router's RSC client (CORS blocks
          the preflight against accounts.google.com). */}
      <Button asChild>
        <a href="/api/auth/sign-in">Sign in with Google</a>
      </Button>
      <Suspense fallback={null}>
        <SignInErrorBanner />
      </Suspense>
    </div>
  );
}
