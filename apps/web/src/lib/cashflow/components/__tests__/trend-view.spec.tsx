import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { cashflowApi } from "../../api-client";
import { TrendView } from "../trend-view";

jest.mock("../../api-client", () => ({
  cashflowApi: {
    getTrend: jest.fn(),
  },
}));

const getTrendMock = cashflowApi.getTrend as jest.MockedFunction<
  typeof cashflowApi.getTrend
>;

function renderView(
  props: {
    from?: string | null;
    to?: string | null;
    onWindowChange?: (w: { from: string | null; to: string | null }) => void;
  } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TrendView
        from={props.from ?? null}
        to={props.to ?? null}
        onWindowChange={props.onWindowChange ?? jest.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("TrendView", () => {
  beforeEach(() => {
    getTrendMock.mockReset();
  });

  it("renders one row per month point with income, expense, and net", async () => {
    getTrendMock.mockResolvedValue({
      from: "2026-04",
      to: "2026-06",
      baseCurrency: "USD",
      points: [
        { month: "2026-04", income: "0.00", expense: "100.00", net: "-100.00" },
        { month: "2026-05", income: "0.00", expense: "0.00", net: "0.00" },
        { month: "2026-06", income: "200.00", expense: "50.00", net: "150.00" },
      ],
      excludedUnconvertibleCount: 0,
    });
    renderView({ from: "2026-04", to: "2026-06" });
    const rows = await screen.findAllByTestId("trend-row");
    expect(rows).toHaveLength(3);
    expect(rows[2]).toHaveTextContent("150.00");
  });

  it("shows the empty state when every point is zero", async () => {
    getTrendMock.mockResolvedValue({
      from: "2026-06",
      to: "2026-06",
      baseCurrency: "USD",
      points: [
        { month: "2026-06", income: "0.00", expense: "0.00", net: "0.00" },
      ],
      excludedUnconvertibleCount: 0,
    });
    renderView({ from: "2026-06", to: "2026-06" });
    expect(await screen.findByTestId("trend-empty")).toBeInTheDocument();
  });

  it("warns when some rows are excluded as unconvertible", async () => {
    getTrendMock.mockResolvedValue({
      from: "2026-06",
      to: "2026-06",
      baseCurrency: "USD",
      points: [
        { month: "2026-06", income: "0.00", expense: "10.00", net: "-10.00" },
      ],
      excludedUnconvertibleCount: 1,
    });
    renderView({ from: "2026-06", to: "2026-06" });
    expect(
      await screen.findByTestId("trend-unconvertible-note"),
    ).toHaveTextContent(/1 transaction is excluded/);
  });

  it("notifies the parent when the from input changes", async () => {
    getTrendMock.mockResolvedValue({
      from: "2026-04",
      to: "2026-06",
      baseCurrency: "USD",
      points: [],
      excludedUnconvertibleCount: 0,
    });
    const onWindowChange = jest.fn();
    renderView({ from: "2026-04", to: "2026-06", onWindowChange });
    await screen.findByTestId("trend-empty");
    fireEvent.change(screen.getByTestId("trend-from-input"), {
      target: { value: "2026-03" },
    });
    expect(onWindowChange).toHaveBeenCalledWith({
      from: "2026-03",
      to: "2026-06",
    });
  });
});
