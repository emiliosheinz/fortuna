import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cashflowApi } from "../../api-client";
import type { Transaction } from "../../types";
import { TransactionEditDialog } from "../transaction-edit-dialog";

jest.mock("@/hooks/use-mobile", () => ({ useIsMobile: jest.fn() }));
jest.mock("../../api-client", () => ({
  cashflowApi: {
    createTransaction: jest.fn(),
    updateTransaction: jest.fn(),
    deleteTransaction: jest.fn(),
    listTransactions: jest.fn(),
    getBaseCurrency: jest.fn(),
    setBaseCurrency: jest.fn(),
    listCategories: jest.fn().mockResolvedValue({ items: [] }),
    createCategory: jest.fn(),
    renameCategory: jest.fn(),
    deleteCategory: jest.fn(),
    listTags: jest.fn().mockResolvedValue({ items: [] }),
    createTag: jest.fn(),
    renameTag: jest.fn(),
    deleteTag: jest.fn(),
  },
}));

const useIsMobileMock = useIsMobile as jest.MockedFunction<typeof useIsMobile>;

const baseTransaction: Transaction = {
  id: "tx_1",
  date: "2026-06-07",
  amount: "12.34",
  currency: "USD",
  description: "Lunch",
  kind: "expense",
  categoryId: null,
  tagIds: [],
  baseAmount: "12.34",
  baseCurrency: "USD",
  rateSubstituted: false,
  rateDate: "2026-06-07",
  unconvertible: false,
  group: null,
  createdAt: "now",
  updatedAt: "now",
};

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TransactionEditDialog
        transaction={baseTransaction}
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  );
}

describe("TransactionEditDialog", () => {
  beforeEach(() => {
    useIsMobileMock.mockReset();
    (cashflowApi.listCategories as jest.Mock).mockResolvedValue({ items: [] });
    (cashflowApi.listTags as jest.Mock).mockResolvedValue({ items: [] });
  });

  it("renders the bottom Sheet on mobile so the keyboard stays clear of fields", () => {
    useIsMobileMock.mockReturnValue(true);
    renderDialog();
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toMatch(/slide-in-from-bottom/);
  });

  it("renders the centered Dialog on desktop", () => {
    useIsMobileMock.mockReturnValue(false);
    renderDialog();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-slot", "dialog-content");
  });
});
