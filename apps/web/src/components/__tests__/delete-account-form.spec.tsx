import { fireEvent, render, screen } from "@testing-library/react";
import { DeleteAccountForm } from "../delete-account-form";

jest.mock("@/lib/auth/actions", () => ({
  __esModule: true,
  deleteAccountAction: jest.fn(),
}));

describe("DeleteAccountForm", () => {
  it("disables the destructive submit until the confirmation phrase matches", () => {
    render(<DeleteAccountForm />);

    const submit = screen.getByTestId(
      "delete-account-submit",
    ) as HTMLButtonElement;
    const input = screen.getByTestId(
      "delete-confirmation-input",
    ) as HTMLInputElement;

    expect(submit.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "delete" } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "DELETE" } });
    expect(submit.disabled).toBe(false);
  });
});
