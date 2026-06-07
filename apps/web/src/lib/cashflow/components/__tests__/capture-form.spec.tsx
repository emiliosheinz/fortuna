import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api-client";
import { cashflowApi } from "../../api-client";
import { CaptureForm } from "../capture-form";

jest.mock("../../api-client", () => ({
  cashflowApi: {
    createTransaction: jest.fn(),
    listTransactions: jest.fn(),
    getBaseCurrency: jest.fn(),
    setBaseCurrency: jest.fn(),
    listCategories: jest.fn(),
    createCategory: jest.fn(),
    renameCategory: jest.fn(),
    deleteCategory: jest.fn(),
    listTags: jest.fn(),
    createTag: jest.fn(),
    renameTag: jest.fn(),
    deleteTag: jest.fn(),
  },
}));

const createTransactionMock =
  cashflowApi.createTransaction as jest.MockedFunction<
    typeof cashflowApi.createTransaction
  >;
const listCategoriesMock = cashflowApi.listCategories as jest.MockedFunction<
  typeof cashflowApi.listCategories
>;
const listTagsMock = cashflowApi.listTags as jest.MockedFunction<
  typeof cashflowApi.listTags
>;

function renderForm(baseCurrency = "USD") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CaptureForm baseCurrency={baseCurrency} />
    </QueryClientProvider>,
  );
}

function setAmount(value: string) {
  fireEvent.change(screen.getByLabelText(/amount/i), {
    target: { value },
  });
}

function setDescription(value: string) {
  fireEvent.change(screen.getByLabelText(/description/i), {
    target: { value },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /save transaction/i }));
}

describe("CaptureForm", () => {
  beforeEach(() => {
    createTransactionMock.mockReset();
    listCategoriesMock.mockReset();
    listTagsMock.mockReset();
    listCategoriesMock.mockResolvedValue({ items: [] });
    listTagsMock.mockResolvedValue({ items: [] });
  });

  it("blocks submission when fields are invalid", async () => {
    renderForm();

    submit();

    await waitFor(() => {
      expect(
        screen.getByText(/non-negative amount with up to two decimals/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/add a description/i)).toBeInTheDocument();
    expect(createTransactionMock).not.toHaveBeenCalled();
  });

  it("submits the validated payload when the form is well-formed", async () => {
    createTransactionMock.mockResolvedValue({
      transaction: {
        id: "tx_1",
        date: "2026-06-07",
        amount: "12.34",
        currency: "USD",
        description: "Lunch",
        kind: "expense",
        categoryId: null,
        tagIds: [],
        baseAmount: "12.34",
        baseCurrency: "USD",
        rateSubstituted: false,
        rateDate: "2026-06-07",
        unconvertible: false,
        createdAt: "now",
        updatedAt: "now",
      },
    });
    renderForm();

    setAmount("12.34");
    setDescription("  Lunch  ");
    submit();

    await waitFor(() => {
      expect(createTransactionMock).toHaveBeenCalledTimes(1);
    });
    const payload = createTransactionMock.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      amount: "12.34",
      currency: "USD",
      description: "Lunch",
      kind: "expense",
      categoryId: null,
      tagNames: [],
    });
    expect(payload?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("surfaces a generic submission error when the API fails", async () => {
    createTransactionMock.mockRejectedValue(new ApiError(500));
    renderForm();

    setAmount("12.34");
    setDescription("Lunch");
    submit();

    expect(
      await screen.findByTestId("capture-form-submit-error"),
    ).toHaveTextContent(/could not save/i);
  });

  it("offers only the supported currencies in the picker", () => {
    renderForm();

    const trigger = screen.getByTestId("capture-form-currency-trigger");
    expect(trigger).toBeInTheDocument();
    // The Select is closed by default; SelectValue shows the current code.
    expect(trigger).toHaveTextContent(/USD/);
  });

  it("sends typed tag names as part of the payload", async () => {
    createTransactionMock.mockResolvedValue({
      transaction: {
        id: "tx_1",
        date: "2026-06-07",
        amount: "12.34",
        currency: "USD",
        description: "Lunch",
        kind: "expense",
        categoryId: null,
        tagIds: [],
        baseAmount: "12.34",
        baseCurrency: "USD",
        rateSubstituted: false,
        rateDate: "2026-06-07",
        unconvertible: false,
        createdAt: "now",
        updatedAt: "now",
      },
    });
    renderForm();

    setAmount("12.34");
    setDescription("Lunch");
    const tagInput = screen.getByTestId("tag-input-draft") as HTMLInputElement;
    fireEvent.change(tagInput, { target: { value: "travel" } });
    fireEvent.keyDown(tagInput, { key: "Enter" });
    fireEvent.change(tagInput, { target: { value: "lisbon" } });
    fireEvent.keyDown(tagInput, { key: "Enter" });
    submit();

    await waitFor(() => {
      expect(createTransactionMock).toHaveBeenCalledTimes(1);
    });
    const payload = createTransactionMock.mock.calls[0]?.[0];
    expect(payload?.tagNames).toEqual(["travel", "lisbon"]);
  });
});
