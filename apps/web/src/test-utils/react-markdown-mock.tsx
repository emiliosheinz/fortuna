import type { ReactNode } from "react";

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let cursor = 0;
  let idx = 0;

  for (const match of text.matchAll(LINK_RE)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      parts.push(
        renderBold(text.slice(cursor, start), `${keyPrefix}-t-${idx++}`),
      );
    }
    const [, label, href] = match;
    parts.push(
      <a key={`${keyPrefix}-a-${idx++}`} href={href}>
        {label}
      </a>,
    );
    cursor = start + match[0].length;
  }

  if (cursor < text.length) {
    parts.push(renderBold(text.slice(cursor), `${keyPrefix}-t-${idx++}`));
  }

  return parts;
}

function renderBold(text: string, key: string): ReactNode {
  if (!BOLD_RE.test(text)) {
    return <span key={key}>{text}</span>;
  }
  BOLD_RE.lastIndex = 0;
  const parts: ReactNode[] = [];
  let cursor = 0;
  let idx = 0;
  for (const match of text.matchAll(BOLD_RE)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      parts.push(
        <span key={`${key}-b-${idx++}`}>{text.slice(cursor, start)}</span>,
      );
    }
    parts.push(<strong key={`${key}-b-${idx++}`}>{match[1]}</strong>);
    cursor = start + match[0].length;
  }
  if (cursor < text.length) {
    parts.push(<span key={`${key}-b-${idx++}`}>{text.slice(cursor)}</span>);
  }
  return <span key={key}>{parts}</span>;
}

export default function ReactMarkdown({
  children,
}: {
  children: string;
  remarkPlugins?: unknown;
}) {
  const lines = children.split(/\r?\n/);
  const elements: ReactNode[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const key = `p-${elements.length}`;
    elements.push(
      <p key={key}>{renderInline(paragraphBuffer.join(" "), key)}</p>,
    );
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const key = `ul-${elements.length}`;
    const items = listBuffer.slice();
    elements.push(
      <ul key={key}>
        {items.map((item, i) => (
          <li key={`${key}-${item}`}>{renderInline(item, `${key}-li-${i}`)}</li>
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flushAll();
      const key = `h2-${elements.length}`;
      elements.push(<h2 key={key}>{renderInline(line.slice(3), key)}</h2>);
    } else if (line.startsWith("### ")) {
      flushAll();
      const key = `h3-${elements.length}`;
      elements.push(<h3 key={key}>{renderInline(line.slice(4), key)}</h3>);
    } else if (line.startsWith("- ")) {
      flushParagraph();
      listBuffer.push(line.slice(2));
    } else if (line.trim() === "") {
      flushAll();
    } else {
      flushList();
      paragraphBuffer.push(line.trim());
    }
  }
  flushAll();

  return <>{elements}</>;
}
