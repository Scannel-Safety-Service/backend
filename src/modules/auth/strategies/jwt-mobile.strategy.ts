import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-request.interface';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';

/**
 * Mobile JWT strategy — future-ready skeleton.
 *
 * Accepts only tokens with aud: 'mobile', signed with JWT_MOBILE_SECRET.
 * This strategy is registered but NOT applied as a global guard on the web
 * server. It will be wired to mobile-specific route guards when the mobile
 * API is built.
 *
 * Security guarantees:
 * - Web tokens (aud: 'web', signed with JWT_ACCESS_SECRET) are rejected here.
 * - Mobile tokens are rejected by JwtAccessStrategy on the web.
 * - The two channels are cryptographically isolated via different secrets.
 */
@Injectable()
export class JwtMobileStrategy extends PassportStrategy(
  Strategy,
  'jwt-mobile',
) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('jwt.mobileSecret');
    // If no mobile secret is configured yet, use a placeholder that will
    // never match any real token. The strategy still registers safely.
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret ?? 'MOBILE_SECRET_NOT_CONFIGURED',
      audience: 'mobile',
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      companyId: payload.companyId,
      role: payload.role,
    };
  }
}
