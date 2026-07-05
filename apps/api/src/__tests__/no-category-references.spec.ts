import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const API_SRC = path.join(REPO_ROOT, "apps", "api", "src");
const WEB_SRC = path.join(REPO_ROOT, "apps", "web", "src");
const MIGRATIONS_DIR = path.join(API_SRC, "database", "migrations");
const PRIVACY_MD = path.join(WEB_SRC, "content", "legal", "privacy.md");
const THIS_FILE = __filename;

const SCANNED_ROOTS = [API_SRC, WEB_SRC];
const SCANNED_EXTENSIONS = new Set([".ts", ".tsx", ".md"]);
const EXCLUDED_DIRS = new Set(["node_modules", ".next", "dist", ".turbo"]);
const CATEGOR_RE = /categor/i;
// The LGPD "categories of recipient" wording under "Sharing Your Information"
// is the only surviving legitimate use in shipped content (RCAT-08 AC1).
const LGPD_ALLOWED_SUBSTRING = "categories of recipient";

const FORBIDDEN_COMPONENT_BASENAMES = new Set([
  "categories-manager.tsx",
  "category-pie.tsx",
  "keyboard-safe-combobox.tsx",
]);

function walkFiles(root: string): string[] {
  const collected: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        stack.push(full);
      } else if (
        entry.isFile() &&
        SCANNED_EXTENSIONS.has(path.extname(entry.name))
      ) {
        collected.push(full);
      }
    }
  }
  return collected;
}

function isAllowedMatch(filePath: string, line: string): boolean {
  if (filePath === THIS_FILE) return true;
  if (filePath.startsWith(`${MIGRATIONS_DIR}${path.sep}`)) return true;
  if (filePath === PRIVACY_MD && line.includes(LGPD_ALLOWED_SUBSTRING)) {
    return true;
  }
  return false;
}

describe("no category references remain in shipped source", () => {
  it("no category-only component files survive under apps/web/src", () => {
    const survivors = walkFiles(WEB_SRC).filter((file) =>
      FORBIDDEN_COMPONENT_BASENAMES.has(path.basename(file)),
    );
    expect(survivors).toEqual([]);
  });

  it("no /categor/i matches outside the LGPD + migrations allowlist", () => {
    const violations: string[] = [];
    for (const root of SCANNED_ROOTS) {
      for (const file of walkFiles(root)) {
        const lines = fs.readFileSync(file, "utf8").split("\n");
        lines.forEach((line, idx) => {
          if (!CATEGOR_RE.test(line)) return;
          if (isAllowedMatch(file, line)) return;
          const rel = path.relative(REPO_ROOT, file);
          violations.push(`${rel}:${idx + 1}: ${line.trim()}`);
        });
      }
    }
    expect(violations).toEqual([]);
  });
});
