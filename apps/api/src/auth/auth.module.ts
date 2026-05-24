import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthController } from "./auth.controller";
import { Identity } from "./entities/identity.entity";
import { Session } from "./entities/session.entity";
import { SignInEvent } from "./entities/sign-in-event.entity";
import { User } from "./entities/user.entity";
import { BadRequestAuditFilter } from "./filters/bad-request-audit.filter";
import { SessionGuard } from "./guards/session.guard";
import { AuthService } from "./services/auth.service";
import {
  GOOGLE_ID_TOKEN_VERIFIER_OPTIONS,
  GoogleIdTokenVerifier,
  type GoogleIdTokenVerifierOptions,
} from "./services/google-id-token-verifier";
import { SessionsService } from "./services/sessions.service";
import { SignInAuditor } from "./services/sign-in-auditor";
import { SignInEventsService } from "./services/sign-in-events.service";
import { SignInEventsRetentionWorker } from "./services/sign-in-events-retention.worker";
import { UsersService } from "./services/users.service";

const googleVerifierOptionsProvider = {
  provide: GOOGLE_ID_TOKEN_VERIFIER_OPTIONS,
  useFactory: (): GoogleIdTokenVerifierOptions => {
    const issuer = process.env.OIDC_ISSUER_URL;
    const audience = process.env.GOOGLE_CLIENT_ID;
    if (!issuer) {
      throw new Error("OIDC_ISSUER_URL must be set");
    }
    if (!audience) {
      throw new Error("GOOGLE_CLIENT_ID must be set");
    }
    return {
      issuer,
      audience,
      jwksUri: deriveJwksUri(issuer),
    };
  },
};

function deriveJwksUri(issuer: string): string {
  const trimmed = issuer.replace(/\/$/, "");
  if (trimmed === "https://accounts.google.com") {
    return "https://www.googleapis.com/oauth2/v3/certs";
  }
  return `${trimmed}/jwks`;
}

@Module({
  imports: [TypeOrmModule.forFeature([User, Identity, Session, SignInEvent])],
  controllers: [AuthController],
  providers: [
    googleVerifierOptionsProvider,
    GoogleIdTokenVerifier,
    AuthService,
    SessionsService,
    UsersService,
    SignInEventsService,
    SignInAuditor,
    SignInEventsRetentionWorker,
    SessionGuard,
    BadRequestAuditFilter,
  ],
  exports: [SessionsService, UsersService, SignInEventsService, SessionGuard],
})
export class AuthModule {}
