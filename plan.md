# Multi-Tenant Feature — NestJS + PostgreSQL + Prisma Blueprint

## 1. Tech Stack & Core Decisions

| Concern | Choice | Reason |
|---|---|---|
| Framework | NestJS (REST, Express adapter) | Modular DI, guards/interceptors map cleanly to RBAC + tenant isolation |
| DB | PostgreSQL | Relational, strong constraint support for FK-based isolation |
| ORM | Prisma | Type-safe, supports Client Extensions for auto query-scoping |
| Auth | JWT (access + refresh, both signed, refresh hashed at rest) | Stateless access checks, revocable refresh sessions |
| Tenancy model | **Shared database, shared schema, discriminator column** (`companyId` on every tenant-scoped table) | Simplest to build/maintain at this stage, scales fine for SaaS until you have a real reason (compliance, huge scale) to go schema-per-tenant. Easy to migrate later since every model already isolates by FK. |

If a future requirement demands hard physical separation (e.g. a client wants their own schema/DB for compliance), the discriminator-column model can be migrated company-by-company without rewriting the app logic — just swap the Prisma client connection per tenant.

---

## 2. Folder Structure (Feature-Based)

```
src/
├── main.ts
├── app.module.ts
│
├── config/
│   ├── env.validation.ts
│   └── jwt.config.ts
│
├── prisma/
│   ├── prisma.module.ts
│   ├── prisma.service.ts          # base PrismaClient wrapper
│   └── schema.prisma
│
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── roles.decorator.ts
│   │   └── public.decorator.ts     # marks routes that skip auth (login, register)
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── tenant.guard.ts
│   ├── interceptors/
│   │   └── tenant-scope.interceptor.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── pipes/
│   │   └── validation.pipe.ts
│   └── enums/
│       └── role.enum.ts
│
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt-access.strategy.ts
│   │   │   └── jwt-refresh.strategy.ts
│   │   ├── dto/
│   │   │   ├── login.dto.ts
│   │   │   ├── register.dto.ts
│   │   │   ├── forgot-password.dto.ts
│   │   │   └── reset-password.dto.ts
│   │   └── auth.repository.ts
│   │
│   ├── companies/
│   │   ├── companies.module.ts
│   │   ├── companies.controller.ts
│   │   ├── companies.service.ts
│   │   └── dto/
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── dto/
│   │
│   └── (future feature modules go here, each tenant-scoped the same way)
│
└── shared/
    └── mailer/                     # for password-reset emails later
```

Each feature module owns its controller/service/dto — no shared "god service." Cross-cutting concerns (auth, tenant scoping, RBAC) live in `common/` and are wired in globally via `app.module.ts`.

---

## 3. Prisma Schema (Core Models)

```prisma
enum Role {
  SUPER_ADMIN
  COMPANY_ADMIN
  COMPANY_USER
  APP_USER
}

model Company {
  id        String   @id @default(uuid())
  name      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  users     User[]
}

model User {
  id              String        @id @default(uuid())
  email           String        @unique
  userCode        String?       // human-readable ID shown in admin UI ("User ID" in filters)
  passwordHash    String
  firstName       String
  lastName        String
  role            Role
  isActive        Boolean       @default(true)
  archivedAt      DateTime?     // reversible soft-archive, separate from isActive

  // Tenant link — null only for SUPER_ADMIN
  companyId       String?
  company         Company?      @relation(fields: [companyId], references: [id])

  refreshTokens          RefreshToken[]
  resetTokens            PasswordResetToken[]
  invitationTokens       InvitationToken[]
  impersonationsAsAdmin  ImpersonationLog[]   @relation("AdminImpersonations")
  impersonationsAsTarget ImpersonationLog[]   @relation("TargetImpersonations")

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([companyId])
  @@unique([companyId, userCode])   // userCode unique within a company, not globally
}

model RefreshToken {
  id          String   @id @default(uuid())
  tokenHash   String   @unique   // never store raw token
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  expiresAt   DateTime
  revokedAt   DateTime?
  createdAt   DateTime @default(now())

  @@index([userId])
}

model PasswordResetToken {
  id          String   @id @default(uuid())
  tokenHash   String   @unique
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime @default(now())

  @@index([userId])
}

model InvitationToken {
  id          String   @id @default(uuid())
  tokenHash   String   @unique
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime @default(now())

  @@index([userId])
}

model ImpersonationLog {
  id           String    @id @default(uuid())
  adminId      String
  admin        User      @relation("AdminImpersonations", fields: [adminId], references: [id])
  targetUserId String
  targetUser   User      @relation("TargetImpersonations", fields: [targetUserId], references: [id])
  startedAt    DateTime  @default(now())
  endedAt      DateTime?
  ipAddress    String?

  @@index([adminId])
  @@index([targetUserId])
}
```

