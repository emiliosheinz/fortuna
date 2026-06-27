import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatLastUpdated, type LegalDocument } from "@/lib/legal/load";

export function LegalArticle({ doc }: { doc: LegalDocument }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-6 py-16 text-foreground">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{doc.title}</h1>
        <p className="text-sm text-muted-foreground">
          Last updated: {formatLastUpdated(doc.lastUpdated)}
        </p>
      </header>
      <article className="prose prose-sm dark:prose-invert max-w-none text-sm leading-6 text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.body}</ReactMarkdown>
      </article>
    </main>
  );
}
