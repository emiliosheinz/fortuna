import { readFile } from "node:fs/promises";
import path from "node:path";

export type LegalSlug = "privacy" | "terms";

export type LegalDocument = {
  title: string;
  lastUpdated: string;
  body: string;
};

const CONTENT_DIR = path.join(process.cwd(), "src", "content", "legal");

export async function loadLegalDocument(
  slug: LegalSlug,
): Promise<LegalDocument> {
  const filePath = path.join(CONTENT_DIR, `${slug}.md`);
  const raw = await readFile(filePath, "utf8");
  return parseLegalDocument(raw);
}

export function parseLegalDocument(raw: string): LegalDocument {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error("Legal document is missing required frontmatter block");
  }

  const frontmatter = match[1] ?? "";
  const body = match[2] ?? "";
  const fields = parseFrontmatter(frontmatter);

  const title = fields.title;
  const lastUpdated = fields.lastUpdated;
  if (!title) {
    throw new Error("Legal document frontmatter is missing 'title'");
  }
  if (!lastUpdated) {
    throw new Error("Legal document frontmatter is missing 'lastUpdated'");
  }

  return { title, lastUpdated, body: body.trim() };
}

function parseFrontmatter(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed
      .slice(colon + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    out[key] = value;
  }
  return out;
}

export function formatLastUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
