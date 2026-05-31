import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CLEAR_SESSION_PATH } from "@/lib/api-client";
import { signOut } from "@/lib/auth/sign-out";
import { navigateTo } from "@/lib/navigate";
import { SignOutButton } from "../sign-out-button";

jest.mock("@/lib/auth/sign-out", () => ({ signOut: jest.fn() }));
jest.mock("@/lib/navigate", () => ({ navigateTo: jest.fn() }));

const signOutMock = signOut as jest.MockedFunction<typeof signOut>;
const navigateToMock = navigateTo as jest.MockedFunction<typeof navigateTo>;

function renderButton(): ReturnType<typeof render> {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SignOutButton />
    </QueryClientProvider>,
  );
}

describe("SignOutButton", () => {
  beforeEach(() => {
    signOutMock.mockReset();
    navigateToMock.mockReset();
  });

  it("calls signOut and navigates to clear-session on success", async () => {
    signOutMock.mockResolvedValueOnce(undefined);

    renderButton();

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(navigateToMock).toHaveBeenCalledWith(CLEAR_SESSION_PATH),
    );
  });

  it("surfaces an error inline when signOut fails", async () => {
    signOutMock.mockRejectedValueOnce(new Error("boom"));

    renderButton();

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() =>
      expect(screen.getByTestId("sign-out-error")).toBeInTheDocument(),
    );
    expect(navigateToMock).not.toHaveBeenCalled();
  });
});
