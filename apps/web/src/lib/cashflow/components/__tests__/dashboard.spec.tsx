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
      byTag: [],
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
  it("renders the three remaining cards each pointing at its deep-dive route", () => {
    renderDashboard();

    const thisMonth = screen.getByTestId("dashboard-this-month");
    expect(within(thisMonth).getByRole("link")).toHaveAttribute(
      "href",
      "/summary",
    );

    const trend = screen.getByTestId("dashboard-trend");
    expect(within(trend).getByRole("link")).toHaveAttribute("href", "/trend");

    const where = screen.getByTestId("dashboard-where-it-went");
    expect(within(where).getByRole("link")).toHaveAttribute(
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
          byTag: [],
          excludedUnconvertibleCount: 0,
        }),
      );

      renderDashboard();

      const card = screen.getByTestId("dashboard-this-month");
      expect(card).toHaveTextContent("R$ 50.000,00");
      expect(card).toHaveTextContent("R$ 4.177,00");
      expect(card).toHaveTextContent("R$ 45.823,00");
    });

    it("renders the expense pie when tag buckets are present", () => {
      useSummaryMock.mockReturnValue(
        summarySuccess({
          month: "2026-06",
          baseCurrency: "BRL",
          income: "0.00",
          expense: "150.00",
          net: "-150.00",
          byTag: [tag("t1", "Food", "100.00"), tag(null, null, "50.00")],
          excludedUnconvertibleCount: 0,
        }),
      );

      renderDashboard();

      const card = screen.getByTestId("dashboard-this-month");
      expect(within(card).queryByText(/No expenses this month/i)).toBeNull();
    });

    it("omits income-only tag buckets from the expense pie", () => {
      useSummaryMock.mockReturnValue(
        summarySuccess({
          month: "2026-06",
          baseCurrency: "BRL",
          income: "500.00",
          expense: "0.00",
          net: "500.00",
          byTag: [
            {
              tagId: "t-salary",
              tagName: "salary",
              income: "500.00",
              expense: "0.00",
              net: "500.00",
            },
          ],
          excludedUnconvertibleCount: 0,
        }),
      );

      renderDashboard();

      const card = screen.getByTestId("dashboard-this-month");
      expect(within(card).getByText(/No expenses this month/i)).toBeInTheDocument();
      expect(within(card).queryByText("salary")).toBeNull();
    });
  });

  describe("Where it went card", () => {
    it("lists the largest expense transactions of the month, capped at five", () => {
      useTransactionsMock.mockReturnValue(
        transactionsSuccess([
          tx("t1", "Aluguel", "4000.00", "BRL"),
          tx("t2", "Ingresso", "320.00", "BRL"),
          tx("t3", "Compras IFD", "250.00", "BRL"),
          tx("t4", "Netflix", "50.00", "BRL"),
          tx("t5", "Uber", "35.00", "BRL"),
          tx("t6", "Cafe", "12.00", "BRL"),
        ]),
      );

      renderDashboard();

      const card = screen.getByTestId("dashboard-where-it-went");
      const items = within(card).getAllByRole("listitem");
      expect(items).toHaveLength(5);
      expect(items[0]).toHaveTextContent("Aluguel");
      expect(items[0]).toHaveTextContent("R$ 4.000,00");
      expect(items[1]).toHaveTextContent("Ingresso");
      expect(items[2]).toHaveTextContent("Compras IFD");
      expect(items[3]).toHaveTextContent("Netflix");
      expect(items[4]).toHaveTextContent("Uber");
    });

    it("shows an empty state when there are no expenses this month", () => {
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
});

function tag(id: string | null, name: string | null, expense: string) {
  return {
    tagId: id,
    tagName: name,
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
): ListTransactionsPage["items"][number] {
  return {
    id,
    date: "2026-06-07",
    amount,
    currency,
    description,
    kind: "expense",
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
