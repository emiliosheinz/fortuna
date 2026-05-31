import { render, screen } from "@testing-library/react";
import { UserAvatar } from "../user-avatar";

describe("UserAvatar", () => {
  it("renders the avatar image when avatarUrl is provided", () => {
    render(
      <UserAvatar name="Ada Lovelace" avatarUrl="https://cdn/avatar.jpg" />,
    );

    const image = screen.getByRole("img", { name: /ada lovelace/i });
    expect(image).toHaveAttribute("src", "https://cdn/avatar.jpg");
  });

  it("renders initials from the first and last words when avatarUrl is null", () => {
    render(<UserAvatar name="Ada Lovelace" avatarUrl={null} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTestId("user-avatar-initials")).toHaveTextContent("AL");
  });

  it("uses first and last words for names with more than two parts", () => {
    render(<UserAvatar name="Augusta Ada King-Noel" avatarUrl={null} />);

    expect(screen.getByTestId("user-avatar-initials")).toHaveTextContent("AK");
  });

  it("falls back to the first letter when the name is a single word", () => {
    render(<UserAvatar name="Ada" avatarUrl={null} />);

    expect(screen.getByTestId("user-avatar-initials")).toHaveTextContent("A");
  });

  it("renders an empty initials placeholder for empty names", () => {
    render(<UserAvatar name="" avatarUrl={null} />);

    const initials = screen.getByTestId("user-avatar-initials");
    expect(initials).toHaveTextContent("");
    expect(initials).toHaveAttribute("aria-hidden", "true");
  });

  it("uppercases lowercase initials", () => {
    render(<UserAvatar name="ada lovelace" avatarUrl={null} />);

    expect(screen.getByTestId("user-avatar-initials")).toHaveTextContent("AL");
  });

  it("trims surrounding whitespace before deriving initials", () => {
    render(<UserAvatar name="  Ada   Lovelace  " avatarUrl={null} />);

    expect(screen.getByTestId("user-avatar-initials")).toHaveTextContent("AL");
  });
});
