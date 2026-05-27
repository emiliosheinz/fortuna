import { DeviceFingerprint } from "../entities/device-fingerprint.entity";
import { computeDeviceFingerprintHash } from "../fingerprint/device-fingerprint-hash";
import { DeviceFingerprintsService } from "./device-fingerprints.service";

type RepoMock = {
  save: jest.Mock;
  findOne: jest.Mock;
  update: jest.Mock;
};

function buildRepo(): RepoMock {
  return {
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(async () => undefined),
  };
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

describe("DeviceFingerprintsService.recordSignIn", () => {
  it("returns { fingerprintId: null, isNew: false } when no device id is supplied", async () => {
    const repo = buildRepo();
    const service = new DeviceFingerprintsService(repo as never);

    const result = await service.recordSignIn({
      userId: "user-1",
      deviceId: null,
      userAgent: USER_AGENT,
    });

    expect(result).toEqual({ fingerprintId: null, isNew: false });
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.findOne).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("inserts a new fingerprint row when no match exists and reports isNew=true", async () => {
    const repo = buildRepo();
    repo.findOne.mockResolvedValue(null);
    repo.save.mockImplementation(
      async (entity: Partial<DeviceFingerprint>) => ({
        ...entity,
        id: "new-fp-id",
        firstSeenAt: new Date(),
      }),
    );
    const service = new DeviceFingerprintsService(repo as never);

    const result = await service.recordSignIn({
      userId: "user-1",
      deviceId: "device-abc",
      userAgent: USER_AGENT,
    });

    expect(result).toEqual({ fingerprintId: "new-fp-id", isNew: true });

    const expectedHash = computeDeviceFingerprintHash("device-abc", USER_AGENT);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { userId: "user-1", fingerprintHash: expectedHash },
    });
    const persisted = repo.save.mock.calls[0][0] as Partial<DeviceFingerprint>;
    expect(persisted.userId).toBe("user-1");
    expect(persisted.fingerprintHash).toBe(expectedHash);
    expect(persisted.lastSeenAt).toBeInstanceOf(Date);
    // Raw device_id must never appear in the persisted entity.
    expect(JSON.stringify(persisted)).not.toContain("device-abc");
  });

  it("updates last_seen_at and reports isNew=false when the fingerprint is already known", async () => {
    const repo = buildRepo();
    const existing: DeviceFingerprint = {
      id: "existing-fp-id",
      userId: "user-1",
      fingerprintHash: computeDeviceFingerprintHash("device-abc", USER_AGENT),
      firstSeenAt: new Date(Date.now() - 100_000),
      lastSeenAt: new Date(Date.now() - 100_000),
    } as DeviceFingerprint;
    repo.findOne.mockResolvedValue(existing);
    const service = new DeviceFingerprintsService(repo as never);

    const before = Date.now();
    const result = await service.recordSignIn({
      userId: "user-1",
      deviceId: "device-abc",
      userAgent: USER_AGENT,
    });

    expect(result).toEqual({ fingerprintId: "existing-fp-id", isNew: false });
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledTimes(1);
    const [where, patch] = repo.update.mock.calls[0];
    expect(where).toEqual({ id: "existing-fp-id" });
    expect(patch.lastSeenAt).toBeInstanceOf(Date);
    expect((patch.lastSeenAt as Date).getTime()).toBeGreaterThanOrEqual(before);
  });
});
