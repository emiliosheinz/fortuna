import { render, screen } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { MobileHeader } from "../mobile-header";

function renderHeader() {
  return render(
    <SidebarProvider>
      <MobileHeader />
    </SidebarProvider>,
  );
}

describe("MobileHeader", () => {
  it("renders a sticky bar that is hidden on md and up", () => {
    renderHeader();

    const bar = screen.getByTestId("mobile-header");
    expect(bar).toHaveClass("sticky", "md:hidden");
  });

  it("exposes a trigger labelled for opening the navigation menu", () => {
    renderHeader();

    const trigger = screen.getByTestId("mobile-sidebar-trigger");
    expect(trigger).toHaveAttribute("aria-label", "Open navigation menu");
  });
});
