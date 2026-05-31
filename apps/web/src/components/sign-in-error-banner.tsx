"use client";

import { useSearchParams } from "next/navigation";

export function SignInErrorBanner() {
  const params = useSearchParams();
  if (!params?.get("sign_in_error")) return null;
  return (
    <div
      role="alert"
      className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
    >
      Sign in failed. Please try again.
    </div>
  );
}
