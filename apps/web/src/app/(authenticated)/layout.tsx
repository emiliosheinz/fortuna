import { AuthGuard } from "@/components/auth/auth-guard";

/**
 * Every page rendered under `(authenticated)/**` is wrapped by the
 * AuthGuard. The guard is the only place that knows how to validate the
 * session cookie and feed `useAuth()` for client components — pages
 * themselves carry no auth boilerplate.
 */
export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
