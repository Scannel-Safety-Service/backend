# Best Practices & Folder Structure — NestJS Multi-Tenant Backend

> This guide establishes conventions, patterns, and the feature-based folder layout for the Scannel Safety Service backend. Every contributor should follow these standards.

---

## 1. Feature-Based Folder Structure

```
backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                          # DB seeding (Super Admin, test companies)
│
├── src/
│   ├── main.ts                          # Bootstrap, global pipes/filters, CORS, Swagger
│   ├── app.module.ts                    # Root module — imports all feature + infra modules
│   │
│   ├── config/                          # ── App Configuration ──
│   │   ├── env.validation.ts            # Joi/class-validator schema for env vars
│   │   └── jwt.config.ts               # JWT secrets, expiry settings via ConfigService
│   │
│   ├── prisma/                          # ── Database Layer ──
│   │   ├── prisma.module.ts             # Global module exporting PrismaService
│   │   ├── prisma.service.ts            # Base PrismaClient wrapper (singleton)
│   │   └── tenant-prisma.service.ts     # Request-scoped extended client with companyId auto-scoping
│   │
│   ├── common/                          # ── Cross-Cutting Concerns ──
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── roles.decorator.ts
│   │   │   └── public.decorator.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── tenant.guard.ts
│   │   ├── interceptors/
│   │   │   ├── tenant-scope.interceptor.ts
│   │   │   └── response-transform.interceptor.ts  # Consistent API response wrapper
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts
│   │   ├── enums/
│   │   │   └── role.enum.ts
│   │   ├── interfaces/
│   │   │   ├── authenticated-request.interface.ts  # Express Request + user payload
│   │   │   └── jwt-payload.interface.ts
│   │   └── constants/
│   │       ├── tenant-scoped-models.ts             # Models that have companyId
│   │       └── app.constants.ts                    # Magic numbers, default values
│   │
│   ├── modules/                         # ── Feature Modules (one folder per domain) ──
│   │   │
│   │   ├── auth/                        # Authentication & Authorization
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.repository.ts       # Prisma queries only — no business logic
│   │   │   ├── strategies/
│   │   │   │   ├── jwt-access.strategy.ts
│   │   │   │   └── jwt-refresh.strategy.ts
│   │   │   └── dto/
│   │   │       ├── login.dto.ts
│   │   │       ├── register.dto.ts
│   │   │       ├── forgot-password.dto.ts
│   │   │       └── reset-password.dto.ts
│   │   │
│   │   ├── companies/                   # Company Management
│   │   │   ├── companies.module.ts
│   │   │   ├── companies.controller.ts
│   │   │   ├── companies.service.ts
│   │   │   ├── companies.repository.ts
│   │   │   └── dto/
│   │   │       ├── create-company.dto.ts
│   │   │       └── update-company.dto.ts
│   │   │
│   │   ├── users/                       # User Management
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.repository.ts
│   │   │   └── dto/
│   │   │       ├── update-user.dto.ts
│   │   │       └── user-query.dto.ts    # Filters: ?name=&email=&userCode=
│   │   │
│   │   └── impersonation/               # Admin Impersonation
│   │       ├── impersonation.module.ts
│   │       ├── impersonation.controller.ts
│   │       ├── impersonation.service.ts
│   │       └── dto/
│   │
│   └── shared/                          # ── Shared Utilities (non-feature) ──
│       ├── mailer/
│       │   ├── mailer.module.ts
│       │   ├── mailer.service.ts         # Interface / abstraction
│       │   └── console-mailer.service.ts # Stub implementation (logs to console)
│       └── utils/
│           ├── hash.util.ts              # SHA-256 helper for tokens
│           └── pagination.util.ts        # Shared pagination logic
│
├── test/
│   ├── e2e/                              # End-to-end tests
│   │   ├── auth.e2e-spec.ts
│   │   ├── companies.e2e-spec.ts
│   │   ├── users.e2e-spec.ts
│   │   └── tenant-isolation.e2e-spec.ts
│   └── helpers/
│       ├── test-db.helper.ts             # Test DB setup/teardown
│       └── auth.helper.ts               # Token generation for tests
│
├── .env.example                          # Template for env vars (never commit .env)
├── .eslintrc.js
├── .prettierrc
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
└── package.json
```