Every future tenant-scoped model (Documents, Categories, Reminders, etc.) follows the same pattern: a required `companyId` field, an index on it, and a relation to `Company`. `userCode` and `archivedAt` are added now — not because the Users module is in scope this phase, but because retrofitting a unique-per-company identifier or an archive timestamp onto an existing `User` table later means a migration touching live data. Cheaper to reserve the columns now.

---

## 4. Role Matrix

| Role | Scope | Can manage users | Can manage company settings | Read company data | Write company data | Cross-company access |
|---|---|---|---|---|---|---|
| **Super Admin** | Global | All companies | All companies | Yes | Yes | Yes (explicit, audited) |
| **Company Admin** | Own company | Within own company | Own company only | Yes | Yes | No |
| **Company User** | Own company | No | No | Yes | Yes | No |
| **App User** | Own company | No | No | Own scope/assigned records | Own scope/assigned records | No |

Permission checks are **role + tenant**, never role alone — a Company Admin token for Company A must never resolve records belonging to Company B, regardless of role.

**Two login surfaces, one auth flow.** The spec lists "Admin login" and "Company User login" as separate items, but they don't need separate backend logic — only `SUPER_ADMIN` has `companyId: null`, every other role belongs to a company. A single `POST /auth/login` endpoint works for both; the frontend can route to different landing pages based on the returned `role`, and you can optionally expose `/auth/admin/login` as a thin wrapper that rejects non-`SUPER_ADMIN` credentials, if the product wants a visually distinct admin portal. Don't duplicate password-verification logic across two services.

**Impersonation is not privilege escalation — it's controlled role substitution.** "Admin impersonation of Company Users" must never give the admin elevated access; it gives the admin a token that has *exactly* the impersonated user's role and `companyId`, nothing more. See Section 6 below.

---

## 5. Authentication Flow (JWT)

**Access token** — short-lived (15 min), signed, payload: `{ sub: userId, companyId, role }`.
**Refresh token** — longer-lived (7 days), random opaque value; only its **hash** (SHA-256) is stored in `RefreshToken`. The raw token goes to the client; on use, hash-and-compare against DB.

Flow:
1. `POST /auth/login` → verify password (bcrypt) → issue access + refresh token pair → store refresh hash in DB.
2. `POST /auth/refresh` → verify refresh JWT signature + look up hash in DB → check not revoked/expired → rotate (revoke old, issue new pair). Rotation prevents replay of stolen refresh tokens.
3. `POST /auth/logout` → revoke the refresh token row (`revokedAt = now()`), so it can never be reused even if the access token hasn't expired yet.
4. Password reset → revoke **all** refresh tokens for that user (forces logout everywhere), satisfying the "invalidate sessions on password reset" requirement.

```ts
// jwt-access.strategy.ts (concept)
validate(payload: JwtPayload) {
  return { userId: payload.sub, companyId: payload.companyId, role: payload.role };
}
```

`@Public()` decorator + a global `JwtAuthGuard` (checks for that decorator via reflector) means every route is protected **by default** — you opt out explicitly for login/register/forgot-password, rather than opting in. This avoids the classic mistake of a forgotten guard exposing an endpoint.

---

## 6. Impersonation Design

This is the one feature in the new context that genuinely changes the JWT design, so it's worth building into the foundation now rather than retrofitting.

**Rule: an impersonation token carries the target user's identity, not the admin's, plus an audit trail.**

```
payload = {
  sub: targetUser.id,
  companyId: targetUser.companyId,
  role: targetUser.role,
  impersonatedBy: admin.id   // present only during impersonation
}
```

Because `TenantGuard` and `RolesGuard` both read `companyId`/`role` straight off the token, they need **zero changes** to handle impersonation correctly — the admin is, for the duration of the session, indistinguishable in permissions from the user they're viewing. That's what prevents impersonation from becoming a privilege-escalation backdoor.

