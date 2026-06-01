import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CLEAR_SESSION_PATH } from "@/lib/api-client";
import { navigateTo } from "@/lib/navigate";
import { usersApi } from "@/lib/users/api-client";
import { DeleteAccountForm } from "../delete-account-form";

jest.mock("@/lib/users/api-client", () => {
  const actual = jest.requireActual("@/lib/users/api-client");
  return {
    ...actual,
    usersApi: { deleteAccount: jest.fn() },
  };
});
jest.mock("@/lib/navigate", () => ({ navigateTo: jest.fn() }));

const deleteAccountMock = usersApi.deleteAccount as jest.MockedFunction<
  typeof usersApi.deleteAccount
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
    deleteAccountMock.mockReset();
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

  it("calls deleteAccount and navigates to clear-session on success", async () => {
    deleteAccountMock.mockResolvedValueOnce(undefined);

    renderForm();

    fireEvent.change(screen.getByLabelText(/type.+to confirm/i), {
      target: { value: "DELETE" },
    });
    fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));

    await waitFor(() => expect(deleteAccountMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(navigateToMock).toHaveBeenCalledWith(CLEAR_SESSION_PATH),
    );
  });

  it("surfaces an inline error when the request fails", async () => {
    deleteAccountMock.mockRejectedValueOnce(new Error("boom"));

    renderForm();

    fireEvent.change(screen.getByLabelText(/type.+to confirm/i), {
      target: { value: "DELETE" },
    });
    fireEvent.click(screen.getByRole("button", { name: /delete my account/i }));

    await waitFor(() =>
      expect(screen.getByTestId("delete-account-error")).toBeInTheDocument(),
    );
    expect(navigateToMock).not.toHaveBeenCalled();
  });
});
