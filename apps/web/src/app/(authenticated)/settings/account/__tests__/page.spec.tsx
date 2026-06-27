import { act, render, screen } from "@testing-library/react";
import { useAuth } from "@/components/auth/auth-guard";
import { useIsMobile } from "@/hooks/use-mobile";
import Page from "../page";

jest.mock("@/components/auth/auth-guard", () => ({ useAuth: jest.fn() }));
jest.mock("@/hooks/use-mobile", () => ({ useIsMobile: jest.fn() }));
jest.mock("@/components/delete-account-form", () => ({
  DeleteAccountForm: () => (
    <input data-testid="delete-account-form" defaultValue="" />
  ),
}));

const useAuthMock = useAuth as jest.MockedFunction<typeof useAuth>;
const useIsMobileMock = useIsMobile as jest.MockedFunction<typeof useIsMobile>;

describe("Account settings page", () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({
      me: {
        id: "u_1",
        name: "Ada Lovelace",
        email: "ada@example.com",
        avatarUrl: null,
      },
    });
    useIsMobileMock.mockReset();
    useIsMobileMock.mockReturnValue(false);
  });

  it("renders the profile and danger zone for the signed-in user", () => {
    render(<Page />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Account" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("danger-zone")).toBeInTheDocument();
    expect(screen.getByTestId("delete-account-form")).toBeInTheDocument();
  });

  it("scrolls the focused delete-confirmation input into view on mobile", () => {
    jest.useFakeTimers();
    try {
      useIsMobileMock.mockReturnValue(true);
      render(<Page />);

      const input = screen.getByTestId("delete-account-form");
      const scrollIntoView = jest.fn();
      input.scrollIntoView = scrollIntoView;

      act(() => {
        input.focus();
      });
      act(() => {
        jest.runAllTimers();
      });

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: "center",
        behavior: "smooth",
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not scroll focused inputs on desktop", () => {
    jest.useFakeTimers();
    try {
      useIsMobileMock.mockReturnValue(false);
      render(<Page />);

      const input = screen.getByTestId("delete-account-form");
      const scrollIntoView = jest.fn();
      input.scrollIntoView = scrollIntoView;

      act(() => {
        input.focus();
      });
      act(() => {
        jest.runAllTimers();
      });

      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
