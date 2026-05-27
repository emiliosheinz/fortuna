import { Test } from "@nestjs/testing";
import { MetricsService } from "../../metrics/metrics.service";
import { ActiveSessionsSampler } from "./active-sessions.sampler";
import { SessionsService } from "./sessions.service";

interface SamplerStubs {
  countActive: jest.Mock;
  setActiveSessions: jest.Mock;
}

async function buildSampler(
  overrides: Partial<SamplerStubs> = {},
): Promise<{ sampler: ActiveSessionsSampler } & SamplerStubs> {
  const stubs: SamplerStubs = {
    countActive: jest.fn().mockResolvedValue(0),
    setActiveSessions: jest.fn(),
    ...overrides,
  };
  const sessionsStub: Pick<SessionsService, "countActive"> = {
    countActive: stubs.countActive,
  };
  const metricsStub: Pick<MetricsService, "setActiveSessions"> = {
    setActiveSessions: stubs.setActiveSessions,
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      ActiveSessionsSampler,
      { provide: SessionsService, useValue: sessionsStub },
      { provide: MetricsService, useValue: metricsStub },
    ],
  }).compile();
  return { sampler: moduleRef.get(ActiveSessionsSampler), ...stubs };
}

describe("ActiveSessionsSampler", () => {
  it("samples the active-sessions count and sets the gauge", async () => {
    const { sampler, countActive, setActiveSessions } = await buildSampler({
      countActive: jest.fn().mockResolvedValue(42),
    });

    await sampler.sample();

    expect(countActive).toHaveBeenCalledTimes(1);
    expect(setActiveSessions).toHaveBeenCalledWith(42);
  });

  it("does not throw when the count query fails", async () => {
    const { sampler, setActiveSessions } = await buildSampler({
      countActive: jest.fn().mockRejectedValue(new Error("db down")),
    });

    await expect(sampler.sample()).resolves.toBeUndefined();
    expect(setActiveSessions).not.toHaveBeenCalled();
  });
});
