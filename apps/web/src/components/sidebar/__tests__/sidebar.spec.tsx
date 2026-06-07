import { fireEvent, render, screen } from "@testing-library/react";
import type { CurrentUser } from "@/lib/users/api-client";
import { Sidebar } from "../sidebar";

const setThemeMock = jest.fn();
const usePathnameMock = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", setTheme: setThemeMock }),
}));

const me: CurrentUser = {
  id: "u_1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  avatarUrl: null,
};

function renderSidebar(): ReturnType<typeof render> {
  return render(<Sidebar me={me} />);
}

describe("Sidebar", () => {
  beforeEach(() => {
    setThemeMock.mockReset();
    usePathnameMock.mockReset();
    usePathnameMock.mockReturnValue("/");
    window.localStorage.clear();
  });

  it("renders the user identity row linking to /settings/account", () => {
    renderSidebar();

    const identity = screen.getByTestId("sidebar-identity");
    expect(identity).toHaveAttribute("href", "/settings/account");
    expect(identity).toHaveTextContent("Ada Lovelace");
    expect(identity).toHaveTextContent("ada@example.com");
  });

  it("renders the Cashflow nav link with the active state when on /", () => {
    usePathnameMock.mockReturnValue("/");

    renderSidebar();

    const link = screen.getByTestId("sidebar-nav-cashflow");
    expect(link).toHaveAttribute("href", "/");
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("does not mark Cashflow as active on a different route", () => {
    usePathnameMock.mockReturnValue("/settings/account");

    renderSidebar();

    expect(screen.getByTestId("sidebar-nav-cashflow")).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("changes theme when a theme menu item is clicked", async () => {
    renderSidebar();

    const trigger = screen.getByTestId("sidebar-theme-toggle");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });

    const darkItem = await screen.findByTestId("theme-dark");
    fireEvent.click(darkItem);

    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });

  it("collapses and persists the choice to localStorage", () => {
    renderSidebar();

    const sidebar = screen.getByTestId("sidebar");
    expect(sidebar).toHaveAttribute("data-state", "expanded");

    fireEvent.click(screen.getByTestId("sidebar-collapse-toggle"));

    expect(sidebar).toHaveAttribute("data-state", "collapsed");
    expect(window.localStorage.getItem("fortuna:sidebar:collapsed")).toBe("1");
  });

  it("restores a collapsed preference from localStorage on mount", () => {
    window.localStorage.setItem("fortuna:sidebar:collapsed", "1");

    renderSidebar();

    expect(screen.getByTestId("sidebar")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
  });
});
