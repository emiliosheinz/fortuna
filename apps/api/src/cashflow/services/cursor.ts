const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TransactionCursor {
  date: string;
  id: string;
}

export function encodeCursor(cursor: TransactionCursor): string {
  return Buffer.from(`${cursor.date}|${cursor.id}`, "utf8").toString(
    "base64url",
  );
}

export function decodeCursor(value: string): TransactionCursor {
  const raw = Buffer.from(value, "base64url").toString("utf8");
  const parts = raw.split("|");
  if (parts.length !== 2) {
    throw new Error("Invalid cursor");
  }
  const [date, id] = parts;
  if (!DATE_RE.test(date) || !UUID_RE.test(id)) {
    throw new Error("Invalid cursor");
  }
  return { date, id };
}
