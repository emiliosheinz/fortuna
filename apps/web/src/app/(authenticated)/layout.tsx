import { AuthGuard } from "@/components/auth/auth-guard";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export default function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps) {
  return <AuthGuard>{children}</AuthGuard>;
}
