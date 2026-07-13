import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AdminController } from './admin.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtMobileStrategy } from './strategies/jwt-mobile.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [AuthController, AdminController],
  providers: [
    AuthService,
    AuthRepository,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    JwtMobileStrategy, // Registered but not applied globally — used by mobile API guards only
  ],
  exports: [AuthService],
})
export class AuthModule {}
