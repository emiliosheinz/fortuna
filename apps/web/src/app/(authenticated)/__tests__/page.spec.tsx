import { render, screen } from "@testing-library/react";
import { useAuth } from "@/components/auth/auth-guard";
import Page from "../page";

jest.mock("@/components/auth/auth-guard", () => ({ useAuth: jest.fn() }));
jest.mock("@/components/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

const useAuthMock = useAuth as jest.MockedFunction<typeof useAuth>;

describe("Authenticated root page", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it("renders the signed-in user's name, email, and nav links", () => {
    useAuthMock.mockReturnValue({
      me: {
        id: "u_1",
        name: "Ada Lovelace",
        email: "ada@example.com",
        avatarUrl: null,
      },
    });

    render(<Page />);

    expect(screen.getByText(/welcome, ada lovelace/i)).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /manage sessions/i }),
    ).toHaveAttribute("href", "/settings/sessions");
    expect(screen.getByRole("link", { name: /account/i })).toHaveAttribute(
      "href",
      "/settings/account",
    );
  });
});
