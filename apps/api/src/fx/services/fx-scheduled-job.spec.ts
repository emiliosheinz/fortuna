import { FxFetchService } from "./fx-fetch.service";
import { FxScheduledJob } from "./fx-scheduled-job";

describe("FxScheduledJob", () => {
  it("delegates each firing to the fetch service", async () => {
    const fetcher = {
      fetchAndPersistLatest: jest.fn().mockResolvedValue(33),
    } as unknown as FxFetchService;
    const job = new FxScheduledJob(fetcher);

    await job.runOnce();
    await job.runOnce();

    expect(fetcher.fetchAndPersistLatest).toHaveBeenCalledTimes(2);
  });

  it("swallows fetch failures so the schedule keeps firing", async () => {
    const fetcher = {
      fetchAndPersistLatest: jest
        .fn()
        .mockRejectedValueOnce(new Error("upstream down")),
    } as unknown as FxFetchService;
    const job = new FxScheduledJob(fetcher);

    await expect(job.runOnce()).resolves.toBeUndefined();
  });
});
