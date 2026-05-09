import { render, screen } from "@testing-library/react";
import Page from "../page";

describe("Home Page", () => {
  it("renders the app name", () => {
    render(<Page />);
    expect(screen.getByText("Fortuna")).toBeInTheDocument();
  });
});
