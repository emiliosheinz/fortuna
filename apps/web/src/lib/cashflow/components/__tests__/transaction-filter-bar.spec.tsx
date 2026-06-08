import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  groupId: null,
  kind: null,
  q: null,
};

function renderBar(
  props: {
    value?: TransactionFilterState;
    onChange?: (s: TransactionFilterState) => void;
    searchDebounceMs?: number;
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
        searchDebounceMs={props.searchDebounceMs ?? 0}
      />
    </QueryClientProvider>,
  );
}

describe("TransactionFilterBar", () => {
  beforeEach(() => {
    listCategoriesMock.mockResolvedValue({
      items: [
        { id: "cat-food", name: "Food" },
        { id: "cat-transport", name: "Transport" },
      ],
    });
    listTagsMock.mockResolvedValue({
      items: [{ id: "tag-travel", name: "travel" }],
    });
  });

  it("commits the search input after the debounce window", async () => {
    const onChange = jest.fn();
    renderBar({ onChange });
    fireEvent.change(screen.getByTestId("transaction-filter-q"), {
      target: { value: "coffee" },
    });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({ ...emptyState, q: "coffee" });
    });
  });

  it("debounces rapid keystrokes into a single commit", async () => {
    const onChange = jest.fn();
    renderBar({ onChange, searchDebounceMs: 50 });
    const input = screen.getByTestId("transaction-filter-q");
    fireEvent.change(input, { target: { value: "c" } });
    fireEvent.change(input, { target: { value: "co" } });
    fireEvent.change(input, { target: { value: "cof" } });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({ ...emptyState, q: "cof" });
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("hides Clear all when no filter is active", () => {
    renderBar({ value: emptyState });
    expect(
      screen.queryByTestId("transaction-filter-clear"),
    ).not.toBeInTheDocument();
  });

  it("renders a chip for each active filter and resolves the category name", async () => {
    renderBar({
      value: { ...emptyState, categoryId: "cat-food", kind: "expense" },
    });
    expect(
      screen.getByTestId("transaction-filter-chip-category"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("transaction-filter-chip-kind"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByTestId("transaction-filter-chip-category"),
      ).toHaveTextContent("Food");
    });
  });

  it("clears every filter when Clear all is pressed", () => {
    const onChange = jest.fn();
    renderBar({
      value: { ...emptyState, kind: "expense", q: "coffee" },
      onChange,
    });
    fireEvent.click(screen.getByTestId("transaction-filter-clear"));
    expect(onChange).toHaveBeenCalledWith(emptyState);
  });

  it("removes only the targeted filter when its chip × is clicked", () => {
    const onChange = jest.fn();
    renderBar({
      value: { ...emptyState, kind: "expense", categoryId: "cat-food" },
      onChange,
    });
    fireEvent.click(screen.getByTestId("transaction-filter-chip-kind-remove"));
    expect(onChange).toHaveBeenCalledWith({
      ...emptyState,
      categoryId: "cat-food",
    });
  });
});
