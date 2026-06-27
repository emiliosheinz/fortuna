import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cashflowApi } from "../../api-client";
import { TagsManager } from "../tags-manager";

jest.mock("@/hooks/use-mobile", () => ({ useIsMobile: jest.fn() }));
jest.mock("../../api-client", () => ({
  cashflowApi: {
    listTags: jest.fn(),
    createTag: jest.fn(),
    renameTag: jest.fn(),
    deleteTag: jest.fn(),
  },
}));

const useIsMobileMock = useIsMobile as jest.MockedFunction<typeof useIsMobile>;
const listTagsMock = cashflowApi.listTags as jest.MockedFunction<
  typeof cashflowApi.listTags
>;

function renderManager() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TagsManager />
    </QueryClientProvider>,
  );
}

describe("TagsManager rename dialog", () => {
  beforeEach(() => {
    useIsMobileMock.mockReset();
    listTagsMock.mockReset();
    listTagsMock.mockResolvedValue({
      items: [{ id: "tag_1", name: "Travel" }],
    });
  });

  it("renders the rename dialog as a bottom Sheet on mobile", async () => {
    useIsMobileMock.mockReturnValue(true);
    renderManager();

    await waitFor(() => {
      expect(screen.getByLabelText("Rename Travel")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Rename Travel"));

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toMatch(/slide-in-from-bottom/);
  });
});
