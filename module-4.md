# Module 4: Project Management — Blueprint & Integration Plan

This document defines the implementation strategy, database relational structures, multi-tenant isolation rules, and the non-blocking "Antigravity" pipeline for **Module 4: Project Management**.

---

## 1. Core Objectives
* [cite_start]**Temporal Project Hierarchy:** Structure project resources under a clear, chronological year-based architecture[cite: 3, 474].
* [cite_start]**Automated Foldering:** Eliminate manual setups by instantly seeding 13 standard compliance folders the moment a project is created.
* [cite_start]**Interrogation Lookup Engine:** Provide high-speed document searches across various metadata parameters[cite: 3, 508, 509].
* **The Antigravity Objective:** Offload deep relational database seeding and heavy, multi-layered search queries from your main HTTP threads, preventing system lag during busy construction or audit periods.

---

## 2. Technical Blueprint & Database Modeling

### 2.1 Schema Additions (PostgreSQL + Prisma)
[cite_start]The following relational entities must be added to your `schema.prisma` file, linking seamlessly with your existing `companyId` tenant scoper:

```prisma
model Project {
  id          String    @id @default(uuid())
  companyId   String
  company     Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  name        String
  year        Int       // Used for the Year-Based Hierarchy (e.g., 2025, 2026, 2027)
  archivedAt  DateTime? // Part of the dual-gated soft-delete security pattern
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  folders     Folder[]  // Back-relation to the auto-seeded sub-folders

  @@index([companyId])
  @@index([year])
}

model Folder {
  id        String     @id @default(uuid())
  projectId String
  project   Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name      String     // Stores the names of the 13 standard compliance sub-folders
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  documents Document[] // Relational link connecting uploaded files directly to a folder

  @@index([projectId])
}
2.2 Relational Expansion & ConstraintsTo properly tie your folders into your document system, update your existing Document model:Document.folderId (String, Optional): References Folder.id via a foreign key.Cascading Logic: When a folder is deleted, any documents inside it must remain safe with their pointer set to null (onDelete: SetNull).Strict Date Standardizing: All document action timestamps must be stored using UTC. All project-related expiration dates or inspections must use standard ISO date fields.  2.3 Global Multi-Tenant Security RegistrationAdd your new models to the tenant scoping array to protect project data from unauthorized cross-tenant access automatically:TypeScript// Inside: src/common/constants/tenant-scoped-models.ts
export const TENANT_SCOPED_MODELS = [
  'Category',
  'Document',
  'Individual',
  'Reminder',
  'Asset',
  'Project', // Registered for automatic companyId filtering via TenantPrismaService
  'Folder',  // Registered for automatic companyId filtering via TenantPrismaService
];
3. The "Antigravity" Processing Strategy3.1 Asynchronous Folder Seeding (On-Project Creation)Creating a single project requires executing 14 separate database writes (1 for the project, and 13 for the folders). Doing this sequentially inside an HTTP request thread can easily slow down your system. The Antigravity Layer keeps things moving with a fast handoff:  Ingress: The admin user fills out the new project form and clicks save.Handoff: The request hits POST /v1/projects. The endpoint performs a quick schema validation, saves the project record, and posts a seeding job (seed-project-folders) to your background queue.Fast Return: The server immediately sends a 201 Created response back to the UI, completely bypassing any folder creation lag.Off-Thread Worker Execution: An isolated background queue worker picks up the job and seeds the 13 required folders using a single, high-performance database transaction:  Preliminary Plan   AF1/AF2   Appointments   Plans   Drawings   Method Statements   Inductions   Toolbox Talks   Site Audits   SSWP   Permits   Accident Reports   MSDS   3.2 High-Performance Audit Interrogation SearchWhen regulatory auditors run queries across millions of rows filtering by dates, signatories, or file types, it can cause heavy database locking.  The Antigravity Search Solution: The system processes these requests through a read-optimized replica database or dedicated elastic indexing service. It returns accurate search results in under 2 seconds without slowing down standard app writes.  4. Endpoints & API Access MatrixAll routes are fully secured by your standard Role-Based Access Control (RBAC) rules and automatically inherit tenant data isolation.  HTTP MethodRoute StringAllowed RolesDescriptionPOST/v1/projectsSUPER_ADMIN, COMPANY_ADMINCreates a new project and triggers the background folder-seeding task.  GET/v1/projectsAuthenticatedLists active projects for the caller's company, organized by year.  GET/v1/projects/:id/foldersAuthenticatedReturns the 13 auto-seeded folders and their document structures.  PATCH/v1/projects/:idSUPER_ADMIN, COMPANY_ADMINModifies project names, years, or tracking details.  PATCH/v1/projects/:id/archiveSUPER_ADMIN, COMPANY_ADMINSoft-archives a project layout by updating its archivedAt field.DELETE/v1/projects/:id/permanentSUPER_ADMIN, COMPANY_ADMINPermanently deletes a project from the database only if it has been soft-archived first.GET/v1/projects/interrogateSUPER_ADMIN, COMPANY_ADMINRuns deep audit lookup queries with multi-filter parameters.  POST/v1/documents/:id/sign-offCOMPANY_USER, APP_USERCaptures section signatures and locks the document hash once complete.  5. Acceptance Verification GatewaysBefore pushing Module 4 to production, it must pass these automated compliance checks:Cross-Tenant Guardrail Test: Log in as a user from Company A. Attempt to run an interrogation search pointing directly to a project ID or folder ID belonging to Company B. The response must return an opaque 404 Not Found error instead of a 403 Forbidden to prevent resource probing.  Concurrency Load Check: Simulate 50 administrators creating projects simultaneously. The API layer must keep response times under 200ms, while the Antigravity background worker securely processes and seeds the 650 sub-folders in the background without causing database deadlocks.Document Locking Verification: Execute a signature sign-off on a document section. Verify that partial signatures leave the file open for editing , but completing the final signature locks the document instantly, making it completely immutable. 