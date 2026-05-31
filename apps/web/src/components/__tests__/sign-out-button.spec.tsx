import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { apiClient, CLEAR_SESSION_PATH } from "@/lib/api-client";
import { navigateTo } from "@/lib/navigate";
import { SignOutButton } from "../sign-out-button";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return {
    ...actual,
    apiClient: { delete: jest.fn() },
  };
});
jest.mock("@/lib/navigate", () => ({ navigateTo: jest.fn() }));

const deleteMock = apiClient.delete as jest.MockedFunction<
  typeof apiClient.delete
>;
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
    deleteMock.mockReset();
    navigateToMock.mockReset();
  });

  it("DELETEs /api/auth/session and navigates to clear-session on success", async () => {
    deleteMock.mockResolvedValueOnce(undefined);

    renderButton();

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith("/api/auth/session"),
    );
    await waitFor(() =>
      expect(navigateToMock).toHaveBeenCalledWith(CLEAR_SESSION_PATH),
    );
  });
});
