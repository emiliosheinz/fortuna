import { render, screen, within } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import Page from "../page";

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
}));

const useSearchParamsMock = useSearchParams as jest.MockedFunction<
  typeof useSearchParams
>;

function searchParams(query: string) {
  return new URLSearchParams(query) as unknown as ReturnType<
    typeof useSearchParams
  >;
}

describe("Sign-in Page (/auth/sign-in)", () => {
  beforeEach(() => {
    useSearchParamsMock.mockReturnValue(searchParams(""));
  });

  it("renders the Fortuna logo", () => {
    render(<Page />);
    const logo = screen.getByAltText("Fortuna");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute(
      "src",
      expect.stringContaining("fortuna-logo"),
    );
  });

  it("renders the product headline", () => {
    render(<Page />);
    expect(
      screen.getByRole("heading", { name: /take control of your finances/i }),
    ).toBeInTheDocument();
  });

  it("renders a Continue with Google CTA that triggers full-page navigation to /api/auth/sign-in", () => {
    render(<Page />);
    const cta = screen.getByRole("link", { name: /continue with google/i });
    expect(cta).toHaveAttribute("href", "/api/auth/sign-in");
  });

  it("renders the Google G mark inside the CTA", () => {
    render(<Page />);
    const cta = screen.getByRole("link", { name: /continue with google/i });
    const mark = cta.querySelector("img[src*='google-g']");
    expect(mark).not.toBeNull();
  });

  it("links the consent notice to the Privacy Policy and Terms of Service", () => {
    render(<Page />);
    const notice = screen.getByText(/by signing in you agree/i);

    const privacyLink = within(notice).getByRole("link", {
      name: /privacy policy/i,
    });
    expect(privacyLink).toHaveAttribute("href", "/privacy");

    const termsLink = within(notice).getByRole("link", {
      name: /terms of service/i,
    });
    expect(termsLink).toHaveAttribute("href", "/terms");
  });

  it("shows the error banner when ?sign_in_error is set", () => {
    useSearchParamsMock.mockReturnValue(
      searchParams("sign_in_error=exchange_failed"),
    );
    render(<Page />);
    expect(screen.getByRole("alert")).toHaveTextContent(/sign in failed/i);
  });

  it("does not show the error banner without ?sign_in_error", () => {
    render(<Page />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
