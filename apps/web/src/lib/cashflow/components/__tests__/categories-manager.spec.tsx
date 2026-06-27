import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-mobile";
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
});
