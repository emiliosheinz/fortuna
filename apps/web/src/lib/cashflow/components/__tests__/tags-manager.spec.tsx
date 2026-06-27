import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApiError } from "@/lib/api-client";
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

  it("scrolls the create error into view when the API rejects", async () => {
    useIsMobileMock.mockReturnValue(true);
    (cashflowApi.createTag as jest.Mock).mockRejectedValue(new ApiError(500));
    const scrollIntoView = jest
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => undefined);
    try {
      renderManager();

      fireEvent.change(screen.getByLabelText(/new tag name/i), {
        target: { value: "Lisbon" },
      });
      fireEvent.submit(screen.getByTestId("tag-create-form"));

      const errorEl = await screen.findByText(/could not create tag/i);
      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalled();
      });
      const matchingCall = scrollIntoView.mock.calls.find(
        (_call, idx) => scrollIntoView.mock.instances[idx] === errorEl,
      );
      expect(matchingCall?.[0]).toEqual({
        block: "center",
        behavior: "smooth",
      });
    } finally {
      scrollIntoView.mockRestore();
    }
  });

  it("scrolls the rename error into view when the API rejects", async () => {
    useIsMobileMock.mockReturnValue(true);
    (cashflowApi.renameTag as jest.Mock).mockRejectedValue(new ApiError(500));
    const scrollIntoView = jest
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => undefined);
    try {
      renderManager();

      await waitFor(() => {
        expect(screen.getByLabelText("Rename Travel")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByLabelText("Rename Travel"));

      const dialog = screen.getByRole("dialog");
      const form = dialog.querySelector("form");
      if (!form) throw new Error("rename form missing");
      fireEvent.submit(form);

      const errorEl = await screen.findByText(/could not rename tag/i);
      await waitFor(() => {
        expect(scrollIntoView).toHaveBeenCalled();
      });
      const matchingCall = scrollIntoView.mock.calls.find(
        (_call, idx) => scrollIntoView.mock.instances[idx] === errorEl,
      );
      expect(matchingCall?.[0]).toEqual({
        block: "center",
        behavior: "smooth",
      });
    } finally {
      scrollIntoView.mockRestore();
    }
  });
});
