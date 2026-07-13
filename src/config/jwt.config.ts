import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessExpiry: process.env.JWT_ACCESS_EXPIRY,
  refreshExpiry: process.env.JWT_REFRESH_EXPIRY,
  // Mobile channel — separate secret, cryptographically isolated from web tokens
  mobileSecret: process.env.JWT_MOBILE_SECRET,
  mobileAccessExpiry: process.env.JWT_MOBILE_ACCESS_EXPIRY ?? '1h',
  mobileRefreshExpiry: process.env.JWT_MOBILE_REFRESH_EXPIRY ?? '30d',
}));
