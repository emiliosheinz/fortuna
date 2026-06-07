import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { useBaseCurrency } from "@/lib/cashflow/hooks";
import { NewTransactionFab } from "../new-transaction-fab";

jest.mock("@/lib/cashflow/hooks", () => ({
  useBaseCurrency: jest.fn(),
}));

jest.mock("@/lib/cashflow/components/capture-form", () => ({
  CaptureForm: ({ baseCurrency }: { baseCurrency: string }) => (
    <div data-testid="capture-form">capture-form:{baseCurrency}</div>
  ),
}));

const useBaseCurrencyMock = useBaseCurrency as jest.MockedFunction<
  typeof useBaseCurrency
>;

function renderFab() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NewTransactionFab />
    </QueryClientProvider>,
  );
}

describe("NewTransactionFab", () => {
  beforeEach(() => {
    useBaseCurrencyMock.mockReset();
  });

  it("opens a dialog containing the capture form when the FAB is clicked", () => {
    useBaseCurrencyMock.mockReturnValue({
      data: { baseCurrency: "USD" },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useBaseCurrency>);

    renderFab();

    fireEvent.click(screen.getByTestId("open-capture-dialog"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("capture-form")).toHaveTextContent(
      "capture-form:USD",
    );
  });

  it("renders a loading placeholder while the base currency is pending", () => {
    useBaseCurrencyMock.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    } as unknown as ReturnType<typeof useBaseCurrency>);

    renderFab();

    fireEvent.click(screen.getByTestId("open-capture-dialog"));

    expect(screen.queryByTestId("capture-form")).not.toBeInTheDocument();
  });

  it("surfaces an inline error when the base currency fails to load", () => {
    useBaseCurrencyMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    } as unknown as ReturnType<typeof useBaseCurrency>);

    renderFab();

    fireEvent.click(screen.getByTestId("open-capture-dialog"));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByTestId("capture-form")).not.toBeInTheDocument();
  });
});
