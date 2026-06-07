import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { cashflowApi } from "../../api-client";
import { SummaryView } from "../summary-view";

jest.mock("../../api-client", () => ({
  cashflowApi: {
    getSummary: jest.fn(),
  },
}));

const getSummaryMock = cashflowApi.getSummary as jest.MockedFunction<
  typeof cashflowApi.getSummary
>;

function renderView(
  props: { month?: string; onMonthChange?: (m: string) => void } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SummaryView
        month={props.month ?? "2026-06"}
        onMonthChange={props.onMonthChange ?? jest.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("SummaryView", () => {
  beforeEach(() => {
    getSummaryMock.mockReset();
  });

  it("shows the skeleton while the data is loading", () => {
    getSummaryMock.mockReturnValue(new Promise(() => undefined));
    renderView();
    expect(screen.getByTestId("summary-loading")).toBeInTheDocument();
  });

  it("renders totals and the per-category breakdown on success", async () => {
    getSummaryMock.mockResolvedValue({
      month: "2026-06",
      baseCurrency: "USD",
      income: "1000.00",
      expense: "300.00",
      net: "700.00",
      byCategory: [
        {
          categoryId: "cat-1",
          categoryName: "Food",
          income: "0.00",
          expense: "200.00",
          net: "-200.00",
        },
        {
          categoryId: null,
          categoryName: null,
          income: "0.00",
          expense: "100.00",
          net: "-100.00",
        },
      ],
      excludedUnconvertibleCount: 0,
    });

    renderView();

    expect(await screen.findByTestId("summary-total-income")).toHaveTextContent(
      "1000.00",
    );
    expect(screen.getByTestId("summary-total-expense")).toHaveTextContent(
      "300.00",
    );
    expect(screen.getByTestId("summary-total-net")).toHaveTextContent("700.00");
    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText("Uncategorized")).toBeInTheDocument();
  });

  it("warns when some rows are excluded as unconvertible", async () => {
    getSummaryMock.mockResolvedValue({
      month: "2026-06",
      baseCurrency: "USD",
      income: "0.00",
      expense: "100.00",
      net: "-100.00",
      byCategory: [
        {
          categoryId: null,
          categoryName: null,
          income: "0.00",
          expense: "100.00",
          net: "-100.00",
        },
      ],
      excludedUnconvertibleCount: 2,
    });

    renderView();
    const note = await screen.findByTestId("summary-unconvertible-note");
    expect(note).toHaveTextContent(/2 transactions are excluded/);
  });

  it("notifies the parent when the month input changes", async () => {
    const onMonthChange = jest.fn();
    getSummaryMock.mockResolvedValue({
      month: "2026-06",
      baseCurrency: "USD",
      income: "0.00",
      expense: "0.00",
      net: "0.00",
      byCategory: [],
      excludedUnconvertibleCount: 0,
    });

    renderView({ onMonthChange });
    await waitFor(() =>
      expect(screen.getByTestId("summary-empty")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByTestId("summary-month-input"), {
      target: { value: "2026-05" },
    });
    expect(onMonthChange).toHaveBeenCalledWith("2026-05");
  });

  it("surfaces an error UI when the request fails", async () => {
    getSummaryMock.mockRejectedValue(new Error("boom"));
    renderView();
    expect(await screen.findByTestId("summary-error")).toBeInTheDocument();
  });
});