### Key Principles of This Layout

| Principle | How It's Applied |
|---|---|
| **Feature colocation** | Each module owns its controller, service, repository, and DTOs — no hunting across folders |
| **No god services** | Business logic lives in the feature's service; cross-cutting concerns live in `common/` |
| **Repository pattern** | Services never call Prisma directly — repositories encapsulate all DB queries |
| **DTO per operation** | Separate DTOs for create, update, and query — never reuse one DTO for multiple purposes |
| **Shared ≠ Feature** | `shared/` is for infrastructure utilities (mailer, hashing). If it has a controller, it's a module |

---

## 2. Naming Conventions

### Files
```
<feature>.<type>.ts

# Examples:
auth.controller.ts       ✅
auth.service.ts          ✅
jwt-access.strategy.ts   ✅
create-company.dto.ts    ✅
role.enum.ts             ✅

AuthController.ts        ❌  (no PascalCase filenames)
auth-controller.ts       ❌  (use dot-separated type suffix)
```

### Classes & Interfaces
```typescript
// Services, Controllers, Guards — PascalCase with suffix
class AuthService {}
class JwtAuthGuard {}
class TenantScopeInterceptor {}

// DTOs — PascalCase + Dto suffix
class CreateCompanyDto {}
class LoginDto {}

// Interfaces — prefix with 'I' or use descriptive name
interface AuthenticatedRequest extends Request {}
interface JwtPayload {}

// Enums — PascalCase, members UPPER_SNAKE_CASE
enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
}
```

### Variables & Functions
```typescript
// camelCase for variables and functions
const accessToken = generateToken(user);
const isExpired = checkTokenExpiry(token);

// UPPER_SNAKE_CASE for constants
const JWT_ACCESS_EXPIRY = '15m';
const TENANT_SCOPED_MODELS = ['User', 'RefreshToken'];
```

---

## 3. Module Architecture — The 4-Layer Rule

Every feature module follows the same internal layering:

```
Controller  →  Service  →  Repository  →  Prisma
   (HTTP)     (Logic)     (Queries)      (DB)
```

| Layer | Responsibility | Rules |
|---|---|---|
| **Controller** | HTTP concerns only — parse request, call service, return response | No business logic. No Prisma calls. Decorate with `@Roles()`, validation pipes. |
| **Service** | Business logic, orchestration, validation rules | Never import `PrismaService` directly — use the repository. Throw domain-specific exceptions. |
| **Repository** | Raw Prisma queries, data shaping | No business logic. Returns raw data or throws `NotFoundException`. One repository per model. |
| **DTO** | Request validation & transformation | Use `class-validator` decorators. Separate DTOs for create/update/query. Never expose internal fields (e.g., `passwordHash`). |

### Why a Repository Layer?

```typescript
// ❌ BAD — Service directly coupling to Prisma
class UsersService {
  async findAll(companyId: string) {
    return this.prisma.user.findMany({ where: { companyId } });
  }
}

// ✅ GOOD — Repository abstracts the query
class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}
  
  async findAll(companyId: string) {
    return this.usersRepository.findByCompany(companyId);
  }
}
```

Benefits:
- Queries are testable in isolation (mock the repository, not Prisma)
- Query logic stays in one place — when you optimize a query, you change one file
- Swapping ORM/DB later only touches repositories

---

## 4. Security Best Practices

### 4.1 — Authentication
```typescript
// ✅ All routes are protected by default via global JwtAuthGuard
// ✅ Explicitly opt OUT with @Public() — never opt in
@Public()
@Post('login')
login(@Body() dto: LoginDto) {}

// ✅ Never store raw tokens — hash everything at rest
// Refresh tokens → SHA-256 hash stored in DB
// Passwords → bcrypt (12 rounds)
// Reset/Invitation tokens → SHA-256 hash stored in DB
```

### 4.2 — Tenant Isolation (Defense in Depth)
```
Layer 1: TenantGuard       — blocks at request boundary (params check)
Layer 2: Prisma Extension   — blocks at query boundary (auto companyId injection)
```

