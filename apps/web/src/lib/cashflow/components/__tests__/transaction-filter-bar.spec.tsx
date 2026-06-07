import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { cashflowApi } from "../../api-client";
import {
  TransactionFilterBar,
  type TransactionFilterState,
} from "../transaction-filter-bar";

jest.mock("../../api-client", () => ({
  cashflowApi: {
    listCategories: jest.fn(),
    listTags: jest.fn(),
  },
}));

jest.mock("../date-range-picker", () => ({
  DateRangePicker: ({
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

const listCategoriesMock = cashflowApi.listCategories as jest.MockedFunction<
  typeof cashflowApi.listCategories
>;
const listTagsMock = cashflowApi.listTags as jest.MockedFunction<
  typeof cashflowApi.listTags
>;

const emptyState: TransactionFilterState = {
  from: null,
  to: null,
  categoryId: null,
  tagId: null,
  kind: null,
  q: null,
};

function renderBar(
  props: {
    value?: TransactionFilterState;
    onChange?: (s: TransactionFilterState) => void;
  } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TransactionFilterBar
        value={props.value ?? emptyState}
        onChange={props.onChange ?? jest.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("TransactionFilterBar", () => {
  beforeEach(() => {
    listCategoriesMock.mockResolvedValue({ items: [] });
    listTagsMock.mockResolvedValue({ items: [] });
  });

  it("fires onChange with the new from bound when the range picker updates", () => {
    const onChange = jest.fn();
    renderBar({ onChange });
    fireEvent.change(screen.getByTestId("transaction-filter-range"), {
      target: { value: "2026-06-01" },
    });
    expect(onChange).toHaveBeenCalledWith({
      ...emptyState,
      from: "2026-06-01",
    });
  });

  it("fires onChange with updated q when the search input changes", () => {
    const onChange = jest.fn();
    renderBar({ onChange });
    fireEvent.change(screen.getByTestId("transaction-filter-q"), {
      target: { value: "coffee" },
    });
    expect(onChange).toHaveBeenCalledWith({ ...emptyState, q: "coffee" });
  });

  it("shows a clear button only when at least one filter is set", () => {
    const { rerender } = renderBar({ value: emptyState });
    expect(
      screen.queryByTestId("transaction-filter-clear"),
    ).not.toBeInTheDocument();
    rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        <TransactionFilterBar
          value={{ ...emptyState, kind: "expense" }}
          onChange={jest.fn()}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("transaction-filter-clear")).toBeInTheDocument();
  });

  it("clears every filter when the clear button is pressed", () => {
    const onChange = jest.fn();
    renderBar({
      value: { ...emptyState, kind: "expense", q: "coffee" },
      onChange,
    });
    fireEvent.click(screen.getByTestId("transaction-filter-clear"));
    expect(onChange).toHaveBeenCalledWith(emptyState);
  });
});
