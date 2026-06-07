import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { cashflowApi } from "../../api-client";
import { TrendView } from "../trend-view";

jest.mock("../../api-client", () => ({
  cashflowApi: {
    getTrend: jest.fn(),
  },
}));

jest.mock("../month-range-picker", () => ({
  MonthRangePicker: ({
    id,
    value,
    onChange,
    "data-testid": testId,
  }: {
    id?: string;
    value: { from: string | null; to: string | null };
    onChange: (v: { from: string | null; to: string | null }) => void;
    "data-testid"?: string;
  }) => (
    <input
      id={id}
      data-testid={testId}
      value={value.from ?? ""}
      onChange={(e) => onChange({ from: e.target.value || null, to: value.to })}
    />
  ),
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

  it("renders the chart when the window contains non-zero points", async () => {
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
    expect(await screen.findByTestId("trend-chart")).toBeInTheDocument();
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

  it("notifies the parent when the range picker emits a new from bound", async () => {
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
    fireEvent.change(screen.getByTestId("trend-range-input"), {
      target: { value: "2026-03" },
    });
    expect(onWindowChange).toHaveBeenCalledWith({
      from: "2026-03",
      to: "2026-06",
    });
  });
});
