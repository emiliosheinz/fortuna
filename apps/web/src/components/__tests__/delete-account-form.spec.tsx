import { fireEvent, render, screen } from "@testing-library/react";
import { DeleteAccountForm } from "../delete-account-form";

jest.mock("@/lib/auth/actions", () => ({
  __esModule: true,
  deleteAccountAction: jest.fn(),
}));

describe("DeleteAccountForm", () => {
  it("disables the destructive submit until the confirmation phrase matches", () => {
    render(<DeleteAccountForm />);

    const submit = screen.getByRole("button", { name: /delete my account/i });
    const input = screen.getByLabelText(/type.+to confirm/i);

    expect(submit).toBeDisabled();

    fireEvent.change(input, { target: { value: "delete" } });
    expect(submit).toBeDisabled();

    fireEvent.change(input, { target: { value: "DELETE" } });
    expect(submit).toBeEnabled();
  });
});
