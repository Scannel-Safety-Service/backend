import { Role } from '../enums/role.enum';

export interface JwtPayload {
  sub: string;
  companyId: string | null;
  role: Role;
  impersonatedBy?: string;
}
