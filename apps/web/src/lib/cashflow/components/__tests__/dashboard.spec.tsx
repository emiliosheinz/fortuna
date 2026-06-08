import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import {
  useBaseCurrency,
  useSummary,
  useTransactions,
  useTrend,
} from "../../hooks";
import type { ListTransactionsPage } from "../../types";
import { Dashboard } from "../dashboard";

jest.mock("../../hooks", () => ({
  useBaseCurrency: jest.fn(),
  useSummary: jest.fn(),
  useTrend: jest.fn(),
  useTransactions: jest.fn(),
}));

const useBaseCurrencyMock = useBaseCurrency as jest.MockedFunction<
  typeof useBaseCurrency
>;
const useSummaryMock = useSummary as jest.MockedFunction<typeof useSummary>;
const useTrendMock = useTrend as jest.MockedFunction<typeof useTrend>;
const useTransactionsMock = useTransactions as jest.MockedFunction<
  typeof useTransactions
>;

function pending<T>() {
  return {
    data: undefined,
    isPending: true,
    isError: false,
  } as unknown as T;
}

function errored<T>() {
  return {
    data: undefined,
    isPending: false,
    isError: true,
  } as unknown as T;
}

function summarySuccess(
  data: ReturnType<typeof useSummary>["data"],
): ReturnType<typeof useSummary> {
  return {
    data,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useSummary>;
}

function trendSuccess(
  data: ReturnType<typeof useTrend>["data"],
): ReturnType<typeof useTrend> {
  return {
    data,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useTrend>;
}

function transactionsSuccess(
  items: ListTransactionsPage["items"],
): ReturnType<typeof useTransactions> {
  return {
    data: { pages: [{ items, nextCursor: null }], pageParams: [undefined] },
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useTransactions>;
}

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Dashboard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useBaseCurrencyMock.mockReset();
  useSummaryMock.mockReset();
  useTrendMock.mockReset();
  useTransactionsMock.mockReset();
  useBaseCurrencyMock.mockReturnValue({
    data: { baseCurrency: "BRL" },
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useBaseCurrency>);
  useSummaryMock.mockReturnValue(
    summarySuccess({
      month: "2026-06",
      baseCurrency: "BRL",
      income: "0.00",
      expense: "0.00",
      net: "0.00",
      byCategory: [],
      excludedUnconvertibleCount: 0,
    }),
  );
  useTrendMock.mockReturnValue(
    trendSuccess({
      from: "2026-01",
      to: "2026-06",
      baseCurrency: "BRL",
      points: [],
      excludedUnconvertibleCount: 0,
    }),
  );
  useTransactionsMock.mockReturnValue(transactionsSuccess([]));
});

describe("Dashboard", () => {
  it("renders four cards each pointing at its deep-dive route", () => {
    renderDashboard();

    const thisMonth = screen.getByTestId("dashboard-this-month");
    expect(within(thisMonth).getByRole("link")).toHaveAttribute(
      "href",
      "/summary",
    );

    const trend = screen.getByTestId("dashboard-trend");
    expect(within(trend).getByRole("link")).toHaveAttribute("href", "/trend");

    const where = screen.getByTestId("dashboard-where-it-went");
    expect(within(where).getByRole("link")).toHaveAttribute("href", "/summary");

    const recent = screen.getByTestId("dashboard-recent-activity");
    expect(within(recent).getByRole("link")).toHaveAttribute(
      "href",
      "/transactions",
    );
  });

  it("shows a dashboard-wide skeleton while the base currency is loading", () => {
    useBaseCurrencyMock.mockReturnValue(
      pending<ReturnType<typeof useBaseCurrency>>(),
    );

    renderDashboard();

    expect(screen.getByTestId("dashboard-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-grid")).not.toBeInTheDocument();
  });

  it("shows a dashboard-wide error when the base currency fails", () => {
    useBaseCurrencyMock.mockReturnValue(
      errored<ReturnType<typeof useBaseCurrency>>(),
    );

    renderDashboard();

    expect(screen.getByTestId("dashboard-error")).toBeInTheDocument();
  });

  describe("This month card", () => {
    it("renders income, expense, and net totals", () => {
      useSummaryMock.mockReturnValue(
        summarySuccess({
          month: "2026-06",
          baseCurrency: "BRL",
          income: "50000.00",
          expense: "4177.00",
          net: "45823.00",
          byCategory: [],
          excludedUnconvertibleCount: 0,
        }),
      );

      renderDashboard();

      const card = screen.getByTestId("dashboard-this-month");
      expect(within(card).getByText("50000.00")).toBeInTheDocument();
      expect(within(card).getByText("4177.00")).toBeInTheDocument();
      expect(within(card).getByText("45823.00")).toBeInTheDocument();
    });
  });

  describe("Where it went card", () => {
    it("lists the top expense categories sorted descending, capped at five", () => {
      useSummaryMock.mockReturnValue(
        summarySuccess({
          month: "2026-06",
          baseCurrency: "BRL",
          income: "0.00",
          expense: "0.00",
          net: "0.00",
          byCategory: [
            cat("c1", "Lazer", "127.00"),
            cat("c2", "Moradia", "4000.00"),
            cat("c3", "Alimentação", "50.00"),
            cat("c4", "Saúde", "200.00"),
            cat("c5", "Transporte", "300.00"),
            cat("c6", "Educação", "75.00"),
            cat(null, "Uncategorized", "20.00"),
          ],
          excludedUnconvertibleCount: 0,
        }),
      );

      renderDashboard();

      const card = screen.getByTestId("dashboard-where-it-went");
      const items = within(card).getAllByRole("listitem");
      expect(items).toHaveLength(5);
      expect(items[0]).toHaveTextContent("Moradia");
      expect(items[1]).toHaveTextContent("Transporte");
      expect(items[2]).toHaveTextContent("Saúde");
      expect(items[3]).toHaveTextContent("Lazer");
      expect(items[4]).toHaveTextContent("Educação");
    });

    it("shows an empty state when there is no spending", () => {
      renderDashboard();

      const card = screen.getByTestId("dashboard-where-it-went");
      expect(card).toHaveTextContent(/No spending this month yet/i);
    });
  });

  describe("6-month trend card", () => {
    it("shows an empty state when every month has no activity", () => {
      useTrendMock.mockReturnValue(
        trendSuccess({
          from: "2026-01",
          to: "2026-06",
          baseCurrency: "BRL",
          points: [
            point("2026-01"),
            point("2026-02"),
            point("2026-03"),
            point("2026-04"),
            point("2026-05"),
            point("2026-06"),
          ],
          excludedUnconvertibleCount: 0,
        }),
      );

      renderDashboard();

      const card = screen.getByTestId("dashboard-trend");
      expect(card).toHaveTextContent(/No transactions in the last 6 months/i);
    });
  });

  describe("Recent activity card", () => {
    it("renders one row per recent transaction with the kind sign", () => {
      useTransactionsMock.mockReturnValue(
        transactionsSuccess([
          tx("t1", "Aluguel", "4000.00", "BRL", "expense"),
          tx("t2", "Salário", "50000.00", "BRL", "income"),
        ]),
      );

      renderDashboard();

      const card = screen.getByTestId("dashboard-recent-activity");
      const items = within(card).getAllByRole("listitem");
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent("Aluguel");
      expect(items[0]).toHaveTextContent("-4000.00");
      expect(items[1]).toHaveTextContent("Salário");
      expect(items[1]).toHaveTextContent("+50000.00");
    });

    it("shows an empty state when there are no recent transactions", () => {
      renderDashboard();

      const card = screen.getByTestId("dashboard-recent-activity");
      expect(card).toHaveTextContent(/No transactions yet/i);
    });
  });
});

function cat(id: string | null, name: string, expense: string) {
  return {
    categoryId: id,
    categoryName: name,
    income: "0.00",
    expense,
    net: `-${expense}`,
  };
}

function point(month: string) {
  return { month, income: "0.00", expense: "0.00", net: "0.00" };
}

function tx(
  id: string,
  description: string,
  amount: string,
  currency: string,
  kind: "income" | "expense",
): ListTransactionsPage["items"][number] {
  return {
    id,
    date: "2026-06-07",
    amount,
    currency,
    description,
    kind,
    categoryId: null,
    tagIds: [],
    baseAmount: amount,
    baseCurrency: "BRL",
    rateSubstituted: false,
    rateDate: null,
    unconvertible: false,
    group: null,
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
  };
}
