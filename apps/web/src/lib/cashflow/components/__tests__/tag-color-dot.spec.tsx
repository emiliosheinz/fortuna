import { render, screen } from "@testing-library/react";
import { TagColorDot } from "../tag-color-dot";

describe("TagColorDot", () => {
  it("renders with a tag palette CSS var for a real key", () => {
    render(<TagColorDot color="amber" />);
    const dot = screen.getByTestId("tag-color-dot");
    expect(dot.style.background).toBe("var(--tag-color-amber)");
    expect(dot).toHaveAttribute("data-color", "amber");
  });

  it("resolves null to the muted-foreground fallback for the Untagged bucket", () => {
    render(<TagColorDot color={null} />);
    const dot = screen.getByTestId("tag-color-dot");
    expect(dot.style.background).toBe("var(--muted-foreground)");
    expect(dot).toHaveAttribute("data-color", "untagged");
  });

  it("labels itself for assistive tech when a label is provided", () => {
    render(<TagColorDot color="sky" label="tag color: sky" />);
    expect(screen.getByLabelText("tag color: sky")).toBeInTheDocument();
  });
});
