import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import Page from "../page";

jest.mock("@/lib/cashflow/components/transaction-list", () => ({
  TransactionList: () => <div data-testid="transaction-list-stub" />,
}));

jest.mock("@/lib/cashflow/components/transaction-filter-bar", () => ({
  TransactionFilterBar: () => <div data-testid="filter-bar-stub" />,
}));

jest.mock("@/lib/cashflow/hooks", () => ({
  useBaseCurrency: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { useBaseCurrency } from "@/lib/cashflow/hooks";

const useBaseCurrencyMock = useBaseCurrency as jest.MockedFunction<
  typeof useBaseCurrency
>;

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>,
  );
}

describe("Transactions page", () => {
  beforeEach(() => {
    useBaseCurrencyMock.mockReset();
  });

  it("renders the transaction list and the rolled-up base currency", () => {
    useBaseCurrencyMock.mockReturnValue({
      data: { baseCurrency: "USD" },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useBaseCurrency>);

    renderPage();

    expect(screen.getByTestId("transaction-list-stub")).toBeInTheDocument();
    expect(screen.getByText(/Rolled up into USD/)).toBeInTheDocument();
    expect(screen.getByTestId("filter-bar-stub")).toBeInTheDocument();
  });

  it("shows a loading skeleton while the base currency is loading", () => {
    useBaseCurrencyMock.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    } as unknown as ReturnType<typeof useBaseCurrency>);

    renderPage();

    expect(screen.queryByText(/Rolled up into/)).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("transaction-list-stub"),
    ).not.toBeInTheDocument();
  });

  it("shows an error message when the base currency query fails", () => {
    useBaseCurrencyMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    } as unknown as ReturnType<typeof useBaseCurrency>);

    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      /Could not load your transactions/i,
    );
  });
});
