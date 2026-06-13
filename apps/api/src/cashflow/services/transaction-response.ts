import type { FxResolution } from "@/fx/services/fx-lookup.service";
import type {
  Transaction,
  TransactionKind,
} from "../entities/transaction.entity";
import type { GroupContext } from "./group-context";

export interface TransactionResponse {
  id: string;
  date: string;
  amount: string;
  currency: string;
  description: string;
  kind: TransactionKind;
  categoryId: string | null;
  tagIds: string[];
  baseAmount: string | null;
  baseCurrency: string;
  rateSubstituted: boolean;
  rateDate: string | null;
  unconvertible: boolean;
  group: GroupContext | null;
  createdAt: string;
  updatedAt: string;
}

export function transactionToResponse(
  row: Transaction,
  tagIds: string[],
  baseCurrency: string,
  resolution: FxResolution,
  group: GroupContext | null = null,
): TransactionResponse {
  const unconvertible = resolution.unconvertible;
  const baseAmount = unconvertible
    ? null
    : multiplyAndRound(row.amount, resolution.rate);
  return {
    id: row.id,
    date: row.date,
    amount: row.amount,
    currency: row.currency,
    description: row.description,
    kind: row.kind,
    categoryId: row.categoryId,
    tagIds,
    baseAmount,
    baseCurrency,
    rateSubstituted: unconvertible ? false : resolution.substituted,
    rateDate: unconvertible ? null : resolution.rateDate,
    unconvertible,
    group,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function multiplyAndRound(amount: string, rate: string): string | null {
  const value = Number(amount) * Number(rate);
  if (!Number.isFinite(value)) return null;
  return value.toFixed(2);
}
