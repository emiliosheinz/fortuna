import { cookies } from "next/headers";
import { AuthenticatedShell } from "./_shell";

const SIDEBAR_COOKIE_NAME = "sidebar_state";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export default async function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps) {
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value !== "false";
  return (
    <AuthenticatedShell defaultSidebarOpen={sidebarOpen}>
      {children}
    </AuthenticatedShell>
  );
}
