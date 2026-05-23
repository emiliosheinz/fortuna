"use client";

import { useSearchParams } from "next/navigation";

export function SignInErrorBanner() {
  const params = useSearchParams();
  if (!params?.get("sign_in_error")) return null;
  return (
    <p className="text-sm text-destructive" role="alert">
      Sign in failed. Please try again.
    </p>
  );
}
