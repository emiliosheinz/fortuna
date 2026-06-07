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
  },
}));

const createTransactionMock =
  cashflowApi.createTransaction as jest.MockedFunction<
    typeof cashflowApi.createTransaction
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
});
