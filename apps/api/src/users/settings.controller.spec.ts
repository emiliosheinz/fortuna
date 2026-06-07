import { validate } from "class-validator";
import { SetBaseCurrencyDto } from "./dto/set-base-currency.dto";
import { UserSettingsService } from "./services/user-settings.service";
import { SettingsController } from "./settings.controller";

function build(overrides: Partial<UserSettingsService> = {}): {
  controller: SettingsController;
  settings: UserSettingsService;
} {
  const settings = {
    getBaseCurrency: jest.fn(),
    setBaseCurrency: jest.fn(),
    ...overrides,
  } as unknown as UserSettingsService;
  return { controller: new SettingsController(settings), settings };
}

describe("SettingsController GET /users/me/base-currency", () => {
  it("returns the default code when nothing has been chosen", async () => {
    const { controller } = build({
      getBaseCurrency: jest.fn().mockResolvedValue("USD"),
    });
    const req = { principal: { userId: "u_1", sessionId: "s_1" } } as never;

    const result = await controller.getBaseCurrency(req);

    expect(result).toEqual({ baseCurrency: "USD" });
  });

  it("returns the stored code when set", async () => {
    const { controller } = build({
      getBaseCurrency: jest.fn().mockResolvedValue("EUR"),
    });
    const req = { principal: { userId: "u_1", sessionId: "s_1" } } as never;

    const result = await controller.getBaseCurrency(req);

    expect(result).toEqual({ baseCurrency: "EUR" });
  });
});

describe("SettingsController PUT /users/me/base-currency", () => {
  it("forwards the chosen code to the service and returns the persisted value", async () => {
    const setBaseCurrency = jest.fn().mockResolvedValue("EUR");
    const { controller } = build({ setBaseCurrency });
    const req = { principal: { userId: "u_1", sessionId: "s_1" } } as never;

    const body = new SetBaseCurrencyDto();
    body.baseCurrency = "EUR";
    const result = await controller.setBaseCurrency(req, body);

    expect(setBaseCurrency).toHaveBeenCalledWith("u_1", "EUR");
    expect(result).toEqual({ baseCurrency: "EUR" });
  });
});

describe("SetBaseCurrencyDto validation", () => {
  it("accepts a 3-letter uppercase ISO 4217 code", async () => {
    const dto = new SetBaseCurrencyDto();
    dto.baseCurrency = "USD";

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it("rejects lowercase codes", async () => {
    const dto = new SetBaseCurrencyDto();
    dto.baseCurrency = "usd";

    const errors = await validate(dto);

    expect(errors).not.toHaveLength(0);
  });

  it("rejects codes that are not three characters", async () => {
    const dto = new SetBaseCurrencyDto();
    dto.baseCurrency = "DOLLAR";

    const errors = await validate(dto);

    expect(errors).not.toHaveLength(0);
  });

  it("rejects non-string values", async () => {
    const dto = new SetBaseCurrencyDto();
    // biome-ignore lint/suspicious/noExplicitAny: testing runtime rejection
    (dto as any).baseCurrency = 123;

    const errors = await validate(dto);

    expect(errors).not.toHaveLength(0);
  });
});
