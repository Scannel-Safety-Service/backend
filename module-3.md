# Module 3: Asset Management — Blueprint & Integration Plan

This document defines the implementation strategy, relational architecture, data isolation boundaries, and the non-blocking "Antigravity" asynchronous pipeline for **Module 3: Asset Management**.

---

## 1. Core Objectives
* [cite_start]**Asset Lifecycle Management:** Provide complete, multi-tenant Create, View, Update, and Soft-Archive (CRUD) workflows for physical assets, heavy tools, lifting gear, and calibration instruments[cite: 431, 437].
* [cite_start]**Compliance Tracking:** Utilize asset expiration markers to drive core visual compliance tracking systems and dashboard alert mechanisms[cite: 449].
* [cite_start]**The Antigravity Objective:** Isolate mobile-first "Rapid Entry" processing payloads completely from the HTTP server application threads using asynchronous task delegation[cite: 207, 455].

---

## 2. Architectural & Database Blueprint

### 2.1 Schema Additions (PostgreSQL + Prisma)
The following structures must be introduced into the primary database layer, referencing the tenant framework via explicit `companyId` parameters:

```prisma
enum AssetCategory {
  PLANT
  LIFTING_EQUIPMENT
  WORKING_AT_HEIGHT
  CALIBRATION_TOOLS
}

model Asset {
  id           String        @id @default(uuid())
  companyId    String
  company      Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  serialNumber String
  category     AssetCategory
  description  String
  expiryDate   DateTime      // Evaluated by visual alerting metrics
  archivedAt   DateTime?     // Tracks soft-delete transitions
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  documents    Document[]    // Maps certificates back to this specific asset record

  @@index([companyId])
  @@index([expiryDate])
}
2.2 Relational ExpansionTo establish clear mapping capabilities, the existing Document entity will be extended with an optional relation to cleanly support attaching files (e.g., GA certificates, validation paperwork) to physical equipment profiles:  Document.assetId (String, Optional): References Asset.id via foreign key logic.Cascading Rules: On deletion of an asset profile, associated document records must persist with their pointer set to null (onDelete: SetNull).2.3 Global Multi-Tenant Security RegistrationTo seamlessly protect asset data from unauthorized cross-tenant actions, the exact model token string must be added to the global intercept mapping collection:TypeScript// Inside: src/common/constants/tenant-scoped-models.ts
export const TENANT_SCOPED_MODELS = [
  'Category',
  'Document',
  'Individual',
  'Reminder',
  'Asset', // Injects automatic companyId scoping across the custom Prisma extension
];
3. The "Antigravity" Processing StrategyThe Antigravity layer prevents heavy file-conversion mechanics from blocking standard API routes or causing API lag. It splits high-volume mobile asset registrations into a Fast-Return Phase and an Asynchronous Completion Phase.  3.1 Asymmetric Process FlowIngress: The mobile client captures an asset compliance sticker or certificate using the native camera tool.  Handoff: The device submits a raw photo payload to the POST /v1/assets/:id/rapid-entry endpoint.  Fast-Return Gate: The API instantly verifies authentication, confirms user authorization bounds, validates image size limits, and registers a background job with the asset-processing-queue. The server immediately returns a 202 Accepted status back to the mobile application.  Off-Thread Processing (The Antigravity Engine): An isolated, dedicated queue worker consumes the job details:Ingests raw binary image objects or temporary local storage pointers.  Compresses and normalizes dimensions via the background processing layer.  Generates a standardized A4 PDF canvas containing the target graphic.  Writes the resulting file asset to the secure object storage location.  Instantiates a corresponding reference path on the Document database model, mapped to the correct parent assetId.  3.2 Failure Isolation GuardrailsIf background transformation fails, processing failures must be captured in the centralized logging ecosystem.  Incomplete, corrupted, or broken output fragments must never be allowed to persist within storage environments.  The original context asset data must remain accessible for retry processing tasks.  4. Endpoints & API Access MatrixAll endpoints are protected under standard Role-Based Access Control (RBAC) rules and automatically inherit scoped tenancy protection through the intercept gateway.  HTTP MethodRoute StringAllowed RolesDescriptionPOST/v1/assetsSUPER_ADMIN, COMPANY_ADMINCreates an individual asset profile with mandatory metadata fields.  GET/v1/assetsAuthenticatedLists assets for the caller's company; automatically hides archived profiles.  GET/v1/assets/:idAuthenticatedLooks up detailed asset information, including associated document arrays.  PATCH/v1/assets/:idSUPER_ADMIN, COMPANY_ADMINModifies existing asset parameters and descriptive metadata fields.  PATCH/v1/assets/:id/archiveSUPER_ADMIN, COMPANY_ADMINSoft-archives an asset profile by updating its archivedAt field.  DELETE/v1/assets/:id/permanentSUPER_ADMIN, COMPANY_ADMINPerforms a hard deletion from the database only if the profile has been soft-archived first.POST/v1/assets/:id/rapid-entryCOMPANY_ADMIN, COMPANY_USERMulti-part ingress endpoint that queues image files for off-thread PDF conversion.  5. Acceptance Verification GatewaysA feature is not ready for production release until it clears these distinct testing constraints:  Isolation Boundary Test: Authenticate as an operator belonging to Company A. Attempt to view or modify an asset profile linked to Company B using direct ID parameters. The request must return an opaque 404 Not Found response mask rather than a 403 Forbidden response to prevent malicious resource probing.  Thread Saturation Audit: Simulate an processing rush by submitting multiple image file transformations to the rapid-entry route simultaneously. Main API routing lanes, login validation loops, and standard document retrieval requests must continue running without performance degradation or connection stalls.  Double-Gated Deletion Check: Execute a hard delete request against an active asset resource. The system must completely block the query, returning a validation failure, until a distinct archival patch (/archive) is processed first.  