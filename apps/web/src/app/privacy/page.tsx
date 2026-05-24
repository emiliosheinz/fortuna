import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Privacy Policy · Fortuna",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16 text-foreground">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">
        Fortuna is in pre-launch. The full Privacy Policy is being authored
        ahead of public release and will be published here before Fortuna
        accepts users outside the closed testing group.
      </p>
      <p className="text-sm text-muted-foreground">
        In the meantime: Fortuna stores the Google profile fields you authorise
        (name, email, avatar URL) plus an opaque per-device session record.
        Account deletion is self-service and permanent.
      </p>
      <Button asChild variant="outline" className="self-start">
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
