import { render, screen } from "@testing-library/react";
import TermsPage from "../page";

describe("Terms of Service page", () => {
  const renderPage = async () => {
    const Resolved = await TermsPage();
    render(Resolved);
  };

  it("renders the page heading", async () => {
    await renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: /terms of service/i }),
    ).toBeInTheDocument();
  });

  it("shows a visible Last updated date header", async () => {
    await renderPage();
    expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
  });

  it("states that signing in constitutes acceptance of the terms", async () => {
    await renderPage();
    expect(
      screen.getByText(/signing in.*constitutes? acceptance/i),
    ).toBeInTheDocument();
  });

  it("disclaims financial advice", async () => {
    await renderPage();
    expect(screen.getByText(/not.*financial advice/i)).toBeInTheDocument();
  });

  it("describes account termination", async () => {
    await renderPage();
    expect(
      screen.getByRole("heading", { name: /termination/i }),
    ).toBeInTheDocument();
  });
});
