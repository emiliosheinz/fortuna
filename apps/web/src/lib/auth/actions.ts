"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { deleteCurrentSession, deleteSession } from "./api-client";
import { SESSION_COOKIE_NAME } from "./cookies";

/**
 * Sign out the current device.
 *
 * Calls the API to revoke the session row, then clears the session cookie
 * regardless of the API outcome — a network error must not strand the user
 * in a "looks signed in" state, and even a 401 means the session is gone.
 */
export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  try {
    await deleteCurrentSession(sessionValue);
  } catch (err) {
    console.warn("[auth/sign-out] api_call_failed", err);
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  redirect("/");
}

/**
 * Revoke a non-current session by id. Triggered from the `/settings/sessions`
 * page; refreshes the session list on success.
 *
 * The API enforces ownership (404 on foreign sessions) and refuses to
 * revoke the current session (400) — both surface as a thrown error here,
 * which Next.js renders via the route's error boundary.
 */
export async function revokeSessionAction(formData: FormData): Promise<void> {
  const sessionId = formData.get("sessionId");
  if (typeof sessionId !== "string" || sessionId === "") {
    throw new Error("sessionId is required");
  }

  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionValue) {
    redirect("/");
  }

  await deleteSession(sessionValue, sessionId);

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/settings/sessions");
}