Both layers are **independently sufficient** — even if one fails, the other catches it. Never rely on just one.

### 4.3 — Anti-Enumeration
```typescript
// ✅ ALWAYS return 404 when a record isn't found OR belongs to another tenant
throw new NotFoundException('Resource not found');

// ❌ NEVER return 403 for cross-tenant access — it confirms the ID exists
throw new ForbiddenException('Not your resource');  // This leaks information!
```

### 4.4 — Password Reset
```typescript
// ✅ Always return 200 on forgot-password, even if email doesn't exist
// ✅ Tokens are single-use (mark usedAt after consumption)
// ✅ Tokens are time-boxed (15-30 min expiry)
// ✅ Revoke ALL refresh tokens on password change (force logout everywhere)
```

### 4.5 — Input Validation
```typescript
// ✅ Global ValidationPipe with strict options
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,            // Strip unknown properties
  forbidNonWhitelisted: true, // Throw if unknown properties sent
  transform: true,            // Auto-transform payloads to DTO instances
}));
```

---

## 5. Error Handling

### Consistent API Response Format
```typescript
// Success responses
{
  "statusCode": 200,
  "message": "Users retrieved successfully",
  "data": { ... }
}

// Error responses
{
  "statusCode": 404,
  "message": "Resource not found",
  "error": "Not Found",
  "timestamp": "2026-06-17T10:00:00.000Z",
  "path": "/users/invalid-id"
}
```

### Exception Hierarchy
```typescript
// Use NestJS built-in exceptions — don't invent new ones without reason
NotFoundException      // 404 — resource not found OR cross-tenant access
UnauthorizedException  // 401 — missing or invalid token
ForbiddenException     // 403 — valid token but wrong role
BadRequestException    // 400 — validation failure
ConflictException      // 409 — duplicate email, etc.
```

### Service Layer — Throw Meaningful Errors
```typescript
// ✅ Service throws, controller just passes through
async findOne(id: string): Promise<User> {
  const user = await this.usersRepository.findById(id);
  if (!user) {
    throw new NotFoundException('User not found');
  }
  return user;
}

// ❌ Don't return null from services and check in controllers
```

---

## 6. Database & Prisma Best Practices

### 6.1 — Schema Conventions
```prisma
// ✅ Every tenant-scoped model MUST have companyId + index
model Document {
  id        String   @id @default(uuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  // ...
  @@index([companyId])
}

// ✅ Use uuid for primary keys — never auto-increment (prevents ID enumeration)
// ✅ Always include createdAt + updatedAt
// ✅ Soft-delete with archivedAt (nullable DateTime), not a boolean flag
// ✅ Store only hashes for tokens — never raw values
```

### 6.2 — Migration Discipline
```bash
# ✅ Always use named migrations
npx prisma migrate dev --name add-document-model

# ✅ Review the generated SQL before applying to staging/prod
# ✅ Never edit a migration file after it has been applied
# ✅ Use prisma migrate deploy in CI/CD (not migrate dev)
```

### 6.3 — Query Performance
```typescript
// ✅ Select only what you need — don't fetch passwordHash when listing users
const users = await this.prisma.user.findMany({
  where: { companyId },
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    isActive: true,
    // passwordHash: excluded
  },
});

// ✅ Use pagination everywhere — never return unbounded lists
// ✅ Add indexes for frequently filtered columns
// ✅ Use transactions for multi-step writes
```

---

## 7. Environment & Configuration

### Required Environment Variables
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/scannel_safety?schema=public

# JWT
JWT_ACCESS_SECRET=<random-64-char-string>
JWT_REFRESH_SECRET=<different-random-64-char-string>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# App
PORT=3000
NODE_ENV=development
```

### Configuration Rules
```typescript
// ✅ Validate ALL env vars on startup — fail fast
// ✅ Use ConfigService for all config access — never process.env directly
// ✅ Never commit .env — use .env.example as template
// ✅ Different secrets for access vs refresh tokens
```

---

## 8. Code Style & Linting

### ESLint + Prettier
```
- Use NestJS default ESLint config
- Prettier for formatting (printWidth: 100, singleQuote: true, trailingComma: 'all')
- No unused imports
- No console.log in production code (use NestJS Logger service)
- Explicit return types on all public service methods
```

### Import Order
```typescript
// 1. Node built-ins
import { createHash } from 'crypto';

