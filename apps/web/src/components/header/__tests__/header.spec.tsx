import { render, screen, within } from "@testing-library/react";
import type { CurrentUser } from "@/lib/users/api-client";
import { Header } from "../header";

jest.mock("../avatar-menu", () => ({
  AvatarMenu: ({ me }: { me: CurrentUser }) => (
    <div data-testid="avatar-menu" data-user-id={me.id} />
  ),
}));

const me: CurrentUser = {
  id: "u_1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  avatarUrl: null,
};

describe("Header", () => {
  it("renders the Fortuna wordmark linking back to /", () => {
    render(<Header me={me} />);

    const banner = screen.getByRole("banner");
    const homeLink = within(banner).getByRole("link", { name: "Fortuna" });
    expect(homeLink).toHaveAttribute("href", "/");
    expect(within(banner).queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders the avatar menu with the current user", () => {
    render(<Header me={me} />);

    const menu = screen.getByTestId("avatar-menu");
    expect(menu).toHaveAttribute("data-user-id", "u_1");
  });
});
