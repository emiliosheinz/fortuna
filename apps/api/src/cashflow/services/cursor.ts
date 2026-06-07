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
  const [date, id, ...rest] = raw.split("|");
  if (!date || !id || rest.length > 0) {
    throw new Error("Invalid cursor");
  }
  if (!DATE_RE.test(date) || !UUID_RE.test(id)) {
    throw new Error("Invalid cursor");
  }
  return { date, id };
}
