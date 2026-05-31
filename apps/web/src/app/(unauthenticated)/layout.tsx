import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookie-names";

interface UnauthenticatedLayoutProps {
  children: React.ReactNode;
}

export default async function UnauthenticatedLayout({
  children,
}: UnauthenticatedLayoutProps) {
  const cookieStore = await cookies();
  if (cookieStore.has(SESSION_COOKIE_NAME)) {
    redirect("/");
  }
  return <>{children}</>;
}
