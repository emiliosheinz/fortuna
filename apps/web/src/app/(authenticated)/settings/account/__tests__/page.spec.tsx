import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { useAuth } from "@/components/auth/auth-guard";
import Page from "../page";

jest.mock("@/components/auth/auth-guard", () => ({ useAuth: jest.fn() }));
jest.mock("@/components/delete-account-form", () => ({
  DeleteAccountForm: () => <div data-testid="delete-account-form" />,
}));

jest.mock("@/lib/cashflow/hooks", () => ({
  useBaseCurrency: jest.fn(),
  useSetBaseCurrency: jest.fn(),
}));

import { useBaseCurrency, useSetBaseCurrency } from "@/lib/cashflow/hooks";

const useAuthMock = useAuth as jest.MockedFunction<typeof useAuth>;
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

describe("Account settings page", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    useBaseCurrencyMock.mockReset();
    useSetBaseCurrencyMock.mockReset();
    useAuthMock.mockReturnValue({
      me: {
        id: "u_1",
        name: "Ada Lovelace",
        email: "ada@example.com",
        avatarUrl: null,
      },
    });
    useSetBaseCurrencyMock.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({ baseCurrency: "USD" }),
      isPending: false,
    } as unknown as ReturnType<typeof useSetBaseCurrency>);
  });

  it("renders the signed-in user's profile, base currency section, and the danger zone", () => {
    useBaseCurrencyMock.mockReturnValue({
      data: { baseCurrency: "USD" },
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useBaseCurrency>);

    renderPage();

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("base-currency-section")).toBeInTheDocument();
    expect(screen.getByTestId("base-currency-form")).toBeInTheDocument();
    expect(screen.getByTestId("danger-zone")).toBeInTheDocument();
    expect(screen.getByTestId("delete-account-form")).toBeInTheDocument();
  });

  it("shows a skeleton while the base currency is loading", () => {
    useBaseCurrencyMock.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    } as unknown as ReturnType<typeof useBaseCurrency>);

    renderPage();

    expect(screen.queryByTestId("base-currency-form")).not.toBeInTheDocument();
  });
});
