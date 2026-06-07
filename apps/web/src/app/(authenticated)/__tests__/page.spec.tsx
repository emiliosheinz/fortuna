import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import Page from "../page";

jest.mock("@/lib/cashflow/components/capture-form", () => ({
  CaptureForm: ({ baseCurrency }: { baseCurrency: string }) => (
    <div data-testid="capture-form-stub">{baseCurrency}</div>
  ),
}));

jest.mock("@/lib/cashflow/components/transaction-list", () => ({
  TransactionList: () => <div data-testid="transaction-list-stub" />,
}));

jest.mock("@/lib/cashflow/hooks", () => ({
  useBaseCurrency: jest.fn(),
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

describe("Authenticated home page (cashflow surface)", () => {
  beforeEach(() => {
    useBaseCurrencyMock.mockReset();
  });

  it("renders the capture form and list once the base currency loads", () => {
    useBaseCurrencyMock.mockReturnValue({
      data: { baseCurrency: "USD" },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useBaseCurrency>);

    renderPage();

    expect(screen.getByTestId("capture-form-stub")).toHaveTextContent("USD");
    expect(screen.getByTestId("transaction-list-stub")).toBeInTheDocument();
    expect(screen.getByText(/Rolled up into USD/)).toBeInTheDocument();
  });

  it("shows a loading skeleton while the base currency is loading", () => {
    useBaseCurrencyMock.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    } as unknown as ReturnType<typeof useBaseCurrency>);

    renderPage();

    expect(screen.queryByTestId("capture-form-stub")).not.toBeInTheDocument();
  });

  it("shows an error message when the base currency query fails", () => {
    useBaseCurrencyMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    } as unknown as ReturnType<typeof useBaseCurrency>);

    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      /Could not load your cashflow/i,
    );
  });
});
