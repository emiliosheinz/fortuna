import Image from "next/image";
import { Suspense } from "react";
import { SignInErrorBanner } from "@/components/sign-in-error-banner";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-6 text-center">
          <Image
            src="/fortuna-logo.svg"
            alt="Fortuna"
            width={48}
            height={48}
            priority
            unoptimized
            className="text-foreground"
          />
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground">
            Take control of your finances
          </h1>
        </div>
        <Suspense fallback={null}>
          <SignInErrorBanner />
        </Suspense>
        <Button asChild size="lg" className="mt-6 w-full">
          {/* Plain anchor (not next/link) so the click triggers a full browser
              navigation. The target route handler 303-redirects to Google, which
              must not be fetched via the App Router's RSC client (CORS blocks
              the preflight against accounts.google.com). */}
          <a href="/api/auth/sign-in">
            <Image
              src="/vendor/google-g.svg"
              alt=""
              width={18}
              height={18}
              unoptimized
              aria-hidden="true"
            />
            Continue with Google
          </a>
        </Button>
        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          By signing in you agree to our{" "}
          <a
            href="/terms"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Terms of Service
          </a>{" "}
          and acknowledge our{" "}
          <a
            href="/privacy"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