// 2. NestJS / third-party
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// 3. Internal — common
import { Role } from '../../common/enums/role.enum';

// 4. Internal — same module
import { UsersRepository } from './users.repository';
import { UpdateUserDto } from './dto/update-user.dto';
```

---

## 9. Testing Strategy

### Test Types & Locations
```
src/modules/auth/auth.service.spec.ts      → Unit tests (colocated)
src/modules/auth/auth.controller.spec.ts   → Unit tests (colocated)
test/e2e/auth.e2e-spec.ts                 → End-to-end tests (test/ folder)
test/e2e/tenant-isolation.e2e-spec.ts     → Security tests
```

### What to Test
| Layer | Test Type | What to Assert |
|---|---|---|
| **Service** | Unit | Business logic, edge cases, error throwing |
| **Controller** | Unit (optional) | Route decorators, response shape |
| **Repository** | Integration | Query correctness against real DB |
| **E2E** | End-to-end | Full request → response cycle, auth, RBAC, tenant isolation |

### Testing Priorities (for this project)
1. **🔴 Critical:** Tenant isolation E2E tests — cross-company access must always return 404
2. **🔴 Critical:** Auth flow E2E — login, refresh rotation, logout revocation
3. **🟡 Important:** RBAC E2E — role-based endpoint access
4. **🟢 Nice-to-have:** Unit tests for service business logic

---

## 10. Logging

```typescript
// ✅ Use NestJS built-in Logger — never console.log
import { Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  async login(dto: LoginDto) {
    this.logger.log(`Login attempt for ${dto.email}`);
    // ...
    this.logger.warn(`Failed login attempt for ${dto.email}`);
  }
}

// ✅ Log at appropriate levels:
//    - log()   → Normal operations (login, registration)
//    - warn()  → Suspicious activity (failed login, cross-tenant attempt)
//    - error() → Unexpected failures (DB errors, unhandled exceptions)
//    - debug() → Development-only details
```

---

## 11. API Versioning & Documentation

### Swagger / OpenAPI
```typescript
// Set up in main.ts from day 1
const config = new DocumentBuilder()
  .setTitle('Scannel Safety Service API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);

// ✅ Decorate controllers with @ApiTags()
// ✅ Decorate DTOs with @ApiProperty()
// ✅ Decorate responses with @ApiResponse()
```

### URL Conventions
```
POST   /auth/login              # Auth actions — verb-based
GET    /companies               # Resources — noun-based, plural
GET    /companies/:id
PATCH  /companies/:id           # Partial update — PATCH, not PUT
DELETE /users/:id/permanent     # Destructive action — explicit naming
PATCH  /users/:id/archive       # State transition — action suffix
```

---

## 12. Git Conventions

### Branch Naming
```
feature/step-1-project-bootstrap
feature/step-2-prisma-schema
feature/step-3-auth-module
fix/tenant-guard-404
```

### Commit Messages
```
feat(auth): implement login with JWT access/refresh token rotation
feat(prisma): add tenant-scoped Prisma client extension
fix(guard): return 404 instead of 403 for cross-tenant access
chore(deps): update @nestjs/core to 10.x
```

---

## Quick Reference — Do's and Don'ts

| ✅ Do | ❌ Don't |
|---|---|
| Use `@Public()` to opt out of auth | Forget a guard on a new endpoint (they're global) |
| Return 404 for cross-tenant access | Return 403 (reveals record existence) |
| Hash all tokens before storing | Store raw refresh/reset tokens in DB |
| Use repository pattern for DB access | Call Prisma directly from services |
| Validate env vars on startup | Use `process.env` directly |
| Use `select` to exclude sensitive fields | Return `passwordHash` in API responses |
| Add `companyId` + `@@index` to every tenant model | Create a model without tenant scoping |
| Use NestJS `Logger` | Use `console.log` |
| One DTO per operation | Reuse `CreateDto` for updates |
| Paginate all list endpoints | Return unbounded arrays |