Flow:
1. `POST /admin/users/:id/impersonate` (`SUPER_ADMIN` only) → verify the target exists and isn't archived → write an `ImpersonationLog` row (`adminId`, `targetUserId`, `startedAt`) → issue a **short-lived, non-refreshable** access token with the payload above (e.g. 20 min, no matching `RefreshToken` row created).
2. The admin's own refresh token is untouched — their real session keeps running in parallel. The client just swaps which access token it sends.
3. `POST /admin/impersonate/stop` → set `endedAt` on the open `ImpersonationLog` row → client discards the impersonation token and reverts to its own.
4. Reject impersonation requests where the *current* token already has `impersonatedBy` set — no nested impersonation.
5. Every write made during an impersonated session should log `impersonatedBy` alongside the normal `userId` in your audit/activity log once you build one, so support actions taken on a client's behalf stay traceable.

Making the impersonation token non-refreshable is deliberate — it forces a deliberate "stop impersonating" action rather than letting a support session silently persist for days.

---

## 7. Tenant Isolation — Implementation

Two layers, both required (defense in depth):

**Layer 1 — Guard, blocks at the request boundary**
```ts
// tenant.guard.ts (concept)
canActivate(context) {
  const { user, params } = context.switchToHttp().getRequest();
  if (user.role === Role.SUPER_ADMIN) return true; // explicit bypass only
  if (params.companyId && params.companyId !== user.companyId) {
    throw new NotFoundException(); // 404, not 403 — don't reveal the record exists
  }
  return true;
}
```

**Layer 2 — Query-level enforcement via Prisma Client Extension (the real safety net)**
Rather than trusting every service method to remember `where: { companyId }`, wrap Prisma so it's structurally impossible to forget:

```ts
// prisma.service.ts (concept)
@Injectable({ scope: Scope.REQUEST })
export class TenantPrismaService {
  private client: PrismaClient;

  constructor(@Inject(REQUEST) request: AuthenticatedRequest) {
    const { companyId, role } = request.user;
    this.client = basePrismaClient.$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query, model }) {
            if (role !== Role.SUPER_ADMIN && TENANT_SCOPED_MODELS.includes(model)) {
              args.where = { ...args.where, companyId };
            }
            return query(args);
          },
        },
      },
    });
  }
}
```

This means **every** `findMany`, `findUnique`, `update`, `delete` automatically gets `companyId` injected — a developer adding a new feature next month can't accidentally leak cross-tenant data just by forgetting a `where` clause.

**Anti-enumeration rule:** when a record isn't found *or* belongs to another company, always return `404`, never `403`. A `403` confirms the ID exists, which is itself a leak (satisfies 13.4 — "prevent accessing records by guessing document IDs").

---

## 8. RBAC Implementation

```ts
// roles.decorator.ts
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

// roles.guard.ts (concept)
canActivate(context) {
  const required = this.reflector.get<Role[]>('roles', context.getHandler());
  if (!required) return true;
  const { user } = context.switchToHttp().getRequest();
  return required.includes(user.role);
}
```

```ts
@Roles(Role.COMPANY_ADMIN, Role.SUPER_ADMIN)
@Patch(':id')
updateUser(@Param('id') id: string) { ... }
```

`JwtAuthGuard`, `RolesGuard`, and `TenantGuard` are registered globally in `app.module.ts` (`APP_GUARD` providers) so no controller can be left unprotected by omission — this directly satisfies "RBAC middleware across all endpoints."

---

## 9. Password Reset Flow

1. `POST /auth/forgot-password { email }` → always return 200 regardless of whether the email exists (prevents account enumeration) → if it exists, generate a random token, store **only its hash** with a short expiry (15–30 min), email the raw token as a link.
2. `POST /auth/reset-password { token, newPassword }` → hash incoming token, look up, check `usedAt IS NULL` and not expired → update `passwordHash` → mark token `usedAt` → **revoke all refresh tokens for that user**.
3. Reset tokens are single-use and time-boxed; this satisfies "secure, token-based reset mechanism" and "signature hashing mechanism" (11.1 / 15.2.1) since nothing sensitive is ever stored or emailed in plaintext-comparable form.
4. "Issue welcome email to client" (2.2.2) is the same mechanism with a different label — `InvitationToken` instead of `PasswordResetToken`, same hash-and-expire pattern, but it sets the user's *first* password rather than replacing an existing one, and can flip a `pending → active` status flag if you add one later.

