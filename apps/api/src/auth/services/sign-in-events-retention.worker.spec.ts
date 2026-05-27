import { SIGN_IN_EVENT_RETENTION_DAYS } from "./sign-in-events.service";
import { SignInEventsRetentionWorker } from "./sign-in-events-retention.worker";

describe("SignInEventsRetentionWorker", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("prunes events older than the retention window", async () => {
    const now = new Date("2026-04-30T03:00:00Z");
    jest.useFakeTimers().setSystemTime(now);

    const pruneOlderThan = jest.fn().mockResolvedValue(5);
    const worker = new SignInEventsRetentionWorker({
      pruneOlderThan,
    } as never);

    await worker.runRetentionSweep();

    expect(pruneOlderThan).toHaveBeenCalledTimes(1);
    const cutoff = pruneOlderThan.mock.calls[0]?.[0] as Date;
    expect(cutoff).toBeInstanceOf(Date);
    const expectedMs =
      now.getTime() - SIGN_IN_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    expect(cutoff.getTime()).toBe(expectedMs);
  });

  it("does not throw if the prune query fails", async () => {
    const pruneOlderThan = jest.fn().mockRejectedValue(new Error("db down"));
    const worker = new SignInEventsRetentionWorker({
      pruneOlderThan,
    } as never);

    await expect(worker.runRetentionSweep()).resolves.toBeUndefined();
  });
});
