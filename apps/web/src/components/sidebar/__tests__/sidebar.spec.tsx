import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { CLEAR_SESSION_PATH } from "@/lib/api-client";
import { signOut } from "@/lib/auth/sign-out";
import { navigateTo } from "@/lib/navigate";
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

jest.mock("@/lib/auth/sign-out", () => ({ signOut: jest.fn() }));
jest.mock("@/lib/navigate", () => ({ navigateTo: jest.fn() }));

const signOutMock = signOut as jest.MockedFunction<typeof signOut>;
const navigateToMock = navigateTo as jest.MockedFunction<typeof navigateTo>;

const me: CurrentUser = {
  id: "u_1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  avatarUrl: null,
};

function renderSidebar(
  options: { defaultOpen?: boolean } = {},
): ReturnType<typeof render> {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SidebarProvider defaultOpen={options.defaultOpen ?? true}>
        <Sidebar me={me} />
      </SidebarProvider>
    </QueryClientProvider>,
  );
}

function openIdentityMenu(): void {
  const trigger = screen.getByTestId("sidebar-identity");
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
}

describe("Sidebar", () => {
  beforeEach(() => {
    setThemeMock.mockReset();
    usePathnameMock.mockReset();
    usePathnameMock.mockReturnValue("/");
    signOutMock.mockReset();
    navigateToMock.mockReset();
    window.localStorage.clear();
  });

  it("shows the user's name and email on the identity trigger", () => {
    renderSidebar();

    const identity = screen.getByTestId("sidebar-identity");
    expect(identity).toHaveAttribute("aria-label", "Account menu");
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
  });

  it("marks Tags active on a /tags/[id] drill-down route", () => {
    usePathnameMock.mockReturnValue("/tags/abc");

    renderSidebar();

    expect(screen.getByTestId("sidebar-nav-tags")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("opens the identity popover with Account, Settings, Sessions, and Sign out", async () => {
    renderSidebar();

    openIdentityMenu();

    expect(await screen.findByTestId("identity-menu-account")).toHaveAttribute(
      "href",
      "/settings/account",
    );
    expect(screen.getByTestId("identity-menu-settings")).toHaveAttribute(
      "href",
      "/settings/preferences",
    );
    expect(screen.getByTestId("identity-menu-sessions")).toHaveAttribute(
      "href",
      "/settings/sessions",
    );
    expect(screen.getByTestId("identity-menu-sign-out")).toBeInTheDocument();
  });

  it("calls signOut and navigates to the clear-session endpoint when Sign out is selected", async () => {
    signOutMock.mockResolvedValueOnce(undefined);

    renderSidebar();

    openIdentityMenu();

    fireEvent.click(await screen.findByTestId("identity-menu-sign-out"));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(navigateToMock).toHaveBeenCalledWith(CLEAR_SESSION_PATH),
    );
  });

  it("surfaces an inline error when sign-out fails", async () => {
    signOutMock.mockRejectedValueOnce(new Error("boom"));

    renderSidebar();

    openIdentityMenu();

    fireEvent.click(await screen.findByTestId("identity-menu-sign-out"));

    await waitFor(() =>
      expect(screen.getByTestId("sign-out-error")).toBeInTheDocument(),
    );
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it("changes theme when a theme menu item is clicked", async () => {
    renderSidebar();

    const trigger = screen.getByTestId("sidebar-theme-toggle");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });

    fireEvent.click(await screen.findByTestId("theme-dark"));

    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });

  it("flips the collapse toggle's aria-pressed and label when clicked", async () => {
    renderSidebar({ defaultOpen: true });

    const toggle = screen.getByTestId("sidebar-collapse-toggle");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAttribute("aria-label", "Collapse sidebar");

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(screen.getByTestId("sidebar-collapse-toggle")).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(screen.getByTestId("sidebar-collapse-toggle")).toHaveAttribute(
      "aria-label",
      "Expand sidebar",
    );
  });

  it("renders collapsed when defaultOpen is false", () => {
    renderSidebar({ defaultOpen: false });

    const toggle = screen.getByTestId("sidebar-collapse-toggle");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveAttribute("aria-label", "Expand sidebar");
  });
});
