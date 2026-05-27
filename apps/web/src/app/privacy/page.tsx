import { LegalArticle } from "@/lib/legal/legal-page";
import { loadLegalDocument } from "@/lib/legal/load";

export const metadata = {
  title: "Privacy Policy · Fortuna",
};

export default async function PrivacyPage() {
  const doc = await loadLegalDocument("privacy");
  return <LegalArticle doc={doc} />;
}
