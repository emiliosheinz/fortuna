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

  it("renders the four primary nav items pointing to the right routes", () => {
    renderSidebar();

    expect(screen.getByTestId("sidebar-nav-dashboard")).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByTestId("sidebar-nav-transactions")).toHaveAttribute(
      "href",
      "/transactions",
    );
    expect(screen.getByTestId("sidebar-nav-categories")).toHaveAttribute(
      "href",
      "/categories",
    );
    expect(screen.getByTestId("sidebar-nav-tags")).toHaveAttribute(
      "href",
      "/tags",
    );
  });

  it("marks Dashboard active on /", () => {
    usePathnameMock.mockReturnValue("/");

    renderSidebar();

    expect(screen.getByTestId("sidebar-nav-dashboard")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("sidebar-nav-transactions")).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks Transactions active on /transactions and its sub-routes", () => {
    usePathnameMock.mockReturnValue("/transactions");

    renderSidebar();

    expect(screen.getByTestId("sidebar-nav-transactions")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("sidebar-nav-dashboard")).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks Tags active on a /tags/[id] drill-down route", () => {
    usePathnameMock.mockReturnValue("/tags/abc");

    renderSidebar();

    expect(screen.getByTestId("sidebar-nav-tags")).toHaveAttribute(
      "aria-current",
      "page",
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
