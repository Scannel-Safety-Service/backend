/**
 * List of models in our Prisma schema that have a companyId field
 * and must be automatically scoped by the TenantPrismaService.
 *
 * Once a model is added here, TenantPrismaService will automatically
 * inject the caller's companyId into ALL read and write operations —
 * developers must NOT add manual companyId filters in services.
 */
export const TENANT_SCOPED_MODELS = [
  'User',
  'RefreshToken',
  'PasswordResetToken',
  'InvitationToken',
  'ImpersonationLog',
  'Category',
  'Document',
  'Individual',
  'Reminder',
  'Asset', // Module 3 — Asset Management
  'Project', // Module 4 — Project Management
  'Folder',  // Module 4 — Project Management
];
