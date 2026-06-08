import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { cashflowApi } from "../../api-client";
import type { ListTransactionsPage } from "../../types";
import { TransactionList } from "../transaction-list";

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

const listMock = cashflowApi.listTransactions as jest.MockedFunction<
  typeof cashflowApi.listTransactions
>;

function renderList() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TransactionList />
    </QueryClientProvider>,
  );
}

const baseRow = {
  id: "tx_1",
  date: "2026-06-07",
  amount: "12.34",
  currency: "USD",
  description: "Lunch",
  kind: "expense" as const,
  categoryId: null,
  tagIds: [],
  baseAmount: "12.34",
  baseCurrency: "USD",
  rateSubstituted: false,
  rateDate: "2026-06-07",
  unconvertible: false,
  group: null,
  createdAt: "2026-06-07T00:00:00Z",
  updatedAt: "2026-06-07T00:00:00Z",
};

describe("TransactionList", () => {
  beforeEach(() => {
    listMock.mockReset();
    // jsdom does not implement IntersectionObserver out of the box.
    (
      window as unknown as { IntersectionObserver: typeof IntersectionObserver }
    ).IntersectionObserver = class {
      observe = jest.fn();
      disconnect = jest.fn();
      unobserve = jest.fn();
      takeRecords = jest.fn(() => []);
      root = null;
      rootMargin = "";
      thresholds = [];
    } as unknown as typeof IntersectionObserver;
  });

  it("shows the skeleton placeholder while loading", () => {
    listMock.mockReturnValue(
      new Promise<ListTransactionsPage>(() => undefined),
    );

    renderList();

    expect(screen.getByTestId("transaction-list-loading")).toBeInTheDocument();
  });

  it("shows the empty state when there are no rows", async () => {
    listMock.mockResolvedValue({ items: [], nextCursor: null });

    renderList();

    expect(
      await screen.findByTestId("transaction-list-empty"),
    ).toBeInTheDocument();
  });

  it("renders rows when the page returns data", async () => {
    listMock.mockResolvedValue({ items: [baseRow], nextCursor: null });

    renderList();

    expect(await screen.findByText("Lunch")).toBeInTheDocument();
    expect(screen.getByText(/-12\.34 USD/)).toBeInTheDocument();
  });

  it("shows the base-currency rollup for a foreign-currency row", async () => {
    listMock.mockResolvedValue({
      items: [
        {
          ...baseRow,
          currency: "EUR",
          baseAmount: "13.33",
          baseCurrency: "USD",
        },
      ],
      nextCursor: null,
    });

    renderList();

    expect(
      await screen.findByTestId("transaction-row-base-amount"),
    ).toHaveTextContent(/13\.33 USD/);
  });

  it("renders the rate-substituted badge with the rate date in the title", async () => {
    listMock.mockResolvedValue({
      items: [
        {
          ...baseRow,
          currency: "EUR",
          baseAmount: "13.33",
          baseCurrency: "USD",
          rateSubstituted: true,
          rateDate: "2026-06-05",
        },
      ],
      nextCursor: null,
    });

    renderList();

    const badge = await screen.findByTestId(
      "transaction-row-substituted-badge",
    );
    expect(badge).toHaveAttribute(
      "title",
      expect.stringContaining("2026-06-05"),
    );
  });

  it("renders the unconvertible badge when no rate path exists", async () => {
    listMock.mockResolvedValue({
      items: [
        {
          ...baseRow,
          currency: "XYZ",
          baseAmount: null,
          baseCurrency: "USD",
          rateSubstituted: false,
          rateDate: null,
          unconvertible: true,
        },
      ],
      nextCursor: null,
    });

    renderList();

    expect(
      await screen.findByTestId("transaction-row-unconvertible-badge"),
    ).toBeInTheDocument();
  });

  it("renders the i of N badge for an installment row and links to the group filter", async () => {
    listMock.mockResolvedValue({
      items: [
        {
          ...baseRow,
          group: { id: "grp_1", position: 2, size: 4 },
        },
      ],
      nextCursor: null,
    });

    renderList();

    const badge = await screen.findByTestId("transaction-row-group-badge");
    expect(badge).toHaveTextContent("2 of 4");
    expect(badge).toHaveAttribute("href", "/transactions?groupId=grp_1");
  });

  it("does not render the group badge for a standalone row", async () => {
    listMock.mockResolvedValue({ items: [baseRow], nextCursor: null });

    renderList();

    expect(await screen.findByText("Lunch")).toBeInTheDocument();
    expect(
      screen.queryByTestId("transaction-row-group-badge"),
    ).not.toBeInTheDocument();
  });

  it("surfaces an error UI when the request fails", async () => {
    listMock.mockRejectedValue(new Error("boom"));

    renderList();

    await waitFor(() => {
      expect(screen.getByTestId("transaction-list-error")).toBeInTheDocument();
    });
  });
});
