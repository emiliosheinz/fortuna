import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CLEAR_SESSION_PATH } from "@/lib/api-client";
import { signOut } from "@/lib/auth/sign-out";
import { navigateTo } from "@/lib/navigate";
import type { CurrentUser } from "@/lib/users/api-client";
import { AvatarMenu } from "../avatar-menu";

jest.mock("@/lib/auth/sign-out", () => ({ signOut: jest.fn() }));
jest.mock("@/lib/navigate", () => ({ navigateTo: jest.fn() }));
jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", setTheme: jest.fn() }),
}));

const signOutMock = signOut as jest.MockedFunction<typeof signOut>;
const navigateToMock = navigateTo as jest.MockedFunction<typeof navigateTo>;

const me: CurrentUser = {
  id: "u_1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  avatarUrl: null,
};

function renderMenu(): ReturnType<typeof render> {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AvatarMenu me={me} />
    </QueryClientProvider>,
  );
}

function openMenu(): void {
  const trigger = screen.getByRole("button", { name: /account menu/i });
  fireEvent.keyDown(trigger, { key: "Enter" });
}

describe("AvatarMenu", () => {
  beforeEach(() => {
    signOutMock.mockReset();
    navigateToMock.mockReset();
  });

  it("opens the menu and exposes Account, Sessions, Theme, and Sign out", async () => {
    renderMenu();

    openMenu();

    const account = await screen.findByRole("menuitem", { name: /account/i });
    expect(account).toHaveAttribute("href", "/settings/account");
    expect(screen.getByRole("menuitem", { name: /sessions/i })).toHaveAttribute(
      "href",
      "/settings/sessions",
    );
    expect(
      screen.getByRole("menuitem", { name: /theme/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /sign out/i }),
    ).toBeInTheDocument();
  });

  it("renders the user's name and email at the top of the menu", async () => {
    renderMenu();

    openMenu();

    await waitFor(() =>
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument(),
    );
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
  });

  it("calls signOut and navigates to clear-session when Sign out is selected", async () => {
    signOutMock.mockResolvedValueOnce(undefined);

    renderMenu();

    openMenu();

    fireEvent.click(await screen.findByRole("menuitem", { name: /sign out/i }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(navigateToMock).toHaveBeenCalledWith(CLEAR_SESSION_PATH),
    );
  });

  it("surfaces an inline error when sign out fails", async () => {
    signOutMock.mockRejectedValueOnce(new Error("boom"));

    renderMenu();

    openMenu();

    fireEvent.click(await screen.findByRole("menuitem", { name: /sign out/i }));

    await waitFor(() =>
      expect(screen.getByTestId("sign-out-error")).toBeInTheDocument(),
    );
    expect(navigateToMock).not.toHaveBeenCalled();
  });
});
