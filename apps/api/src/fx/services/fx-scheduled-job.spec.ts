import { FxFetchService } from "./fx-fetch.service";
import { FxScheduledJob } from "./fx-scheduled-job";

describe("FxScheduledJob", () => {
  it("delegates each firing to the catch-up path", async () => {
    const fetcher = {
      fetchAndPersistCatchUp: jest.fn().mockResolvedValue({
        persisted: 5,
        from: "2026-06-01",
        to: "2026-06-07",
        noop: false,
      }),
    } as unknown as FxFetchService;
    const job = new FxScheduledJob(fetcher);

    await job.runOnce();
    await job.runOnce();

    expect(fetcher.fetchAndPersistCatchUp).toHaveBeenCalledTimes(2);
  });

  it("swallows fetch failures so the schedule keeps firing", async () => {
    const fetcher = {
      fetchAndPersistCatchUp: jest
        .fn()
        .mockRejectedValueOnce(new Error("upstream down")),
    } as unknown as FxFetchService;
    const job = new FxScheduledJob(fetcher);

    await expect(job.runOnce()).resolves.toBeUndefined();
  });
});
