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
    updateTag: jest.fn(),
    deleteTag: jest.fn(),
  },
}));

const useIsMobileMock = useIsMobile as jest.MockedFunction<typeof useIsMobile>;
const listTagsMock = cashflowApi.listTags as jest.MockedFunction<
  typeof cashflowApi.listTags
>;
const updateTagMock = cashflowApi.updateTag as jest.MockedFunction<
  typeof cashflowApi.updateTag
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

describe("TagsManager edit dialog", () => {
  beforeEach(() => {
    useIsMobileMock.mockReset();
    listTagsMock.mockReset();
    updateTagMock.mockReset();
    listTagsMock.mockResolvedValue({
      items: [{ id: "tag_1", name: "Travel", color: "amber" }],
    });
  });

  it("renders the edit dialog as a bottom Sheet on mobile", async () => {
    useIsMobileMock.mockReturnValue(true);
    renderManager();

    await waitFor(() => {
      expect(screen.getByLabelText("Edit Travel")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Edit Travel"));

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toMatch(/slide-in-from-bottom/);
  });

  it("renders a colored dot beside each tag row", async () => {
    useIsMobileMock.mockReturnValue(false);
    renderManager();

    await waitFor(() => {
      expect(screen.getByText("Travel")).toBeInTheDocument();
    });
    const dot = screen.getByTestId("tag-color-dot");
    expect(dot.style.background).toBe("var(--tag-color-amber)");
  });

  it("renders a ten-swatch color picker in the edit dialog", async () => {
    useIsMobileMock.mockReturnValue(false);
    renderManager();

    await waitFor(() =>
      expect(screen.getByLabelText("Edit Travel")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByLabelText("Edit Travel"));

    const picker = await screen.findByTestId("tag-color-picker");
    expect(picker.querySelectorAll("[role=radio]")).toHaveLength(10);
    const preselected = screen.getByTestId("tag-color-swatch-amber");
    expect(preselected.getAttribute("aria-checked")).toBe("true");
  });

  it("sends only color when the user picks a new palette key and Save is clicked", async () => {
    useIsMobileMock.mockReturnValue(false);
    updateTagMock.mockResolvedValue({
      tag: { id: "tag_1", name: "Travel", color: "emerald" },
    });
    renderManager();

    await waitFor(() =>
      expect(screen.getByLabelText("Edit Travel")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByLabelText("Edit Travel"));

    fireEvent.click(await screen.findByTestId("tag-color-swatch-emerald"));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(updateTagMock).toHaveBeenCalledWith("tag_1", {
        color: "emerald",
      }),
    );
  });

  it("keeps the picker open with the attempted color highlighted when PATCH fails", async () => {
    useIsMobileMock.mockReturnValue(false);
    updateTagMock.mockRejectedValue(new ApiError(500));
    renderManager();

    await waitFor(() =>
      expect(screen.getByLabelText("Edit Travel")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByLabelText("Edit Travel"));

    fireEvent.click(await screen.findByTestId("tag-color-swatch-emerald"));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not save the tag/i,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen
        .getByTestId("tag-color-swatch-emerald")
        .getAttribute("aria-checked"),
    ).toBe("true");
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

  it("scrolls the save error into view when the API rejects a color update", async () => {
    useIsMobileMock.mockReturnValue(true);
    updateTagMock.mockRejectedValue(new ApiError(500));
    const scrollIntoView = jest
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => undefined);
    try {
      renderManager();

      await waitFor(() => {
        expect(screen.getByLabelText("Edit Travel")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByLabelText("Edit Travel"));

      fireEvent.click(await screen.findByTestId("tag-color-swatch-emerald"));
      fireEvent.click(screen.getByRole("button", { name: /save/i }));

      const errorEl = await screen.findByText(/could not save the tag/i);
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
