import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type CurrentUser, usersApi } from "@/lib/users/api-client";
import { AuthGuard, useAuth } from "../auth-guard";

jest.mock("@/lib/users/api-client", () => {
  const actual = jest.requireActual("@/lib/users/api-client");
  return {
    ...actual,
    usersApi: { getMe: jest.fn() },
  };
});

const getMeMock = usersApi.getMe as jest.MockedFunction<typeof usersApi.getMe>;

function renderWithClient(ui: React.ReactNode): ReturnType<typeof render> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

function ChildExposingName() {
  const { me } = useAuth();
  return <div data-testid="name">{me.name}</div>;
}

describe("AuthGuard", () => {
  beforeEach(() => {
    getMeMock.mockReset();
  });

  it("renders a loading indicator while the request is in flight", () => {
    let resolveFetch: (value: CurrentUser) => void = () => undefined;
    getMeMock.mockReturnValueOnce(
      new Promise<CurrentUser>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    renderWithClient(
      <AuthGuard>
        <ChildExposingName />
      </AuthGuard>,
    );

    expect(screen.getByTestId("auth-guard-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("name")).not.toBeInTheDocument();

    resolveFetch({
      id: "u_1",
      name: "Ada",
      email: "ada@example.com",
      avatarUrl: null,
    });
  });

  it("renders children with the user available via useAuth on success", async () => {
    getMeMock.mockResolvedValueOnce({
      id: "u_1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      avatarUrl: null,
    });

    renderWithClient(
      <AuthGuard>
        <ChildExposingName />
      </AuthGuard>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent("Ada Lovelace"),
    );
  });

  it("renders an error state with a retry button on failure", async () => {
    getMeMock.mockRejectedValueOnce(new Error("boom"));

    renderWithClient(
      <AuthGuard>
        <ChildExposingName />
      </AuthGuard>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("auth-guard-error")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("name")).not.toBeInTheDocument();

    getMeMock.mockResolvedValueOnce({
      id: "u_1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      avatarUrl: null,
    });

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() =>
      expect(screen.getByTestId("name")).toHaveTextContent("Ada Lovelace"),
    );
  });

  it("throws from useAuth when called outside the guard", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ChildExposingName />)).toThrow(
      /useAuth must be called inside/i,
    );
    spy.mockRestore();
  });
});
