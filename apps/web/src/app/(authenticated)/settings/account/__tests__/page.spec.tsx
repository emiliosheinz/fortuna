import { render, screen } from "@testing-library/react";
import { useAuth } from "@/components/auth/auth-guard";
import Page from "../page";

jest.mock("@/components/auth/auth-guard", () => ({ useAuth: jest.fn() }));
jest.mock("@/components/delete-account-form", () => ({
  DeleteAccountForm: () => <div data-testid="delete-account-form" />,
}));

const useAuthMock = useAuth as jest.MockedFunction<typeof useAuth>;

describe("Account settings page", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it("renders the signed-in user's profile and the danger zone", () => {
    useAuthMock.mockReturnValue({
      id: "u_1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      avatarUrl: null,
    });

    render(<Page />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("danger-zone")).toBeInTheDocument();
    expect(screen.getByTestId("delete-account-form")).toBeInTheDocument();
  });
});
