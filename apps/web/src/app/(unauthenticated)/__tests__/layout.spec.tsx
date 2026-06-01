import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookie-names";
import UnauthenticatedLayout from "../layout";

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

const cookiesMock = cookies as jest.MockedFunction<typeof cookies>;
const redirectMock = redirect as jest.MockedFunction<typeof redirect>;

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function cookieStore(present: boolean): CookieStore {
  return {
    has: (name: string) => name === SESSION_COOKIE_NAME && present,
  } as unknown as CookieStore;
}

describe("UnauthenticatedLayout", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    redirectMock.mockReset();
  });

  it("redirects to / when the session cookie is present", async () => {
    cookiesMock.mockResolvedValueOnce(cookieStore(true));
    redirectMock.mockImplementation(() => {
      throw new Error("REDIRECT");
    });

    await expect(
      UnauthenticatedLayout({ children: <div>child</div> }),
    ).rejects.toThrow("REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("renders children when the session cookie is absent", async () => {
    cookiesMock.mockResolvedValueOnce(cookieStore(false));

    const result = await UnauthenticatedLayout({
      children: <div data-testid="child">child</div>,
    });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });
});
