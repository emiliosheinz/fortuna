import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { useBaseCurrency, useSetBaseCurrency } from "@/lib/cashflow/hooks";
import Page from "../page";

jest.mock("@/lib/cashflow/hooks", () => ({
  useBaseCurrency: jest.fn(),
  useSetBaseCurrency: jest.fn(),
}));

const useBaseCurrencyMock = useBaseCurrency as jest.MockedFunction<
  typeof useBaseCurrency
>;
const useSetBaseCurrencyMock = useSetBaseCurrency as jest.MockedFunction<
  typeof useSetBaseCurrency
>;

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>,
  );
}

describe("Settings preferences page", () => {
  beforeEach(() => {
    useBaseCurrencyMock.mockReset();
    useSetBaseCurrencyMock.mockReset();
    useSetBaseCurrencyMock.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({ baseCurrency: "USD" }),
      isPending: false,
    } as unknown as ReturnType<typeof useSetBaseCurrency>);
  });

  it("renders the base currency form when data has loaded", () => {
    useBaseCurrencyMock.mockReturnValue({
      data: { baseCurrency: "USD" },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useBaseCurrency>);

    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("base-currency-section")).toBeInTheDocument();
    expect(screen.getByTestId("base-currency-form")).toBeInTheDocument();
  });

  it("hides the form while the base currency is loading", () => {
    useBaseCurrencyMock.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    } as unknown as ReturnType<typeof useBaseCurrency>);

    renderPage();

    expect(screen.queryByTestId("base-currency-form")).not.toBeInTheDocument();
  });
});
