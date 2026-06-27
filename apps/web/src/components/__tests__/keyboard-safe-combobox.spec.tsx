import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { cashflowApi } from "@/lib/cashflow/api-client";
import { KeyboardSafeCombobox } from "../keyboard-safe-combobox";

jest.mock("@/lib/cashflow/api-client", () => ({
  cashflowApi: {
    listCategories: jest.fn(),
    createCategory: jest.fn(),
    listTransactions: jest.fn(),
    createTransaction: jest.fn(),
    updateTransaction: jest.fn(),
    deleteTransaction: jest.fn(),
    renameCategory: jest.fn(),
    deleteCategory: jest.fn(),
    listTags: jest.fn(),
    createTag: jest.fn(),
    renameTag: jest.fn(),
    deleteTag: jest.fn(),
    getBaseCurrency: jest.fn(),
    setBaseCurrency: jest.fn(),
  },
}));

const listCategoriesMock = cashflowApi.listCategories as jest.MockedFunction<
  typeof cashflowApi.listCategories
>;
const createCategoryMock = cashflowApi.createCategory as jest.MockedFunction<
  typeof cashflowApi.createCategory
>;

beforeEach(() => {
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0);
    return 0;
  });
  listCategoriesMock.mockReset();
  createCategoryMock.mockReset();
  listCategoriesMock.mockResolvedValue({
    items: [
      { id: "cat_1", name: "Groceries" },
      { id: "cat_2", name: "Travel" },
    ],
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function renderCombobox(
  options: {
    value?: string | null;
    onChange?: (next: string | null) => void;
  } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onChange = options.onChange ?? jest.fn();
  return {
    onChange,
    ...render(
      <QueryClientProvider client={client}>
        <input data-testid="outside-input" />
        <KeyboardSafeCombobox
          value={options.value ?? null}
          onChange={onChange}
          id="category"
        />
      </QueryClientProvider>,
    ),
  };
}

describe("KeyboardSafeCombobox", () => {
  it("renders a button trigger with the placeholder when no value is selected", () => {
    renderCombobox();
    const trigger = screen.getByTestId("keyboard-safe-combobox-trigger");
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveTextContent(/pick or create a category/i);
    expect(trigger).toHaveAttribute("id", "category");
  });

  it("renders the selected category name on the trigger when a value is selected", async () => {
    renderCombobox({ value: "cat_2" });
    await waitFor(() => {
      expect(
        screen.getByTestId("keyboard-safe-combobox-trigger"),
      ).toHaveTextContent("Travel");
    });
  });

  it("dismisses the keyboard before opening the popover", async () => {
    renderCombobox();
    const outsideInput = screen.getByTestId(
      "outside-input",
    ) as HTMLInputElement;
    const blurSpy = jest.spyOn(outsideInput, "blur");
    outsideInput.focus();
    expect(document.activeElement).toBe(outsideInput);

    fireEvent.click(screen.getByTestId("keyboard-safe-combobox-trigger"));

    expect(blurSpy).toHaveBeenCalled();
  });

  it("picks a category, calls onChange, and closes the popover", async () => {
    const { onChange } = renderCombobox();

    fireEvent.click(screen.getByTestId("keyboard-safe-combobox-trigger"));

    const option = await screen.findByRole("button", { name: "Groceries" });
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith("cat_1");
  });

  it("offers a create action when the query has no exact match", async () => {
    createCategoryMock.mockResolvedValue({
      category: { id: "cat_new", name: "Coffee" },
    });
    const { onChange } = renderCombobox();

    fireEvent.click(screen.getByTestId("keyboard-safe-combobox-trigger"));

    const search = await screen.findByTestId("keyboard-safe-combobox-search");
    fireEvent.change(search, { target: { value: "Coffee" } });

    const create = await screen.findByTestId("keyboard-safe-combobox-create");
    fireEvent.click(create);

    await waitFor(() => {
      expect(createCategoryMock).toHaveBeenCalledWith("Coffee");
    });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("cat_new");
    });
  });

  it("clears the selection when the clear button is pressed", async () => {
    const { onChange } = renderCombobox({ value: "cat_2" });

    await waitFor(() => {
      expect(
        screen.getByTestId("keyboard-safe-combobox-clear"),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("keyboard-safe-combobox-clear"));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
