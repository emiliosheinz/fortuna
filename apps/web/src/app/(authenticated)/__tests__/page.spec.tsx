import { render, screen } from "@testing-library/react";
import Page from "../page";

describe("Dashboard page", () => {
  it("renders the dashboard heading", () => {
    render(<Page />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument();
  });
});
