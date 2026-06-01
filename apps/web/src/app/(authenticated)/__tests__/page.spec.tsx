import { render, screen } from "@testing-library/react";
import { useAuth } from "@/components/auth/auth-guard";
import Page from "../page";

jest.mock("@/components/auth/auth-guard", () => ({ useAuth: jest.fn() }));

const useAuthMock = useAuth as jest.MockedFunction<typeof useAuth>;

describe("Authenticated root page", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it("renders the signed-in user's name and email", () => {
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
  });
});
