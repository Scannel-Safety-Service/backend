import { Request } from 'express';
import { Role } from '../enums/role.enum';

export interface AuthenticatedUser {
  userId: string;
  companyId: string | null;
  role: Role;
  impersonatedBy?: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
