import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApiError } from "@/lib/api-client";
import { cashflowApi } from "../../api-client";
import { CategoriesManager } from "../categories-manager";

jest.mock("@/hooks/use-mobile", () => ({ useIsMobile: jest.fn() }));
jest.mock("../../api-client", () => ({
  cashflowApi: {
    listCategories: jest.fn(),
    createCategory: jest.fn(),
    renameCategory: jest.fn(),
    deleteCategory: jest.fn(),
  },
}));

const useIsMobileMock = useIsMobile as jest.MockedFunction<typeof useIsMobile>;
const listCategoriesMock = cashflowApi.listCategories as jest.MockedFunction<
  typeof cashflowApi.listCategories
>;

function renderManager() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CategoriesManager />
    </QueryClientProvider>,
  );
}

describe("CategoriesManager rename dialog", () => {
  beforeEach(() => {
    useIsMobileMock.mockReset();
    listCategoriesMock.mockReset();
    listCategoriesMock.mockResolvedValue({
      items: [{ id: "cat_1", name: "Food" }],
    });
  });

  it("renders the rename dialog as a bottom Sheet on mobile", async () => {
    useIsMobileMock.mockReturnValue(true);
    renderManager();

    await waitFor(() => {
      expect(screen.getByLabelText("Rename Food")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Rename Food"));

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toMatch(/slide-in-from-bottom/);
  });

  it("scrolls the create error into view when the API rejects", async () => {
    useIsMobileMock.mockReturnValue(true);
    (cashflowApi.createCategory as jest.Mock).mockRejectedValue(
      new ApiError(500),
    );
    const scrollIntoView = jest
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => undefined);
    try {
      renderManager();

      fireEvent.change(screen.getByLabelText(/new category name/i), {
        target: { value: "Bills" },
      });
      fireEvent.submit(screen.getByTestId("category-create-form"));

      const errorEl = await screen.findByText(/could not create category/i);
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
    (cashflowApi.renameCategory as jest.Mock).mockRejectedValue(
      new ApiError(500),
    );
    const scrollIntoView = jest
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => undefined);
    try {
      renderManager();

      await waitFor(() => {
        expect(screen.getByLabelText("Rename Food")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByLabelText("Rename Food"));

      const dialog = screen.getByRole("dialog");
      const form = dialog.querySelector("form");
      if (!form) throw new Error("rename form missing");
      fireEvent.submit(form);

      const errorEl = await screen.findByText(/could not rename category/i);
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