---

## 10. Security Checklist Mapping (Section 15.2.1)

| Requirement | How it's satisfied |
|---|---|
| TLS enforcement | Enforced at infra layer (reverse proxy/load balancer, e.g. Nginx/ALB with redirect-to-HTTPS) — not app code, but document it as a deployment requirement |
| RBAC implementation | Global `RolesGuard` + `@Roles()` decorator, default-deny unless explicitly listed |
| Tenant isolation | `TenantGuard` (request boundary) + Prisma Client Extension (query boundary) — two independent layers |
| Signature hashing mechanism | Refresh tokens and password-reset tokens stored as SHA-256 hashes only; passwords stored as bcrypt hashes; JWTs signed (HS256 or RS256) |

---

## 11. Initial Endpoint List

```
POST   /auth/register            (Company Admin creates users within own company; Super Admin can create companies + first admin)
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/forgot-password
POST   /auth/reset-password

GET    /companies                (Super Admin only)
POST   /companies                (Super Admin only)
GET    /companies/:id
PATCH  /companies/:id

GET    /users                    (scoped to caller's company unless Super Admin; supports ?name=&userCode=&email= filters)
GET    /users/:id
PATCH  /users/:id
POST   /users/:id/send-welcome-email   (issues InvitationToken, Company Admin/Super Admin only)
PATCH  /users/:id/archive               (sets archivedAt, reversible)
PATCH  /users/:id/restore               (clears archivedAt)
DELETE /users/:id/permanent             (Archive module only — irreversible, only allowed if already archived)

POST   /admin/users/:id/impersonate     (Super Admin only — see Section 6)
POST   /admin/impersonate/stop
```

Note `DELETE /users/:id/permanent` is intentionally separate from the archive endpoint and gated to already-archived records — it satisfies the spec's explicit "Permanently delete user" requirement (2.2.7) while keeping the everyday delete action (`archive`) reversible.

---

## 12. Suggested Build Order

1. Prisma schema + migrations (Company, User, RefreshToken, PasswordResetToken, InvitationToken, ImpersonationLog).
2. Auth module: register/login/refresh/logout with hashed refresh tokens.
3. Global guards: `JwtAuthGuard` → `RolesGuard` → `TenantGuard`, wired as `APP_GUARD`.
4. Prisma Client Extension for automatic `companyId` scoping.
5. Users + Companies modules built on top of the now-enforced isolation, including archive/restore/permanent-delete.
6. Password reset + welcome-email invitation flow (shared token pattern).
7. Impersonation endpoints (Section 6) — built last since it depends on Users + Companies existing, but the JWT payload shape is already in place from step 2.
8. Manual cross-tenant penetration test: log in as Company A, try every endpoint with Company B's IDs — confirm 404s, not data leaks. Separately, test impersonation can't be nested and can't outlive its 20-minute window.

This gives you a working, demoable multi-tenant core that every future feature module plugs into without re-solving isolation or RBAC each time.

---

## 13. Modules Now Visible for Later Phases (Not Building Yet)

The new context surfaces several modules beyond the multi-tenant core. None of these are in scope for this phase, but listing them here so the schema choices above don't paint you into a corner:

| Module | Spec ref | Core entities it'll need |
|---|---|---|
| Categories | 2.2.3 | `Category` (companyId, name), `CategorySection` linking a category to one of the 6 predefined document sections, with an assignment scope of either one `User` or "all users in company" |
| Documents | 2.2.2, 2.2.6 | `Document` (companyId, userId, section enum, fileUrl, originalFileName) — section is a fixed enum of 6 values, not user-defined; "replace" overwrites the file reference rather than versioning |
| Standard Documents | 2.2.6 | `StandardDocument` — likely **no** `companyId` (platform-level templates managed by Super Admin), distinct table from per-user `Document` |
| Individuals & Reminders | 2.2.2 | `Individual` (companyId, userId — dependents/sub-records under a User), `Reminder` (companyId, individualId or userId, dueDate, title) for date-tracked follow-ups |
| Archive (full module) | 2.2.7 | Built on the `archivedAt` field already on `User`; extends the same pattern to `Document` and other tenant-scoped models as they're added |

Each of these is a standard tenant-scoped module once the core is in place — same `companyId` discriminator, same Prisma extension auto-filtering, same guard stack. Worth tackling one at a time rather than in this pass.