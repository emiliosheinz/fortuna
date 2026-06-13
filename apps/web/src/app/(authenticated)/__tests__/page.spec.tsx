import { render, screen } from "@testing-library/react";
import Page from "../page";

jest.mock("@/lib/cashflow/components/dashboard", () => ({
  Dashboard: () => <div data-testid="dashboard-stub" />,
}));

describe("Dashboard page", () => {
  it("renders the dashboard heading and mounts the Dashboard component", () => {
    render(<Page />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-stub")).toBeInTheDocument();
  });
});
