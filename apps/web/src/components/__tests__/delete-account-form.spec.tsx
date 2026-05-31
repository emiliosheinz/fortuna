import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { apiClient, CLEAR_SESSION_PATH } from "@/lib/api-client";
import { navigateTo } from "@/lib/navigate";
import { DeleteAccountForm } from "../delete-account-form";

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

function renderForm(): ReturnType<typeof render> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <DeleteAccountForm />
    </QueryClientProvider>,
  );
}

describe("DeleteAccountForm", () => {
  beforeEach(() => {
    deleteMock.mockReset();
    navigateToMock.mockReset();
  });

  it("disables the destructive submit until the confirmation phrase matches", () => {
    renderForm();

    const submit = screen.getByRole("button", { name: /delete my account/i });
    const input = screen.getByLabelText(/type.+to confirm/i);

    expect(submit).toBeDisabled();

    fireEvent.change(input, { target: { value: "delete" } });
    expect(submit).toBeDisabled();

    fireEvent.change(input, { target: { value: "DELETE" } });
    expect(submit).toBeEnabled();
  });

  it("DELETEs /api/users/me with confirm:true and navigates to clear-session on success", async () => {
    deleteMock.mockResolvedValueOnce(undefined);

    renderForm();

    fireEvent.change(screen.getByLabelText(/type.+to confirm/i), {
      target: { value: "DELETE" },
    });
    fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));

    await waitFor(() =>
      expect(deleteMock).toHaveBeenCalledWith("/api/users/me", {
        body: { confirm: true },
      }),
    );
    await waitFor(() =>
      expect(navigateToMock).toHaveBeenCalledWith(CLEAR_SESSION_PATH),
    );
  });
});
