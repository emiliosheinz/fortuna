import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { cashflowApi } from "../../api-client";
import type { ListTransactionsPage } from "../../types";
import { TransactionList } from "../transaction-list";

jest.mock("../../api-client", () => ({
  cashflowApi: {
    createTransaction: jest.fn(),
    listTransactions: jest.fn(),
    getBaseCurrency: jest.fn(),
    setBaseCurrency: jest.fn(),
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

  it("surfaces an error UI when the request fails", async () => {
    listMock.mockRejectedValue(new Error("boom"));

    renderList();

    await waitFor(() => {
      expect(screen.getByTestId("transaction-list-error")).toBeInTheDocument();
    });
  });
});
