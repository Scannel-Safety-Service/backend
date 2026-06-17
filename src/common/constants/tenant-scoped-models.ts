/**
 * List of models in our Prisma schema that have a companyId field
 * and must be automatically scoped by the TenantPrismaService.
 */
export const TENANT_SCOPED_MODELS = [
  'User',
  'RefreshToken',
  'PasswordResetToken',
  'InvitationToken',
  'ImpersonationLog',
];
