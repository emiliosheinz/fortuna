import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, type EntityManager } from "typeorm";
import { Identity } from "../entities/identity.entity";
import { User } from "../entities/user.entity";
import { SignInEventsService } from "./sign-in-events.service";

const GOOGLE_PROVIDER = "google";

/** Mirrored Google ID token claims used to create/update a Fortuna user. */
export interface GoogleIdentityClaims {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

/**
 * Operations on {@link User} rows.
 *
 * Identity-provider sign-ins always resolve through
 * {@link upsertFromGoogleIdentity} so the canonical lookup key
 * (`provider, providerSubject`) is enforced and email is never used as the
 * matching field.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly signInEvents: SignInEventsService,
  ) {}

  /**
   * Look up by `(google, sub)` or create the user + identity in a single
   * transaction. For returning users the mirrored profile fields (name,
   * email, avatarUrl) are refreshed from Google's claims on every sign-in.
   */
  async upsertFromGoogleIdentity(claims: GoogleIdentityClaims): Promise<User> {
    return this.dataSource.transaction(async (manager) =>
      upsertFromGoogleIdentityWithManager(manager, claims),
    );
  }

  /** Fetch a user by primary key. */
  async findById(id: string): Promise<User | null> {
    return this.dataSource.getRepository(User).findOne({ where: { id } });
  }

  /**
   * LGPD-compliant hard delete.
   *
   * In a single transaction: anonymize the user's `sign_in_events` rows
   * (user_id, ip, ua_hash → null) and delete the `users` row, which cascades
   * to `sessions` and `identities` via the FK contract. Outcome + timestamp
   * on `sign_in_events` are retained for security forensics.
   */
  async deleteAccount(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.signInEvents.anonymizeForUser(userId, manager);
      await manager.getRepository(User).delete({ id: userId });
    });
  }
}

async function upsertFromGoogleIdentityWithManager(
  manager: EntityManager,
  claims: GoogleIdentityClaims,
): Promise<User> {
  const identityRepo = manager.getRepository(Identity);
  const userRepo = manager.getRepository(User);

  const existing = await identityRepo.findOne({
    where: { provider: GOOGLE_PROVIDER, providerSubject: claims.sub },
    relations: { user: true },
  });

  if (existing) {
    const user = existing.user;
    user.name = claims.name;
    user.email = claims.email;
    user.avatarUrl = claims.picture ?? null;
    await userRepo.save(user);
    return user;
  }

  const user = await userRepo.save({
    name: claims.name,
    email: claims.email,
    avatarUrl: claims.picture ?? null,
  });
  await identityRepo.save({
    userId: user.id,
    provider: GOOGLE_PROVIDER,
    providerSubject: claims.sub,
  });
  return user;
}
