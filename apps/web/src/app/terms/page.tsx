import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Terms of Service · Fortuna",
};

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16 text-foreground">
      <h1 className="text-2xl font-semibold">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">
        Fortuna is in pre-launch. The full Terms of Service are being authored
        ahead of public release and will be published here before Fortuna
        accepts users outside the closed testing group.
      </p>
      <p className="text-sm text-muted-foreground">
        By using Fortuna during pre-launch you agree to use the product solely
        for testing and feedback purposes; data may be reset at any time prior
        to general availability.
      </p>
      <Button asChild variant="outline" className="self-start">
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
