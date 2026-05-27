import { render, screen, within } from "@testing-library/react";
import Page from "../page";

describe("Home Page", () => {
  it("renders the app name", () => {
    render(<Page />);
    expect(screen.getByText("Fortuna")).toBeInTheDocument();
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
});
