import { render, screen } from "@testing-library/react";
import PrivacyPage from "../page";

describe("Privacy Policy page", () => {
  const renderPage = async () => {
    const Resolved = await PrivacyPage();
    render(Resolved);
  };

  it("renders the page heading", async () => {
    await renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: /privacy policy/i }),
    ).toBeInTheDocument();
  });

  it("shows a visible Last updated date header", async () => {
    await renderPage();
    expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
  });

  it("renders the 'Information We Collect' section", async () => {
    await renderPage();
    expect(
      screen.getByRole("heading", { name: /information we collect/i }),
    ).toBeInTheDocument();
  });

  it("describes LGPD user rights", async () => {
    await renderPage();
    expect(screen.getAllByText(/LGPD/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: /your rights/i }),
    ).toBeInTheDocument();
  });

  it("publishes the data controller contact email", async () => {
    await renderPage();
    const contactLink = screen.getByRole("link", {
      name: /emiliosheinz@gmail\.com/,
    });
    expect(contactLink).toHaveAttribute(
      "href",
      "mailto:emiliosheinz@gmail.com",
    );
  });

  it("describes account deletion", async () => {
    await renderPage();
    expect(
      screen.getByRole("heading", { name: /account deletion/i }),
    ).toBeInTheDocument();
  });

  it("mentions Google OAuth for sign-in", async () => {
    await renderPage();
    expect(screen.getAllByText(/google sign-in/i).length).toBeGreaterThan(0);
  });
});
