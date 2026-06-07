import { render, screen } from "@testing-library/react";
import Page from "../page";

jest.mock("@/lib/sessions/components/sessions-section", () => ({
  SessionsSection: () => <div data-testid="sessions-section" />,
}));

describe("Sessions page", () => {
  it("renders the sessions heading and mounts the SessionsSection", () => {
    render(<Page />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Sessions" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("sessions-section")).toBeInTheDocument();
  });
});
