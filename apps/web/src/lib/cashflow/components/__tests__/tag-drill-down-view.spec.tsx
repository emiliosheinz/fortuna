import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { cashflowApi } from "../../api-client";
import type { Transaction } from "../../types";
import { TagDrillDownView } from "../tag-drill-down-view";

jest.mock("../../api-client", () => ({
  cashflowApi: {
    getTagDrillDown: jest.fn(),
  },
}));

jest.mock("../month-range-picker", () => ({
  MonthRangePicker: ({
    id,
    value,
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
      defaultValue={value.from ?? ""}
      readOnly
    />
  ),
}));

const getTagDrillDownMock = cashflowApi.getTagDrillDown as jest.MockedFunction<
  typeof cashflowApi.getTagDrillDown
>;

const tx: Transaction = {
  id: "tx-1",
  date: "2026-06-07",
  amount: "12.34",
  currency: "USD",
  description: "Coffee",
  kind: "expense",
  tagIds: ["tag-1"],
  baseAmount: "12.34",
  baseCurrency: "USD",
  rateSubstituted: false,
  rateDate: "2026-06-07",
  unconvertible: false,
  group: null,
  createdAt: "2026-06-07T00:00:00Z",
  updatedAt: "2026-06-07T00:00:00Z",
};

function renderView() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TagDrillDownView
        tagId="tag-1"
        from={null}
        to={null}
        onWindowChange={jest.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("TagDrillDownView", () => {
  beforeEach(() => {
    getTagDrillDownMock.mockReset();
  });

  it("renders the tag name, transactions, and the month breakdown on success", async () => {
    getTagDrillDownMock.mockResolvedValue({
      tag: { id: "tag-1", name: "travel" },
      baseCurrency: "USD",
      from: null,
      to: null,
      transactions: [tx],
      byMonth: [
        { month: "2026-06", income: "0.00", expense: "12.34", net: "-12.34" },
      ],
      excludedUnconvertibleCount: 0,
    });

    renderView();

    expect(await screen.findByText("# travel")).toBeInTheDocument();
    expect(screen.getByText("Coffee")).toBeInTheDocument();
    expect(screen.getByTestId("tag-drill-down-by-month")).toHaveTextContent(
      "Jun 2026",
    );
  });

  it("shows the empty state when there are no linked transactions", async () => {
    getTagDrillDownMock.mockResolvedValue({
      tag: { id: "tag-1", name: "travel" },
      baseCurrency: "USD",
      from: null,
      to: null,
      transactions: [],
      byMonth: [],
      excludedUnconvertibleCount: 0,
    });

    renderView();
    expect(
      await screen.findByTestId("tag-drill-down-empty"),
    ).toBeInTheDocument();
  });

  it("surfaces an error UI on failure", async () => {
    getTagDrillDownMock.mockRejectedValue(new Error("boom"));
    renderView();
    expect(
      await screen.findByTestId("tag-drill-down-error"),
    ).toBeInTheDocument();
  });
});
