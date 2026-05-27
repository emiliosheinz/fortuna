import { LegalArticle } from "@/lib/legal/legal-page";
import { loadLegalDocument } from "@/lib/legal/load";

export const metadata = {
  title: "Terms of Service · Fortuna",
};

export default async function TermsPage() {
  const doc = await loadLegalDocument("terms");
  return <LegalArticle doc={doc} />;
}
