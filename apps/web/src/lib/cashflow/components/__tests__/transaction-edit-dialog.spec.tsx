import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApiError } from "@/lib/api-client";
import { cashflowApi } from "../../api-client";
import type { Transaction } from "../../types";
import { TransactionEditDialog } from "../transaction-edit-dialog";

jest.mock("@/hooks/use-mobile", () => ({ useIsMobile: jest.fn() }));
jest.mock("../../api-client", () => ({
  cashflowApi: {
    createTransaction: jest.fn(),
    updateTransaction: jest.fn(),
    deleteTransaction: jest.fn(),
    listTransactions: jest.fn(),
    getBaseCurrency: jest.fn(),
    setBaseCurrency: jest.fn(),
    listTags: jest.fn().mockResolvedValue({ items: [] }),
    createTag: jest.fn(),
    updateTag: jest.fn(),
    deleteTag: jest.fn(),
  },
}));

const useIsMobileMock = useIsMobile as jest.MockedFunction<typeof useIsMobile>;

const baseTransaction: Transaction = {
  id: "tx_1",
  date: "2026-06-07",
  amount: "12.34",
  currency: "USD",
  description: "Lunch",
  kind: "expense",
  tagIds: [],
  baseAmount: "12.34",
  baseCurrency: "USD",
  rateSubstituted: false,
  rateDate: "2026-06-07",
  unconvertible: false,
  group: null,
  createdAt: "now",
  updatedAt: "now",
};

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TransactionEditDialog
        transaction={baseTransaction}
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  );
}

describe("TransactionEditDialog", () => {
  beforeEach(() => {
    useIsMobileMock.mockReset();
    (cashflowApi.listTags as jest.Mock).mockResolvedValue({ items: [] });
  });

  it("renders the bottom Sheet on mobile so the keyboard stays clear of fields", () => {
    useIsMobileMock.mockReturnValue(true);
    renderDialog();
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toMatch(/slide-in-from-bottom/);
  });

  it("renders the centered Dialog on desktop", () => {
    useIsMobileMock.mockReturnValue(false);
    renderDialog();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-slot", "dialog-content");
  });

  it("scrolls the save error into view when the API rejects", async () => {
    useIsMobileMock.mockReturnValue(false);
    (cashflowApi.updateTransaction as jest.Mock).mockRejectedValue(
      new ApiError(500),
    );
    const scrollIntoView = jest
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => undefined);
    try {
      renderDialog();

      fireEvent.submit(screen.getByTestId("transaction-edit-form"));

      const errorEl = await screen.findByTestId("transaction-edit-error");
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

  it("dismisses the keyboard before opening the date popover", () => {
    useIsMobileMock.mockReturnValue(false);
    const rafSpy = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => {
        cb(0);
        return 0;
      });
    try {
      renderDialog();
      const description = screen.getByLabelText(
        /description/i,
      ) as HTMLInputElement;
      const blurSpy = jest.spyOn(description, "blur");
      description.focus();
      expect(document.activeElement).toBe(description);

      fireEvent.click(screen.getByTestId("transaction-edit-date-trigger"));

      expect(blurSpy).toHaveBeenCalled();
    } finally {
      rafSpy.mockRestore();
    }
  });
});
